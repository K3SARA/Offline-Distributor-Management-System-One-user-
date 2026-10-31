import React from 'react';
import { X, Printer, Truck, Receipt } from 'lucide-react';
import { Order } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface InvoiceModalProps {
  order: Order | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, onClose }) => {
  const { formatMoney } = useCurrency();
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Controls */}
        <div className="px-4 sm:px-8 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50 print:hidden shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Bill Slip
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">
              {order.status}
            </span>
            {order.paperBillNumber && (
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                Slip: {order.paperBillNumber}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handlePrint}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Print Bill</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Delivery Note & Invoice Body */}
        <div id="printable-invoice" className="p-4 sm:p-10 overflow-y-auto space-y-4 sm:space-y-6 text-slate-900 bg-white">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-slate-200 pb-4 sm:pb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                DISTRIBUTION SALES BILL
              </h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono text-slate-500 mt-1">
                <span>System Ref: {order.orderNumber}</span>
                {order.paperBillNumber && (
                  <span className="text-blue-600 font-bold">Paper Bill #: {order.paperBillNumber}</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 sm:mt-1">
                Date: {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <h3 className="font-bold text-sm sm:text-base text-slate-900">Distributor Logistics Depot</h3>
              {order.lorry ? (
                <div className="text-xs text-slate-600 mt-0.5 sm:mt-1 space-y-0.5">
                  <p className="font-semibold text-slate-900">
                    Lorry: {order.lorry.vehicleNumber}
                  </p>
                  <p>Driver: {order.lorry.driverName}</p>
                  <p className="text-blue-600 font-medium">Route: {order.route?.name || order.lorry.route?.name || 'Local Route'}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Warehouse Central Counter</p>
              )}
            </div>
          </div>

          {/* Client & Destination Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-100 text-sm">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Retail Outlet
              </span>
              <p className="font-bold text-slate-900">{order.customer.name}</p>
              {order.customer.companyName && (
                <p className="text-xs text-slate-600">{order.customer.companyName}</p>
              )}
              <p className="text-xs text-slate-600 mt-1">{order.customer.deliveryAddress}</p>
              <p className="text-xs text-slate-600">{order.customer.city}</p>
              <p className="text-xs text-slate-600 mt-1 font-mono">{order.customer.phone}</p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Account & Payment
              </span>
              <p className="text-xs text-slate-600">
                Client Code: <span className="font-mono font-semibold text-slate-900">{order.customer.code}</span>
              </p>
              <p className="text-xs text-slate-600">
                Payment Mode: <span className="font-semibold text-slate-900">{order.paymentMethod || 'CASH'}</span>
              </p>
              <p className="text-xs text-slate-600">
                Status: <span className="font-semibold text-slate-900">{order.paymentStatus}</span>
              </p>
              {order.notes && (
                <div className="mt-2 text-xs text-slate-600 bg-white p-2 rounded-lg text-left border border-slate-200">
                  <strong>Notes:</strong> {order.notes}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-2xl overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[480px]">
              <thead className="bg-slate-100 text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-2.5 sm:p-3 pl-3 sm:pl-4">Item & SKU</th>
                  <th className="p-2.5 sm:p-3 text-center">Unit</th>
                  <th className="p-2.5 sm:p-3 text-center">Qty</th>
                  <th className="p-2.5 sm:p-3 text-right">Unit Price</th>
                  <th className="p-2.5 sm:p-3 pr-3 sm:pr-4 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-2.5 sm:p-3 pl-3 sm:pl-4">
                      <p className="font-medium text-slate-900">{item.product.name}</p>
                      <span className="text-[10px] sm:text-[11px] font-mono text-slate-400">{item.product.sku}</span>
                    </td>
                    <td className="p-2.5 sm:p-3 text-center text-xs text-slate-500">{item.product.unit}</td>
                    <td className="p-2.5 sm:p-3 text-center font-bold text-slate-900">
                      {item.quantity}
                      {item.freeQuantity > 0 && (
                        <span className="block text-[10px] font-semibold text-emerald-600">
                          +{item.freeQuantity} Free
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 sm:p-3 text-right font-mono text-slate-600">{formatMoney(item.unitPrice)}</td>
                    <td className="p-2.5 sm:p-3 pr-3 sm:pr-4 text-right font-bold text-slate-900 font-mono">
                      {formatMoney(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="flex justify-end pt-2">
            <div className="w-full sm:w-64 space-y-1.5 sm:space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-medium text-slate-900 font-mono">{formatMoney(order.subtotal)}</span>
              </div>
              {order.items.some(i => (i.freeQuantity || 0) > 0) && (
                <div className="flex justify-between text-xs text-emerald-700 font-medium">
                  <span>Promotional Units:</span>
                  <span className="font-mono">
                    {order.items.reduce((acc, i) => acc + (i.freeQuantity || 0), 0)} Free (Rs. 0)
                  </span>
                </div>
              )}
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Tier Discount:</span>
                  <span className="font-mono">-{formatMoney(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Net Total:</span>
                <span className="font-mono text-blue-600">{formatMoney(order.netTotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 pt-1">
                <span>Cash Paid:</span>
                <span className="font-mono font-bold text-emerald-600">{formatMoney(order.cashReceived || 0)}</span>
              </div>
              {order.netTotal - (order.cashReceived || 0) > 0 && (
                <div className="flex justify-between text-xs text-rose-600 font-bold pt-1">
                  <span>Credit Balance:</span>
                  <span className="font-mono">{formatMoney(order.netTotal - (order.cashReceived || 0))}</span>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Signatures */}
          <div className="pt-6 sm:pt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 border-t border-slate-200 text-xs text-slate-400">
            <div>
              <p className="font-semibold text-slate-600 mb-4 sm:mb-6">Delivered By (Driver):</p>
              <div className="border-b border-dashed border-slate-300 w-48"></div>
              <p className="mt-1 text-[11px]">{order.lorry ? `${order.lorry.driverName} (${order.lorry.vehicleNumber})` : 'Warehouse Dispatch'}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-semibold text-slate-600 mb-4 sm:mb-6">Received By (Customer):</p>
              <div className="border-b border-dashed border-slate-300 w-48 sm:ml-auto"></div>
              <p className="mt-1 text-[11px]">Authorized Shop Stamp & Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
