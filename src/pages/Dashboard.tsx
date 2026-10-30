import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Truck, 
  AlertTriangle, 
  Coins, 
  Plus, 
  Printer, 
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Clock
} from 'lucide-react';
import { ReportService, OrderService } from '../services/api';
import { DashboardStats, Order } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface DashboardProps {
  onNavigateToOrder: () => void;
  onNavigateToInventory: () => void;
  onViewInvoice: (order: Order) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToOrder,
  onNavigateToInventory,
  onViewInvoice
}) => {
  const { formatCurrency, currencyConfig } = useCurrency();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const data = await ReportService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      await OrderService.updateStatus(orderId, status);
      await fetchStats();
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 font-medium">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Syncing with Local Database...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 overflow-y-auto h-full">
      {/* Header & Primary Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
            Distribution Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time warehouse sales, dispatched trucks, and urgent inventory alerts
          </p>
        </div>

        <button
          onClick={onNavigateToOrder}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white font-medium rounded-2xl shadow-sm transition-all duration-150 text-base"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          Create New Order
        </button>
      </div>

      {/* Low Stock Urgent Banner */}
      {stats.lowStockCount > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-2xl text-amber-800 shrink-0">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-base font-semibold text-amber-950">
                {stats.lowStockCount} Products Below Minimum Stock Threshold
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Items like {stats.lowStockItems.map(i => i.name).join(', ')} require inbound restocking.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToInventory}
            className="px-4 py-2 bg-amber-900 hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition self-start sm:self-auto shrink-0"
          >
            Manage Stock <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Apple-Style Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200/70 p-6 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Revenue</span>
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Coins className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-900">
            {formatCurrency(stats.revenueToday)}
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium">From {stats.ordersTodayCount} distribution orders</p>
        </div>

        <div className="bg-white border border-slate-200/70 p-6 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Dispatched Today</span>
            <div className="p-2 bg-blue-50 rounded-xl">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-900">
            {stats.dispatchedCount} <span className="text-lg text-slate-400 font-normal">/ {stats.ordersTodayCount}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium">Outbound delivery status</p>
        </div>

        <div className="bg-white border border-slate-200/70 p-6 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Low Stock Alert</span>
            <div className="p-2 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <div className={`text-3xl font-bold tracking-tight ${stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {stats.lowStockCount}
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium">Products at risk of stockout</p>
        </div>

        <div className="bg-white border border-slate-200/70 p-6 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Receivables</span>
            <div className="p-2 bg-slate-50 rounded-xl">
              <TrendingUp className="w-5 h-5 text-slate-600" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-900">
            {formatCurrency(stats.totalOutstanding)}
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium">Total client outstanding balance</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200/70 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Today's Distribution Orders</h2>
            <p className="text-xs text-slate-400">Order processing, delivery notes, and instant dispatch controls</p>
          </div>
          <span className="text-xs font-medium text-slate-400">
            Showing {stats.recentOrders.length} orders
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="px-7 py-4">Order #</th>
                <th className="px-6 py-4">Client / Store</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Net Total</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-7 py-4 text-right">Fulfillment Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {stats.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-7 py-16 text-center text-slate-400">
                    <p className="text-base font-semibold text-slate-700">No orders logged today yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Click "Create New Order" to start dispatching goods.</p>
                  </td>
                </tr>
              ) : (
                stats.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-7 py-4 font-mono font-bold text-slate-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{order.customer.name}</p>
                      <p className="text-xs text-slate-400">{order.customer.city}</p>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {formatCurrency(order.netTotal)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          order.status === 'DELIVERED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : order.status === 'DISPATCHED'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            : order.status === 'CANCELLED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-7 py-4 text-right space-x-2 whitespace-nowrap">
                      {order.status === 'PENDING' && (
                        <button
                          disabled={updatingId === order.id}
                          onClick={() => handleUpdateStatus(order.id, 'DISPATCHED')}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-sm transition"
                        >
                          Dispatch
                        </button>
                      )}
                      {order.status === 'DISPATCHED' && (
                        <button
                          disabled={updatingId === order.id}
                          onClick={() => handleUpdateStatus(order.id, 'DELIVERED')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition inline-flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Delivered
                        </button>
                      )}
                      <button
                        onClick={() => onViewInvoice(order)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1"
                        title="View & Print Delivery Note"
                      >
                        <Printer className="w-3.5 h-3.5" /> Invoice
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
