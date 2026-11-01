import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Layers,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Printer,
  Truck,
  CreditCard,
  LogOut,
  ChevronRight,
  Check,
  RotateCcw,
  Target
} from 'lucide-react';
import { Customer, Product, Lorry, Order, User } from '../types';
import { CustomerService, LorryService, ProductService, OrderService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface CartItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  originalUnitPrice: number;
  availableStock: number;
  quantity: number;
  freeQuantity: number;
  discountPercent: number;
}

interface RepBillingProps {
  onViewInvoice?: (order: Order) => void;
  onExitToMenu?: () => void;
  initialLorryId?: string;
  user?: User;
  onLogout?: () => void;
}

export const RepBilling: React.FC<RepBillingProps> = ({
  onViewInvoice,
  onExitToMenu,
  initialLorryId,
  user,
  onLogout
}) => {
  const { formatMoney } = useCurrency();

  // Current Step: 1 = Customer, 2 = Cart, 3 = Brand, 4 = Products, 5 = Checkout
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Global Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [selectedLorryId, setSelectedLorryId] = useState<string>(initialLorryId || '');
  const [loading, setLoading] = useState<boolean>(true);

  // Step 1: Customer
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [billingMethod, setBillingMethod] = useState<'NORMAL' | 'BILL_TO_BILL'>('NORMAL');
  const [customerUnpaidBills, setCustomerUnpaidBills] = useState<Order[]>([]);
  const [settlePrevAmount, setSettlePrevAmount] = useState<string>('');
  const [collectPrevBill, setCollectPrevBill] = useState<boolean>(false);

  // Step 2 & Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Step 3: Brand
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  // Step 4: Product Search
  const [itemSearch, setItemSearch] = useState<string>('');

  // Step 5: Checkout
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT' | 'CHEQUE'>('CREDIT');
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [custList, prodList, lorryList] = await Promise.all([
        CustomerService.getAll(),
        ProductService.getAll(),
        LorryService.getAll()
      ]);

      setCustomers(custList);
      setProducts(prodList.filter(p => !p.isRawMaterial));
      setLorries(lorryList);

      if (initialLorryId && lorryList.some(l => l.id === initialLorryId)) {
        setSelectedLorryId(initialLorryId);
      } else if (lorryList.length > 0 && !selectedLorryId) {
        setSelectedLorryId(lorryList[0].id);
      }
    } catch (err) {
      console.error('Failed to load rep billing data', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedLorry = lorries.find(l => l.id === selectedLorryId);
  const lorryStockMap = useMemo(() => {
    const map = new Map<string, number>();
    if (selectedLorry && Array.isArray(selectedLorry.lorryStocks)) {
      selectedLorry.lorryStocks.forEach(s => map.set(s.productId, s.quantity));
    }
    return map;
  }, [selectedLorry]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // When customer changes, fetch unpaid bills
  useEffect(() => {
    if (selectedCustomerId) {
      CustomerService.getUnpaidBills(selectedCustomerId)
        .then(bills => {
          setCustomerUnpaidBills(bills);
          if (bills.length > 0 && bills[0]) {
            setBillingMethod('BILL_TO_BILL');
            const first = bills[0];
            const due = (first.balanceAmount ?? 0) > 0 ? (first.balanceAmount ?? 0) : Math.max(0, first.netTotal - (first.paidAmount || 0));
            setSettlePrevAmount(due.toString());
            setCollectPrevBill(true);
          } else {
            setBillingMethod('NORMAL');
            setSettlePrevAmount('');
            setCollectPrevBill(false);
          }
        })
        .catch(() => {
          setCustomerUnpaidBills([]);
          setBillingMethod('NORMAL');
          setSettlePrevAmount('');
          setCollectPrevBill(false);
        });

      const cust = customers.find(c => c.id === selectedCustomerId);
      if (cust && cust.creditLimit && cust.creditLimit > 0) {
        // Ready
      }
    }
  }, [selectedCustomerId]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const query = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(query) ||
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.code && c.code.toLowerCase().includes(query)) ||
      (c.deliveryAddress && c.deliveryAddress.toLowerCase().includes(query))
    );
  }, [customers, customerSearch]);

  // Distinct Brands
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach(p => {
      if (p.category && p.category.trim()) {
        brands.add(p.category.trim());
      }
    });
    return Array.from(brands).sort();
  }, [products]);

  // Brand products
  const brandProducts = useMemo(() => {
    if (!selectedBrand) return [];
    return products.filter(p => {
      const matchBrand = p.category.toLowerCase() === selectedBrand.toLowerCase();
      if (!matchBrand) return false;
      if (!itemSearch.trim()) return true;
      const q = itemSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [products, selectedBrand, itemSearch]);

  // Cart Management
  const addToCart = (product: Product, qty: number = 1) => {
    const lorryStock = lorryStockMap.get(product.id) ?? product.currentStock;
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        const nextQty = existing.quantity + qty;
        if (nextQty <= 0) {
          return prev.filter(i => i.productId !== product.id);
        }
        return prev.map(i => i.productId === product.id ? { ...i, quantity: nextQty } : i);
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          unit: product.unit,
          unitPrice: product.unitPrice,
          originalUnitPrice: product.unitPrice,
          availableStock: lorryStock,
          quantity: Math.max(1, qty),
          freeQuantity: 0,
          discountPercent: 0
        }
      ];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(i => {
          if (i.productId === productId) {
            const next = i.quantity + delta;
            return next > 0 ? { ...i, quantity: next } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeCartItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const finalTotal = useMemo(() => {
    const discount = (cartSubtotal * (globalDiscountPercent || 0)) / 100;
    return Math.max(0, cartSubtotal - discount);
  }, [cartSubtotal, globalDiscountPercent]);

  // Checkout submission
  const handleFinalCheckout = async () => {
    if (!selectedCustomerId) {
      setErrorMessage('Please select a customer first.');
      setCurrentStep(1);
      return;
    }
    if (cart.length === 0) {
      setErrorMessage('Please add at least one product to the cart.');
      setCurrentStep(3);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const itemsPayload = cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        freeQuantity: item.freeQuantity || 0,
        unitPrice: item.unitPrice
      }));

      const previousBillsPayload =
        billingMethod === 'BILL_TO_BILL' && collectPrevBill && customerUnpaidBills.length > 0 && customerUnpaidBills[0]
          ? [
              {
                orderId: customerUnpaidBills[0].id,
                amount: parseFloat(settlePrevAmount) || 0,
                paymentMethod: paymentMethod === 'CREDIT' ? 'CASH' : paymentMethod
              }
            ]
          : [];

      const orderPayload: any = {
        customerId: selectedCustomerId,
        paymentMethod,
        items: itemsPayload,
        discountAmount: (cartSubtotal * (globalDiscountPercent || 0)) / 100,
        discountPercentage: globalDiscountPercent,
        notes: notes.trim() || undefined,
        settlePreviousBills: previousBillsPayload
      };

      let createdOrder: Order;
      if (selectedLorryId) {
        createdOrder = await LorryService.enterDriverBill(selectedLorryId, orderPayload);
      } else {
        createdOrder = await OrderService.create(orderPayload);
      }

      setCheckoutSuccessOrder(createdOrder);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to complete bill.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNewBill = () => {
    setCart([]);
    setSelectedCustomerId('');
    setBillingMethod('NORMAL');
    setCustomerUnpaidBills([]);
    setSettlePrevAmount('');
    setCollectPrevBill(false);
    setCheckoutSuccessOrder(null);
    setCurrentStep(1);
    setCustomerSearch('');
    setItemSearch('');
  };

  const stepLabels = ['Customer', 'Cart', 'Brand', 'Items', 'Checkout'];

  if (loading) {
    return (
      <div className="flex-1 min-h-[80vh] flex items-center justify-center text-slate-400 text-xs">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F8FAFC] text-slate-900 select-none pb-20">
      {/* 1. SINGLE UNIFIED SLIM HEADER (50px) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-slate-900 truncate">
              {user?.fullName || 'Route Rep'}
            </h1>
            <p className="text-[10px] text-slate-500 font-medium truncate">
              {selectedLorry?.vehicleNumber || 'Route Lorry'} {selectedLorry?.route ? `• ${selectedLorry.route.code}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Cart Button */}
          <button
            onClick={() => setCurrentStep(2)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              cart.length > 0
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Cart ({totalItemsCount})</span>
          </button>

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. MINIMAL SLIM PROGRESS BAR (24px) */}
      <div className="bg-white border-b border-slate-200/60 px-4 py-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
          <span className="text-blue-600 uppercase tracking-wider">
            {stepLabels[currentStep - 1]}
          </span>
          <span className="font-mono text-slate-400">Step {currentStep} / 5</span>
        </div>
        <div className="max-w-2xl mx-auto w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="max-w-2xl mx-auto w-full px-4 mt-3">
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-700 text-xs font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold ml-2">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3. STEP VIEWS (Clean, Single Page, Minimal Text) */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-3">
        {/* ======================================================== */}
        {/* STEP 1: SELECT CUSTOMER */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="space-y-3">
            {/* Rep Sales Target Goal Widget */}
            {user?.monthlyTarget && user.monthlyTarget > 0 ? (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-2.5 flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">Monthly Goal</span>
                    <span className="text-[10px] text-slate-500 font-medium">Daily: {formatMoney(user.dailyTarget || 0)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded-lg shadow-2xs border border-blue-100 text-xs inline-block">
                    {formatMoney(user.monthlyTarget)}
                  </span>
                  {user.targetNewClients ? (
                    <span className="block text-[9px] text-slate-400 font-medium mt-0.5">Target: {user.targetNewClients} new shops</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="Search customer name or phone..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            {/* Compact Customer List */}
            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-0.5">
              {filteredCustomers.map(customer => {
                const isSelected = customer.id === selectedCustomerId;
                const balance = customer.outstandingBalance || 0;
                const hasDue = balance > 0;

                return (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`cursor-pointer p-3 rounded-xl border transition flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {customer.name}
                        </span>
                        {customer.code && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {customer.code}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {customer.phone || customer.deliveryAddress || 'No phone'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {hasDue ? (
                        <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg font-mono">
                          Due: {formatMoney(balance)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                          Clear
                        </span>
                      )}

                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs transition ${
                          isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300'
                        }`}
                      >
                        {isSelected && '✓'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Customer Inline Drawer (Only if selected) */}
            {selectedCustomer && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-xs animate-in fade-in">
                {/* Method Switcher */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingMethod('NORMAL')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition ${
                      billingMethod === 'NORMAL'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Normal Bill
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillingMethod('BILL_TO_BILL')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                      billingMethod === 'BILL_TO_BILL'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>Bill-to-Bill</span>
                    {customerUnpaidBills.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-white/20 text-[10px] rounded-full">
                        {customerUnpaidBills.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* If Bill-to-Bill: Simple Collection Row */}
                {billingMethod === 'BILL_TO_BILL' && customerUnpaidBills.length > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                    <label className="flex items-center gap-1.5 font-bold text-amber-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={collectPrevBill}
                        onChange={e => setCollectPrevBill(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Collect Old Bill</span>
                    </label>

                    {collectPrevBill && (
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-slate-500 font-bold">Rs.</span>
                        <input
                          type="number"
                          value={settlePrevAmount}
                          onChange={e => setSettlePrevAmount(e.target.value)}
                          className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-right font-bold text-xs text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Next Step Button */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(cart.length > 0 ? 2 : 3)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition active:scale-[0.99]"
                >
                  <span>{cart.length > 0 ? 'Go to Cart' : 'Select Brand & Products'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: VIEW CART */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="space-y-3">
            {cart.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">Cart is empty</p>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  + Add Products
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => {
                  const lineTotal = item.unitPrice * item.quantity;
                  return (
                    <div
                      key={item.productId}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {formatMoney(item.unitPrice)} / {item.unit}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Stepper */}
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.productId, -1)}
                            className="w-6 h-6 bg-white rounded flex items-center justify-center font-bold text-slate-700 shadow-2xs text-xs"
                          >
                            -
                          </button>
                          <span className="w-7 text-center font-mono font-bold text-xs text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.productId, 1)}
                            className="w-6 h-6 bg-white rounded flex items-center justify-center font-bold text-slate-700 shadow-2xs text-xs"
                          >
                            +
                          </button>
                        </div>

                        {/* Line Total */}
                        <span className="w-16 text-right font-mono font-bold text-xs text-slate-900">
                          {formatMoney(lineTotal)}
                        </span>

                        {/* Trash */}
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.productId)}
                          className="p-1 text-slate-300 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Subtotal Bar */}
                <div className="p-3 bg-slate-100 rounded-xl flex items-center justify-between font-bold text-xs">
                  <span className="text-slate-600">Total ({totalItemsCount} items)</span>
                  <span className="font-mono text-sm text-blue-600">{formatMoney(cartSubtotal)}</span>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    + Add More
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    className="py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs flex items-center justify-center gap-1"
                  >
                    <span>Checkout</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: SELECT BRAND */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              {availableBrands.map(brand => {
                const count = products.filter(p => p.category.toLowerCase() === brand.toLowerCase()).length;
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => {
                      setSelectedBrand(brand);
                      setItemSearch('');
                      setCurrentStep(4);
                    }}
                    className="p-3.5 bg-white border border-slate-200 hover:border-blue-500 rounded-xl text-left shadow-2xs flex flex-col justify-between h-24 active:scale-[0.98] transition"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-slate-900 truncate">{brand}</h3>
                      <p className="text-[10px] text-slate-400 font-medium">{count} Items</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(cart.length > 0 ? 2 : 1)}
                className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
              >
                ← Back
              </button>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="py-2 px-3 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  View Cart ({totalItemsCount}) →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 4: SELECT ITEM FOR BRAND */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <div className="space-y-3">
            {/* Top Bar with Brand Badge & Search */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="text-xs font-bold text-blue-600 flex items-center gap-1 shrink-0"
              >
                ← Brands
              </button>
              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg truncate">
                {selectedBrand}
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                placeholder={`Search ${selectedBrand}...`}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            {/* Products List */}
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-0.5">
              {brandProducts.map(product => {
                const stock = lorryStockMap.get(product.id) ?? product.currentStock;
                const inCart = cart.find(i => i.productId === product.id);

                return (
                  <div
                    key={product.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{product.name}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">
                        <span className="font-bold text-blue-600">{formatMoney(product.unitPrice)}</span>
                        <span className="ml-1 text-slate-400">• Stock: {stock}</span>
                      </p>
                    </div>

                    <div className="shrink-0">
                      {inCart ? (
                        <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateCartQty(product.id, -1)}
                            className="w-6 h-6 bg-white rounded flex items-center justify-center font-bold text-blue-700 text-xs shadow-2xs"
                          >
                            -
                          </button>
                          <span className="w-7 text-center font-mono font-bold text-xs text-blue-800">
                            {inCart.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => addToCart(product, 1)}
                            className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center font-bold text-xs shadow-2xs"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(product, 1)}
                          className="py-1 px-3 bg-blue-600 text-white font-bold text-xs rounded-lg shadow-xs hover:bg-blue-700 active:scale-95 transition"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Bottom Actions */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
              >
                ← Other Brands
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={cart.length === 0}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <span>View Cart ({totalItemsCount})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 5: FINAL CHECKOUT */}
        {/* ======================================================== */}
        {currentStep === 5 && (
          <div className="space-y-3">
            {/* Customer Pill */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Customer</p>
                <h3 className="text-xs font-bold text-slate-900">{selectedCustomer?.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg"
              >
                + Add Product
              </button>
            </div>

            {/* Items Summary Table */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase pb-1 border-b border-slate-100 flex justify-between">
                <span>Items ({cart.length})</span>
                <span>Price</span>
              </div>

              {cart.map(item => (
                <div key={item.productId} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-slate-800 font-medium truncate pr-2">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-mono font-bold text-slate-900 shrink-0">
                    {formatMoney(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Method</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['CASH', 'CREDIT', 'CHEQUE'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 rounded-lg text-xs font-bold transition ${
                      paymentMethod === m
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Final Total Card */}
            <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Final Amount</span>
                <span className="font-mono text-xl font-bold text-white">{formatMoney(finalTotal)}</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-800 rounded text-blue-400">
                {paymentMethod}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalCheckout}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing Bill...</span>
                </span>
              ) : (
                <>
                  <span>Confirm & Issue Bill</span>
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* SUCCESS MODAL POPUP */}
      {checkoutSuccessOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 text-center border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-0.5">Bill Issued Successfully!</h3>
            <p className="text-xs text-slate-500 font-mono mb-4">
              #{checkoutSuccessOrder.paperBillNumber || checkoutSuccessOrder.orderNumber} • {formatMoney(checkoutSuccessOrder.netTotal)}
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onViewInvoice?.(checkoutSuccessOrder)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt Slip</span>
              </button>

              <button
                type="button"
                onClick={handleStartNewBill}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Next Customer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
