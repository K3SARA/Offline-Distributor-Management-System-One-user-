import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  User,
  Compass,
  Calendar,
  CreditCard,
  Eye
} from 'lucide-react';
import { Lorry, Customer, Order, Product } from '../types';
import { LorryService, CustomerService, OrderService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface BillItemRow {
  productId: string;
  quantity: number;
  freeQuantity: number;
}

interface BillEntryProps {
  onViewInvoice?: (order: Order) => void;
}

export const BillEntry: React.FC<BillEntryProps> = ({ onViewInvoice }) => {
  const { formatMoney } = useCurrency();
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [selectedLorryId, setSelectedLorryId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);

  // Bill Form state
  const [paperBillNumber, setPaperBillNumber] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [billItems, setBillItems] = useState<BillItemRow[]>([{ productId: '', quantity: 1, freeQuantity: 0 }]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT' | 'CHEQUE'>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [lorryList, custList, orderList] = await Promise.all([
        LorryService.getAll(),
        CustomerService.getAll(),
        OrderService.getAll(undefined, undefined, undefined, 25)
      ]);

      setLorries(lorryList);
      setCustomers(custList);
      setTodayOrders(orderList);

      if (lorryList.length > 0 && !selectedLorryId) {
        setSelectedLorryId(lorryList[0].id);
      }
    } catch (err: any) {
      setErrorMessage('Failed to load system data.');
    } finally {
      setLoading(false);
    }
  };

  const selectedLorry = lorries.find(l => l.id === selectedLorryId);
  const availableLorryProducts = selectedLorry?.lorryStocks?.filter(s => s.quantity > 0) || [];
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Auto-filter customers belonging to this lorry's route first, then rest
  const routeCustomers = customers.filter(c => selectedLorry?.routeId && c.routeId === selectedLorry.routeId);
  const otherCustomers = customers.filter(c => !selectedLorry?.routeId || c.routeId !== selectedLorry.routeId);

  const addItemRow = () => {
    setBillItems([...billItems, { productId: '', quantity: 1, freeQuantity: 0 }]);
  };

  const updateItemRow = (index: number, field: keyof BillItemRow, value: any) => {
    const updated = [...billItems];
    const currentRow = { ...updated[index], [field]: value };

    // Auto-calculate free issues if trade scheme exists and productId or quantity changed
    if (field === 'productId' || field === 'quantity') {
      const targetProdId = field === 'productId' ? value : currentRow.productId;
      const stockItem = availableLorryProducts.find(s => s.productId === targetProdId);
      const buyRatio = stockItem?.product.freeRatioBuy || 0;
      const getRatio = stockItem?.product.freeRatioGet || 0;

      if (buyRatio > 0 && getRatio > 0 && currentRow.quantity > 0) {
        currentRow.freeQuantity = Math.floor(currentRow.quantity / buyRatio) * getRatio;
      } else if (field === 'productId') {
        currentRow.freeQuantity = 0;
      }
    }

    updated[index] = currentRow;
    setBillItems(updated);
  };

  const removeItemRow = (index: number) => {
    if (billItems.length === 1) {
      setBillItems([{ productId: '', quantity: 1, freeQuantity: 0 }]);
      return;
    }
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  // Calculate bill totals
  const calculateSubtotal = () => {
    return billItems.reduce((acc, item) => {
      const stockItem = availableLorryProducts.find(s => s.productId === item.productId);
      const price = stockItem ? stockItem.product.unitPrice : 0;
      return acc + (price * (item.quantity || 0));
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const discountPercent = selectedCustomer?.discountPercentage || 0;
  const discountAmount = (subtotal * discountPercent) / 100;
  const netTotal = subtotal - discountAmount;
  const totalBilledUnits = billItems.reduce((acc, item) => acc + (item.quantity || 0), 0);
  const totalFreeUnits = billItems.reduce((acc, item) => acc + (item.freeQuantity || 0), 0);

  // Auto set cash received if cash mode
  useEffect(() => {
    if (paymentMethod === 'CASH') {
      setCashReceived(netTotal.toFixed(2));
    } else if (paymentMethod === 'CREDIT') {
      setCashReceived('0');
    }
  }, [paymentMethod, netTotal]);

  const handleSubmitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedLorryId) {
      setErrorMessage('Please select a lorry.');
      return;
    }
    if (!selectedCustomerId) {
      setErrorMessage('Please select a customer for this bill.');
      return;
    }

    const validItems = billItems.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please add at least one line item to the bill.');
      return;
    }

    // Validate floating lorry stock (paid + free units)
    for (const line of validItems) {
      const stockItem = availableLorryProducts.find(s => s.productId === line.productId);
      const totalUnits = (line.quantity || 0) + (line.freeQuantity || 0);
      if (!stockItem || stockItem.quantity < totalUnits) {
        setErrorMessage(
          `Insufficient stock on Lorry ${selectedLorry?.vehicleNumber} for "${stockItem?.product.name || 'Selected Item'}". Only ${stockItem?.quantity || 0} units available, bill requires ${line.quantity} sold + ${line.freeQuantity || 0} free (${totalUnits} total).`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const parsedCash = parseFloat(cashReceived) || 0;
      const createdOrder = await LorryService.enterDriverBill(selectedLorryId, {
        paperBillNumber: paperBillNumber.trim() || undefined,
        customerId: selectedCustomerId,
        items: validItems.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          freeQuantity: i.freeQuantity || 0
        })),
        paymentMethod,
        cashReceived: parsedCash,
        notes: notes.trim() || undefined
      });

      setSuccessMessage(
        `Bill #${paperBillNumber || createdOrder.orderNumber} successfully entered for ${createdOrder.customer.name}! (${totalBilledUnits} paid + ${totalFreeUnits} free units deducted from lorry)`
      );

      // Reset form
      setPaperBillNumber('');
      setBillItems([{ productId: '', quantity: 1, freeQuantity: 0 }]);
      setNotes('');

      // Refresh list
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to submit bill.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Receipt className="w-4 h-4" />
            <span>Step 3: Evening Office Bill Entry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Driver Sales Bill Entry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Office manager inputs paper receipts brought back by drivers. Deducts from lorry floating stock.
          </p>
        </div>

        <div className="self-start sm:self-auto flex items-center gap-2 text-xs font-medium bg-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-slate-200/80 shadow-2xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-slate-600 font-medium">
            Evening: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lorry Selector Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Driver Lorry
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-slate-900">{selectedLorry?.vehicleNumber}</span>
              <span className="text-xs text-slate-500">• {selectedLorry?.driverName}</span>
              <span className="text-xs text-blue-600 font-medium truncate">({selectedLorry?.route?.name})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
          {lorries.map((lorry) => {
            const isSelected = lorry.id === selectedLorryId;
            return (
              <button
                key={lorry.id}
                onClick={() => setSelectedLorryId(lorry.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial text-center ${isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {lorry.vehicleNumber}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bill Entry Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Entry Card (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Paper Bill Slip Details
              </h2>
            </div>
            <button
              type="button"
              onClick={addItemRow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item Line
            </button>
          </div>

          <form onSubmit={handleSubmitBill} className="space-y-4">
            {/* Top row: Paper Bill Number & Customer Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Driver's Physical Paper Bill # (Slip / Invoice No)
                </label>
                <input
                  type="text"
                  value={paperBillNumber}
                  onChange={(e) => setPaperBillNumber(e.target.value)}
                  placeholder="e.g. SLIP-1082 or B-492"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Retail Customer / Outlet *
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose Retail Customer --</option>
                  {routeCustomers.length > 0 && (
                    <optgroup label={`Route Customers (${selectedLorry?.route?.name || 'Route'})`}>
                      {routeCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} - {c.name} {c.discountPercentage > 0 ? `(${c.discountPercentage}% Disc)` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherCustomers.length > 0 && (
                    <optgroup label="Other Customers">
                      {otherCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {/* Bill Line Items Table */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Items Sold From Lorry Stock
              </span>

              {availableLorryProducts.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                  ⚠️ This lorry has no floating stock loaded. Please perform a <strong>Morning Lorry Loading</strong> first.
                </div>
              ) : (
                billItems.map((item, index) => {
                  const stockItem = availableLorryProducts.find(s => s.productId === item.productId);
                  const price = stockItem ? stockItem.product.unitPrice : 0;
                  const lineTotal = price * (item.quantity || 0);
                  const hasScheme = stockItem && stockItem.product.freeRatioBuy && stockItem.product.freeRatioBuy > 0 && stockItem.product.freeRatioGet;

                  return (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 bg-slate-50 border border-slate-200/70 rounded-2xl"
                    >
                      {/* Product Selector */}
                      <div className="flex-1 w-full">
                        <select
                          value={item.productId}
                          onChange={(e) => updateItemRow(index, 'productId', e.target.value)}
                          required
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Select Item on Lorry --</option>
                          {availableLorryProducts.map((s) => (
                            <option key={s.productId} value={s.productId}>
                              {s.product.name} (Lorry Stock: {s.quantity} {s.product.unit})
                              {s.product.freeRatioBuy && s.product.freeRatioBuy > 0 && s.product.freeRatioGet
                                ? ` ★ Promo: Buy ${s.product.freeRatioBuy} get ${s.product.freeRatioGet} Free`
                                : ''} - {formatMoney(s.product.unitPrice)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity Controls Grid */}
                      <div className="flex items-center gap-2">
                        {/* Paid Qty */}
                        <div className="w-24">
                          <input
                            type="number"
                            min="1"
                            max={stockItem ? stockItem.quantity : 9999}
                            value={item.quantity || ''}
                            onChange={(e) => updateItemRow(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                            placeholder="Paid Qty"
                            title="Billed / Paid Quantity"
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                          />
                        </div>

                        {/* Free Issue Qty */}
                        <div className="w-24 relative">
                          <input
                            type="number"
                            min="0"
                            max={stockItem ? stockItem.quantity : 9999}
                            value={item.freeQuantity !== undefined ? item.freeQuantity : ''}
                            onChange={(e) => updateItemRow(index, 'freeQuantity', parseInt(e.target.value, 10) || 0)}
                            placeholder="0 Free"
                            title="Promotional Free Issue (Rs. 0)"
                            className="w-full bg-emerald-50/70 border border-emerald-200 text-emerald-900 rounded-xl px-2 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                          />
                          {hasScheme && item.quantity > 0 && (
                            <span className="hidden sm:inline-block absolute -top-2 right-1 px-1 bg-emerald-600 text-[8px] font-bold text-white rounded">
                              Auto
                            </span>
                          )}
                        </div>

                        {/* Line Total */}
                        <div className="w-24 text-right font-mono text-xs font-bold text-slate-800">
                          {formatMoney(lineTotal)}
                        </div>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Payment Details */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CASH">Cash Payment</option>
                    <option value="CREDIT">Credit (Pay Later)</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Cash Received ({formatMoney(0).split(' ')[0]})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Credit / Balance Unpaid
                  </label>
                  <div className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-mono font-bold text-rose-600">
                    {formatMoney(Math.max(0, netTotal - (parseFloat(cashReceived) || 0)))}
                  </div>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional driver remarks, shop manager signature note..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Calculations & Submit */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Units Outflow
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-700">
                    {totalBilledUnits} Paid {totalFreeUnits > 0 && <span className="text-emerald-600 font-bold">(+{totalFreeUnits} Free)</span>}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Subtotal
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-600">
                    {formatMoney(subtotal)}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Customer Discount ({discountPercent}%)
                    </span>
                    <span className="text-xs font-mono font-semibold text-emerald-600">
                      -{formatMoney(discountAmount)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Bill Net Total
                  </span>
                  <span className="text-lg font-bold text-blue-600 font-mono">
                    {formatMoney(netTotal)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || availableLorryProducts.length === 0}
                className="w-full sm:w-auto px-6 py-3 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.99] text-white text-xs font-bold rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Receipt className="w-4 h-4" />
                <span>{submitting ? 'Saving Bill...' : 'Save & Record Bill'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Lorry Floating Stock Overview (1 Col) */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                Stock Left in {selectedLorry?.vehicleNumber}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {availableLorryProducts.length} Items
              </span>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {availableLorryProducts.length > 0 ? (
                availableLorryProducts.map((stock) => (
                  <div
                    key={stock.id}
                    className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-xl text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-800 block">{stock.product.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">{formatMoney(stock.product.unitPrice)}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded-lg">
                      {stock.quantity} {stock.product.unit}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  Lorry has 0 items remaining.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Recorded Bills Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recent Driver Bills Recorded
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Bills brought by drivers and saved in the system today.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">System Bill #</th>
                <th className="py-2.5 px-3">Paper Slip #</th>
                <th className="py-2.5 px-3">Lorry / Driver</th>
                <th className="py-2.5 px-3">Retail Customer</th>
                <th className="py-2.5 px-3">Payment</th>
                <th className="py-2.5 px-3 text-right">Net Total</th>
                <th className="py-2.5 px-3 text-right">Cash Received</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    {order.orderNumber}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-blue-600">
                    {order.paperBillNumber || '—'}
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {order.lorry ? (
                      <span className="font-medium">
                        {order.lorry.vehicleNumber} ({order.lorry.driverName.split(' ')[0]})
                      </span>
                    ) : (
                      <span className="text-slate-400">Warehouse Counter</span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900">
                    {order.customer.name}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${order.paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : order.paymentStatus === 'PARTIAL'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                        }`}
                    >
                      {order.paymentMethod} • {order.paymentStatus}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {formatMoney(order.netTotal)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600">
                    {formatMoney(order.cashReceived)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {onViewInvoice && (
                      <button
                        onClick={() => onViewInvoice(order)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Delivery Receipt"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
