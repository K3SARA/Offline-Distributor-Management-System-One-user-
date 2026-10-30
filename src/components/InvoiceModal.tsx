import React from 'react';
import { X, Printer, CheckCircle } from 'lucide-react';
import { Order } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface InvoiceModalProps {
  order: Order | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, onClose }) => {
  const { formatCurrency } = useCurrency();
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Controls */}
        <div className="px-8 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Distribution Document
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">
              {order.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" /> Print Delivery Note
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Delivery Note & Invoice Body */}
        <div id="printable-invoice" className="p-8 sm:p-10 overflow-y-auto space-y-6 text-slate-900 bg-white">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                DISTRIBUTION NOTE & INVOICE
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Ref: {order.orderNumber}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Date: {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="text-right">
              <h3 className="font-bold text-base text-slate-900">Distributor Logistics Depot</h3>
              <p className="text-xs text-slate-500">Distribution Facility Dock #1</p>
              <p className="text-xs text-slate-500">Internal Warehouse Dispatch Unit</p>
            </div>
          </div>

          {/* Client & Destination Details */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50/70 p-5 rounded-2xl border border-slate-100 text-sm">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Deliver To
              </span>
              <p className="font-bold text-slate-900">{order.customer.name}</p>
              {order.customer.companyName && (
                <p className="text-xs text-slate-600">{order.customer.companyName}</p>
              )}
              <p className="text-xs text-slate-600 mt-1">{order.customer.deliveryAddress}</p>
              <p className="text-xs text-slate-600">{order.customer.city}</p>
              <p className="text-xs text-slate-600 mt-1 font-mono">{order.customer.phone}</p>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Account Status
              </span>
              <p className="text-xs text-slate-600">
                Client Code: <span className="font-mono font-semibold text-slate-900">{order.customer.code}</span>
              </p>
              <p className="text-xs text-slate-600">
                Pricing Tier: <span className="font-semibold text-slate-900">{order.customer.pricingTier}</span>
              </p>
              <p className="text-xs text-slate-600">
                Payment: <span className="font-semibold text-slate-900">{order.paymentStatus}</span>
              </p>
              {order.notes && (
                <div className="mt-2 text-xs text-amber-800 bg-amber-50 p-2 rounded-lg text-left">
                  <strong>Notes:</strong> {order.notes}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3 pl-4">Item & SKU</th>
                  <th className="p-3 text-center">Unit</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 pr-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 pl-4">
                      <p className="font-medium text-slate-900">{item.product.name}</p>
                      <span className="text-[11px] font-mono text-slate-400">{item.product.sku}</span>
                    </td>
                    <td className="p-3 text-center text-xs text-slate-500">{item.product.unit}</td>
                    <td className="p-3 text-center font-bold text-slate-900">{item.quantity}</td>
                    <td className="p-3 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                    <td className="p-3 pr-4 text-right font-bold text-slate-900">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="flex justify-end pt-2">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-medium text-slate-900">{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Tier Discount:</span>
                  <span>-{formatCurrency(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Net Total:</span>
                <span>{formatCurrency(order.netTotal)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Signatures */}
          <div className="pt-8 grid grid-cols-2 gap-8 border-t border-slate-200 text-xs text-slate-400">
            <div>
              <p className="font-semibold text-slate-600 mb-6">Dispatched By (Driver / Warehouse):</p>
              <div className="border-b border-dashed border-slate-300 w-48"></div>
              <p className="mt-1 text-[11px]">Signature & Date</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-600 mb-6">Received in Good Condition By:</p>
              <div className="border-b border-dashed border-slate-300 w-48 ml-auto"></div>
              <p className="mt-1 text-[11px]">Authorized Client Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
