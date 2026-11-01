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
  RotateCcw,
  Printer,
  Sparkles,
  Receipt,
  Truck,
  CreditCard,
  Percent,
  DollarSign,
  ChevronRight,
  ShieldAlert,
  Compass,
  Building2,
  Calendar,
  Wallet
} from 'lucide-react';
import { Customer, Product, Lorry, Order } from '../types';
import { CustomerService, LorryService, ProductService, OrderService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface CartItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number; // editable selling price
  originalUnitPrice: number;
  availableStock: number;
  quantity: number;
  freeQuantity: number;
  discountPercent: number; // line discount %
}

interface RepBillingProps {
  onViewInvoice?: (order: Order) => void;
  onExitToMenu?: () => void;
}

export const RepBilling: React.FC<RepBillingProps> = ({ onViewInvoice, onExitToMenu }) => {
  const { formatMoney, currencyConfig } = useCurrency();

  // Current Active Step: 1 | 2 | 3 | 4 | 5
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Global Data loaded from Distributor Pro
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [selectedLorryId, setSelectedLorryId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Step 1 State: Customer & Billing Method
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [billingMethod, setBillingMethod] = useState<'BILL_TO_BILL' | 'NORMAL'>('NORMAL');
  const [customerUnpaidBills, setCustomerUnpaidBills] = useState<Order[]>([]);
  const [loadingBills, setLoadingBills] = useState<boolean>(false);
  const [settlePrevAmount, setSettlePrevAmount] = useState<string>('');
  const [collectPrevBill, setCollectPrevBill] = useState<boolean>(false);

  // Step 2 & Cart State:
  const [cart, setCart] = useState<CartItem[]>([]);

  // Step 3 State: Selected Brand / Category
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  // Step 4 State: Brand Item Search
  const [itemSearch, setItemSearch] = useState<string>('');

  // Step 5 State: Final Checkout
  const [paperBillNumber, setPaperBillNumber] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT' | 'CHEQUE'>('CREDIT');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load backend data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [custList, prodList, lorryList] = await Promise.all([
        CustomerService.getAll(),
        ProductService.getAll(),
        LorryService.getAll()
      ]);

      setCustomers(custList);
      // Filter out raw materials: reps sell finished products only
      const finishedGoods = prodList.filter(p => !p.isRawMaterial);
      setProducts(finishedGoods);
      setLorries(lorryList);

      if (lorryList.length > 0 && !selectedLorryId) {
        setSelectedLorryId(lorryList[0].id);
      }
    } catch (err) {
      console.error('Failed to load rep billing data', err);
    } finally {
      setLoading(false);
    }
  };

  // Find active lorry and floating stock
  const selectedLorry = lorries.find(l => l.id === selectedLorryId);
  const lorryStockMap = useMemo(() => {
    const map = new Map<string, number>();
    if (selectedLorry && Array.isArray(selectedLorry.lorryStocks)) {
      selectedLorry.lorryStocks.forEach(s => map.set(s.productId, s.quantity));
    }
    return map;
  }, [selectedLorry]);

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // When customer is selected, fetch their unpaid bills to check outstanding
  useEffect(() => {
    if (selectedCustomerId) {
      setLoadingBills(true);
      CustomerService.getUnpaidBills(selectedCustomerId)
        .then(bills => {
          setCustomerUnpaidBills(bills);
          if (bills.length > 0 && bills[0]) {
            setBillingMethod('BILL_TO_BILL');
            const first = bills[0];
            const oldestDue = (first.balanceAmount ?? 0) > 0 ? (first.balanceAmount ?? 0) : Math.max(0, first.netTotal - (first.paidAmount || 0));
            setSettlePrevAmount(oldestDue.toString());
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
        })
        .finally(() => setLoadingBills(false));

      // Inherit customer discount
      const cust = customers.find(c => c.id === selectedCustomerId);
      if (cust && cust.discountPercentage) {
        setGlobalDiscountPercent(cust.discountPercentage);
      }
    } else {
      setCustomerUnpaidBills([]);
      setBillingMethod('NORMAL');
      setSettlePrevAmount('');
      setCollectPrevBill(false);
    }
  }, [selectedCustomerId, customers]);

  // Available brands (categories) from existing inventory
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category && p.category.trim() !== '') {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [products]);

  // Products filtered by selected brand
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

  // Filtered customer list for Step 1
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.companyName && c.companyName.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  // Cart helper functions
  const addToCart = (product: Product, qty: number = 1) => {
    const lorryStock = lorryStockMap.get(product.id) ?? product.currentStock;
    const existingIndex = cart.findIndex(i => i.productId === product.id);

    if (existingIndex >= 0) {
      const updated = [...cart];
      const newQty = updated[existingIndex].quantity + qty;
      updated[existingIndex].quantity = newQty;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          unit: product.unit,
          unitPrice: product.unitPrice,
          originalUnitPrice: product.unitPrice,
          availableStock: lorryStock,
          quantity: qty,
          freeQuantity: 0,
          discountPercent: 0
        }
      ]);
    }
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.productId === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateCartItemField = (productId: string, field: keyof CartItem, value: any) => {
    setCart(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const removeCartItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  // Calculations for checkout
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const totalDiscount = useMemo(() => {
    return (cartSubtotal * globalDiscountPercent) / 100;
  }, [cartSubtotal, globalDiscountPercent]);

  const billNetTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - totalDiscount);
  }, [cartSubtotal, totalDiscount]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Handle final checkout submission
  const handleFinalCheckout = async () => {
    if (!selectedCustomerId) {
      setErrorMessage('Please select a customer.');
      setCurrentStep(1);
      return;
    }
    if (cart.length === 0) {
      setErrorMessage('Your cart is empty. Please add at least one product.');
      setCurrentStep(3);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const parsedCash = parseFloat(cashReceived) || (paymentMethod === 'CASH' ? billNetTotal : 0);

      // Settle previous bill payload if toggled
      const previousBillsPayload =
        collectPrevBill && customerUnpaidBills.length > 0 && parseFloat(settlePrevAmount) > 0
          ? [
              {
                orderId: customerUnpaidBills[0].id,
                amount: parseFloat(settlePrevAmount),
                paymentMethod: 'CASH'
              }
            ]
          : undefined;

      const orderPayload = {
        paperBillNumber: paperBillNumber.trim() || undefined,
        customerId: selectedCustomerId,
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          freeQuantity: item.freeQuantity || 0,
          unitPrice: item.unitPrice
        })),
        paymentMethod,
        cashReceived: parsedCash,
        discountAmount: totalDiscount,
        discountPercentage: globalDiscountPercent,
        notes: notes.trim() || `Rep Route Billing: ${selectedCustomer?.name}`,
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
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to complete checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset entire flow for next bill
  const handleStartNewBill = () => {
    setCart([]);
    setSelectedCustomerId('');
    setBillingMethod('NORMAL');
    setCustomerUnpaidBills([]);
    setSettlePrevAmount('');
    setCollectPrevBill(false);
    setSelectedBrand('');
    setPaperBillNumber('');
    setPaymentMethod('CREDIT');
    setCashReceived('');
    setNotes('');
    setCheckoutSuccessOrder(null);
    setErrorMessage(null);
    setCurrentStep(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-slate-500">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 font-semibold text-sm">Loading Route Billing...</span>
      </div>
    );
  }

  // ========================================================
  // STEP-BY-STEP PROGRESS BAR HEADER
  // ========================================================
  const stepTitles = [
    { num: 1, label: 'Select Customer', icon: Users },
    { num: 2, label: 'View Cart', icon: ShoppingBag },
    { num: 3, label: 'Select Brand', icon: Layers },
    { num: 4, label: 'Select Item', icon: Plus },
    { num: 5, label: 'Checkout', icon: CheckCircle2 }
  ];

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] text-slate-900 select-none">
      {/* Ultra Minimal Top Header */}
      <header className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
                Route Sales Billing
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono">
                Rep Mode
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Step {currentStep} of 5 • {stepTitles[currentStep - 1].label}
            </p>
          </div>
        </div>

        {/* Lorry / Route Selector pill */}
        <div className="flex items-center gap-2">
          {lorries.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700">
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span>{selectedLorry?.vehicleNumber || 'Select Lorry'}</span>
            </div>
          )}

          {/* Quick Cart Badge in Header */}
          <button
            onClick={() => setCurrentStep(2)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              cart.length > 0 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Cart ({totalItemsCount})</span>
          </button>
        </div>
      </header>

      {/* Stepper Wizard Indicator */}
      <div className="bg-white border-b border-slate-200/60 px-4 sm:px-6 py-2.5 overflow-x-auto">
        <div className="flex items-center justify-between max-w-4xl mx-auto min-w-[500px]">
          {stepTitles.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = currentStep === step.num;
            const isCompleted = currentStep > step.num;
            return (
              <React.Fragment key={step.num}>
                <button
                  onClick={() => {
                    // Allow jumping to steps if prerequisites are met
                    if (step.num === 1 || (selectedCustomerId && (step.num <= 3 || cart.length > 0))) {
                      setCurrentStep(step.num);
                    }
                  }}
                  className={`flex items-center gap-2 py-1 px-2.5 rounded-xl text-xs font-bold transition ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isCompleted
                      ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isCurrent
                        ? 'bg-white text-blue-600'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isCompleted ? '✓' : step.num}
                  </span>
                  <span>{step.label}</span>
                </button>
                {idx < stepTitles.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 ${
                      currentStep > idx + 1 ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-700 text-xs font-semibold animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Single-Step View Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl w-full mx-auto">
        {/* ======================================================== */}
        {/* STEP 1: SELECT CUSTOMER & BILLING METHOD */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Step 1: Select Retail Customer
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose the outlet or shop in your route. Outstanding debt is detected automatically.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="Search shop name, owner, phone number, or client code..."
                className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                autoFocus
              />
            </div>

            {/* Customer List */}
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {filteredCustomers.map(customer => {
                const isSelected = customer.id === selectedCustomerId;
                const hasOutstanding = (customer.outstandingBalance || 0) > 0;

                return (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                          {customer.code}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">{customer.name}</h3>
                        {customer.companyName && (
                          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                            • {customer.companyName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <span>📞 {customer.phone}</span>
                        <span>📍 {customer.deliveryAddress || customer.city}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Outstanding Debt
                        </span>
                        <span
                          className={`font-mono text-sm font-extrabold ${
                            hasOutstanding ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {hasOutstanding ? formatMoney(customer.outstandingBalance) : 'Rs. 0.00 (Clear)'}
                        </span>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                          isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300 text-transparent'
                        }`}
                      >
                        ✓
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* If Customer Selected: Show Outstanding Analysis & Method Picker */}
            {selectedCustomer && (
              <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Selected: {selectedCustomer.name}
                    </span>
                  </div>
                  {selectedCustomer.outstandingBalance > 0 ? (
                    <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> Due: {formatMoney(selectedCustomer.outstandingBalance)}
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      ✓ Zero Debt
                    </span>
                  )}
                </div>

                {/* Choose Billing Method */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Choose Billing Method for this Delivery:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setBillingMethod('BILL_TO_BILL')}
                      className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 ${
                        billingMethod === 'BILL_TO_BILL'
                          ? 'border-amber-500 bg-amber-50/80 shadow-xs ring-2 ring-amber-400/20'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                          <Receipt className="w-4 h-4 text-amber-600" />
                          Bill-to-Bill Knock-off
                        </span>
                        {customerUnpaidBills.length > 0 && (
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded">
                            {customerUnpaidBills.length} Bill Due
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Collect previous delivery invoice cash today & deliver today's order on new credit.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBillingMethod('NORMAL')}
                      className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 ${
                        billingMethod === 'NORMAL'
                          ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                      }`}
                    >
                      <span className="font-bold text-xs text-blue-900 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        Standard Direct Sale
                      </span>
                      <p className="text-[11px] text-slate-600">
                        Issue regular cash or direct credit bill without previous invoice knock-off.
                      </p>
                    </button>
                  </div>
                </div>

                {/* If Bill-to-bill chosen and customer has unpaid bills: Show previous bill settlement box */}
                {billingMethod === 'BILL_TO_BILL' && customerUnpaidBills.length > 0 && (
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900">
                        Previous Bill #{customerUnpaidBills[0].paperBillNumber || customerUnpaidBills[0].orderNumber}
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-900">
                        <input
                          type="checkbox"
                          checked={collectPrevBill}
                          onChange={e => setCollectPrevBill(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span>Collect Previous Bill Now</span>
                      </label>
                    </div>

                    {collectPrevBill && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-slate-600">
                          Due: {formatMoney((customerUnpaidBills[0]?.balanceAmount ?? 0) > 0 ? (customerUnpaidBills[0]?.balanceAmount ?? 0) : (customerUnpaidBills[0]?.netTotal ?? 0))}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-600">Collecting: Rs.</span>
                          <input
                            type="number"
                            step="0.01"
                            value={settlePrevAmount}
                            onChange={e => setSettlePrevAmount(e.target.value)}
                            className="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Continue to Step 2 Button */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(cart.length > 0 ? 2 : 3)}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-sm flex items-center justify-center gap-2 transition active:scale-[0.99]"
                >
                  <span>{cart.length > 0 ? 'Go to Cart (Review Items)' : 'Select Brand & Add Products'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: VIEW CART (QUANTITY & PRICE REVIEW) */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Step 2: Review Cart Items
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Items currently added to this customer's bill.
                </p>
              </div>

              {/* Add More Items button */}
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Another Product</span>
              </button>
            </div>

            {/* Cart Table / Cards */}
            {cart.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-3xl space-y-3">
                <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">Your cart is empty</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Select a product brand from existing inventory to start adding items to this bill.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition"
                >
                  Select Brand Now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => {
                  const lineTotal = item.unitPrice * item.quantity;

                  return (
                    <div
                      key={item.productId}
                      className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {item.category}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
                        </div>
                        <p className="text-xs text-slate-500">
                          Unit: {item.unit} • Selling Price: <span className="font-mono font-bold text-slate-800">{formatMoney(item.unitPrice)}</span>
                        </p>
                      </div>

                      {/* Quantity & Controls */}
                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        {/* Stepper buttons */}
                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.productId, -1)}
                            className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-200 text-sm font-bold shadow-2xs"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-mono font-extrabold text-sm text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.productId, 1)}
                            className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-200 text-sm font-bold shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Free Promo Quantity */}
                        <div className="w-20">
                          <input
                            type="number"
                            min="0"
                            value={item.freeQuantity || ''}
                            onChange={e => updateCartItemField(item.productId, 'freeQuantity', parseInt(e.target.value, 10) || 0)}
                            placeholder="0 Free"
                            title="Promotional Free units"
                            className="w-full bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs rounded-xl px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="w-24 text-right">
                          <span className="font-mono font-extrabold text-sm text-slate-900">
                            {formatMoney(lineTotal)}
                          </span>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.productId)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Cart Subtotal Bar */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Cart Subtotal ({totalItemsCount} units)
                  </span>
                  <span className="font-mono text-lg font-black text-blue-600">
                    {formatMoney(cartSubtotal)}
                  </span>
                </div>

                {/* Action Buttons: Add Another or Go to Checkout */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Select Brand & Add More Products</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <span>Proceed to Step 5: Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: SELECT BRAND (CATEGORY) */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Step 3: Select Brand
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pick a brand or category from admin's available warehouse inventory.
                </p>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-3.5 py-1.5 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Cart ({totalItemsCount})</span>
                </button>
              )}
            </div>

            {/* Brand Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {availableBrands.map(brand => {
                const count = products.filter(p => p.category.toLowerCase() === brand.toLowerCase()).length;
                const isSelected = selectedBrand.toLowerCase() === brand.toLowerCase();

                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => {
                      setSelectedBrand(brand);
                      setItemSearch('');
                      setCurrentStep(4);
                    }}
                    className={`p-5 rounded-3xl border text-left transition-all flex flex-col justify-between h-32 active:scale-[0.98] ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                        : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/50 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-blue-600'
                        }`}
                      >
                        <Layers className="w-5 h-5" />
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    </div>

                    <div>
                      <h3 className={`font-extrabold text-sm ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {brand}
                      </h3>
                      <span className={`text-[11px] font-medium ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {count} Products in Catalog
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Back Button */}
            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(cart.length > 0 ? 2 : 1)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 transition"
                >
                  <span>Go to Cart ({totalItemsCount} items)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 4: SELECT ITEM FOR SELECTED BRAND */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                    Brand: {selectedBrand}
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Step 4: Select Product
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Only existing products in admin inventory can be added.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Brand</span>
              </button>
            </div>

            {/* Product search filter */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                placeholder={`Search ${selectedBrand} items...`}
                className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                autoFocus
              />
            </div>

            {/* Brand items list */}
            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
              {brandProducts.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-3xl text-slate-400 text-xs">
                  No products found under brand "{selectedBrand}".
                </div>
              ) : (
                brandProducts.map(product => {
                  const lorryStock = lorryStockMap.get(product.id) ?? product.currentStock;
                  const inCartItem = cart.find(i => i.productId === product.id);
                  const isOutOfStock = lorryStock <= 0;

                  return (
                    <div
                      key={product.id}
                      className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {product.sku}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{product.name}</h4>
                        </div>
                        <p className="text-xs text-slate-500">
                          Unit: {product.unit} • Selling Price: <span className="font-mono font-extrabold text-blue-600">{formatMoney(product.unitPrice)}</span>
                          <span className="ml-2 font-semibold text-slate-400">
                            (Stock: {lorryStock} {product.unit})
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        {inCartItem ? (
                          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                            <span className="text-xs font-bold text-emerald-800">
                              In Cart ({inCartItem.quantity})
                            </span>
                            <button
                              type="button"
                              onClick={() => addToCart(product, 1)}
                              className="w-6 h-6 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-bold hover:bg-emerald-700"
                              title="Add one more"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToCart(product, 1)}
                            disabled={isOutOfStock}
                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                              isOutOfStock
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add to Cart</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Navigation Buttons: "Add Another Product" or "Go to Cart & Checkout" */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Another Product (Select Brand)</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={cart.length === 0}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <span>Go to Cart & Checkout ({totalItemsCount} items)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 5: FINAL CHECKOUT (PRICE & QUANTITY ADJUSTMENTS, DISCOUNTS, FINALIZE) */}
        {/* ======================================================== */}
        {currentStep === 5 && (
          <div className="space-y-4 animate-fadeIn">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Step 5: Final Checkout & Pricing Adjustments
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Adjust final item quantities, customize unit prices, apply discount, and record payment.
              </p>
            </div>

            {/* Customer Summary Bar */}
            <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Customer Account
                </span>
                <h3 className="text-sm font-bold text-slate-900">{selectedCustomer?.name}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedCustomer?.code} • {selectedCustomer?.phone}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Billing Method
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      billingMethod === 'BILL_TO_BILL'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-blue-100 text-blue-900'
                    }`}
                  >
                    {billingMethod === 'BILL_TO_BILL' ? 'Bill-To-Bill' : 'Standard Direct'}
                  </span>
                </div>

                {/* Easy Add Another Product Button */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1 transition"
                  title="Add more products to this bill"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product</span>
                </button>
              </div>
            </div>

            {/* Items Adjustment Table */}
            <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Billed Items & Price Adjustments ({cart.length})
                </h4>
                <span className="text-[11px] text-slate-400">Rep can edit selling price if needed</span>
              </div>

              <div className="space-y-3">
                {cart.map(item => {
                  const lineTotal = item.unitPrice * item.quantity;

                  return (
                    <div
                      key={item.productId}
                      className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1">
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        <span className="text-[11px] text-slate-500">
                          SKU: {item.sku} • Original: {formatMoney(item.originalUnitPrice)}
                        </span>
                      </div>

                      {/* Controls: Price Adjustment, Quantity Stepper, Free Qty, Line Total */}
                      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                        {/* Unit Price Adjustment input */}
                        <div className="w-24">
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Price / Unit</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={e => updateCartItemField(item.productId, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Quantity Stepper */}
                        <div className="w-24">
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Qty</label>
                          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.productId, -1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-600 font-bold hover:bg-slate-100 rounded"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => updateCartItemField(item.productId, 'quantity', parseInt(e.target.value, 10) || 1)}
                              className="w-full text-center font-mono font-extrabold text-xs focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.productId, 1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-600 font-bold hover:bg-slate-100 rounded"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Free Promo Qty */}
                        <div className="w-20">
                          <label className="text-[10px] font-bold text-emerald-700 block mb-0.5">Free Qty</label>
                          <input
                            type="number"
                            min="0"
                            value={item.freeQuantity || ''}
                            onChange={e => updateCartItemField(item.productId, 'freeQuantity', parseInt(e.target.value, 10) || 0)}
                            placeholder="0"
                            className="w-full bg-emerald-50 border border-emerald-300 rounded-lg px-2 py-1 font-bold text-xs text-emerald-900 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="w-24 text-right">
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Total</label>
                          <span className="font-mono font-black text-xs text-slate-900">
                            {formatMoney(lineTotal)}
                          </span>
                        </div>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.productId)}
                          className="p-1 text-slate-400 hover:text-rose-600 mt-3"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment & Invoice Settings Card */}
            <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Paper slip / Bill # */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Driver Paper Slip # (Optional)
                  </label>
                  <input
                    type="text"
                    value={paperBillNumber}
                    onChange={e => setPaperBillNumber(e.target.value)}
                    placeholder="e.g. SLIP-1082"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CREDIT">Credit (Pay Next Visit)</option>
                    <option value="CASH">Cash Today</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                {/* Cash Received for today's bill */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cash Received (Today's Bill)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                    placeholder={paymentMethod === 'CASH' ? formatMoney(billNetTotal) : '0.00'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Discount Adjuster */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-emerald-600" />
                  Bill Discount Adjustment:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={globalDiscountPercent}
                    onChange={e => setGlobalDiscountPercent(parseFloat(e.target.value) || 0)}
                    className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-slate-500">%</span>
                  <span className="font-mono font-bold text-rose-600 ml-2">
                    (-{formatMoney(totalDiscount)})
                  </span>
                </div>
              </div>

              {/* Previous Bill Settlement Notice (If active) */}
              {collectPrevBill && parseFloat(settlePrevAmount) > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-900">Previous Bill Settled:</span>
                    <span className="text-slate-600 font-mono">
                      #{customerUnpaidBills[0]?.paperBillNumber || customerUnpaidBills[0]?.orderNumber}
                    </span>
                  </div>
                  <span className="font-mono font-extrabold text-emerald-700">
                    + {formatMoney(parseFloat(settlePrevAmount))}
                  </span>
                </div>
              )}

              {/* Remarks / Notes */}
              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional delivery notes, driver signature ref, or comments..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Final Totals Summary Bar */}
              <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                    Today's Bill Net Payable
                  </span>
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    {formatMoney(billNetTotal)}
                  </span>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                    Total Driver Cash Collection
                  </span>
                  <span className="text-xl font-black font-mono text-white">
                    {formatMoney(
                      (parseFloat(cashReceived) || (paymentMethod === 'CASH' ? billNetTotal : 0)) +
                      (collectPrevBill ? (parseFloat(settlePrevAmount) || 0) : 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Big Final "Checkout" Button */}
              <button
                type="button"
                onClick={handleFinalCheckout}
                disabled={submitting}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-2xl shadow-lg flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{submitting ? 'Generating Bill...' : 'Final "Checkout" & Issue Sales Bill'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SUCCESS MODAL POPUP: PRINT BILL & GO TO MENU */}
      {/* ======================================================== */}
      {checkoutSuccessOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-center space-y-5 animate-scaleUp">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-900">
                Bill Created Successfully!
              </h3>
              <p className="font-mono text-sm font-bold text-blue-600">
                {checkoutSuccessOrder.orderNumber}
              </p>
              <p className="text-xs text-slate-500">
                Customer: <span className="font-bold text-slate-800">{selectedCustomer?.name}</span>
              </p>
            </div>

            {/* Bill Summary Pill Box */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Net Bill Total:</span>
                <span className="font-mono font-bold text-slate-900">{formatMoney(checkoutSuccessOrder.netTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Status:</span>
                <span className="font-bold text-emerald-600">{checkoutSuccessOrder.paymentStatus}</span>
              </div>
              {checkoutSuccessOrder.cashReceived > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash Received:</span>
                  <span className="font-mono font-bold text-slate-900">{formatMoney(checkoutSuccessOrder.cashReceived)}</span>
                </div>
              )}
            </div>

            {/* Action Buttons: Print Bill & Go to Menu / Start Next */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onViewInvoice) {
                    onViewInvoice(checkoutSuccessOrder);
                  } else {
                    window.print();
                  }
                }}
                className="w-full py-3 bg-[#0071E3] hover:bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Bill Slip</span>
              </button>

              <button
                type="button"
                onClick={handleStartNewBill}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Start Next Customer Bill</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onExitToMenu) {
                    onExitToMenu();
                  } else {
                    handleStartNewBill();
                  }
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
              >
                Go to Menu / Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
