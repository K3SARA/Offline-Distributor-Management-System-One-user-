import React, { useEffect, useState, useRef } from 'react';
import {
  TrendingUp,
  Truck,
  AlertTriangle,
  Coins,
  Receipt,
  RotateCcw,
  Boxes,
  Printer,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Clock,
  Compass,
  Wallet,
  Calendar
} from 'lucide-react';
import { ReportService, OrderService } from '../services/api';
import { DashboardStats, Order } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { DateRangeFilter, DatePreset } from '../components/DateRangeFilter';

interface DashboardProps {
  onNavigateToLoading: () => void;
  onNavigateToBillEntry: () => void;
  onNavigateToSettlement: () => void;
  onNavigateToInventory: () => void;
  onViewInvoice: (order: Order) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToLoading,
  onNavigateToBillEntry,
  onNavigateToSettlement,
  onNavigateToInventory,
  onViewInvoice
}) => {
  const { formatMoney } = useCurrency();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  const activeRangeRef = useRef<{ from?: string; to?: string }>({});

  const fetchStats = async (from?: string, to?: string) => {
    try {
      const data = await ReportService.getDashboardStats(from, to);
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(dateRange.from, dateRange.to);
    activeRangeRef.current = dateRange;

    // Periodic sync
    const interval = setInterval(() => {
      fetchStats(activeRangeRef.current.from, activeRangeRef.current.to);
    }, 12000);
    return () => clearInterval(interval);
  }, [dateRange]);

  const handleDateRangeChange = (range: { from: string; to: string; preset: DatePreset }) => {
    setDatePreset(range.preset);
    const newRange = { from: range.from, to: range.to };
    setDateRange(newRange);
    activeRangeRef.current = newRange;
    fetchStats(range.from, range.to);
  };

  const getPresetLabel = () => {
    switch (datePreset) {
      case 'today':
        return "Today's";
      case 'yesterday':
        return "Yesterday's";
      case 'thisWeek':
        return 'This Week';
      case 'thisMonth':
        return 'This Month';
      case 'custom':
        return 'Selected Period';
      default:
        return 'Period';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 font-medium">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Syncing with Offline Database...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-7">
      {/* Header & Quick Workflow Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Distribution Fleet Dashboard
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Real-time status of 3 delivery lorries, route sales, and warehouse stock flow.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            onClick={onNavigateToLoading}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl shadow-sm transition text-xs"
          >
            <Truck className="w-4 h-4" />
            <span className="truncate">Morning Load</span>
          </button>
          <button
            onClick={onNavigateToBillEntry}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-black text-white font-semibold rounded-2xl shadow-sm transition text-xs"
          >
            <Receipt className="w-4 h-4" />
            <span className="truncate">Enter Bills</span>
          </button>
          <button
            onClick={onNavigateToSettlement}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold rounded-2xl shadow-2xs transition text-xs"
          >
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            <span className="truncate">Settlement</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Timeframe Filter
            </span>
            <span className="text-xs font-bold text-slate-900">
              Showing {getPresetLabel()} Analytics & Sales
            </span>
          </div>
        </div>

        {/* Date Filter Component */}
        <DateRangeFilter
          initialPreset="today"
          onRangeChange={handleDateRangeChange}
        />
      </div>

      {/* 3 Lorries Live Fleet Widget */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-blue-600" />
            3-Lorry Fleet Dispatch Status
          </span>
          <span className="text-xs text-slate-400">Route 1, Route 2 & Route 3</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats?.fleetStatus?.map((lorry) => {
            const isSettled = lorry.status === 'SETTLED';
            const isActive = lorry.status === 'ACTIVE';

            return (
              <div
                key={lorry.id}
                className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs hover:shadow-sm transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 block">
                        {lorry.vehicleNumber}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        {lorry.driverName}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${isSettled
                        ? 'bg-slate-100 text-slate-600'
                        : isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                      }`}
                  >
                    {lorry.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                  <Compass className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium text-slate-700">{lorry.routeName}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Floating Stock
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {lorry.floatingStockUnits} Units
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Period Sales
                    </span>
                    <span className="font-mono font-bold text-blue-600">
                      {formatMoney(lorry.todaySales)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Low Stock Urgent Banner */}
      {stats && stats.lowStockCount > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-2xl text-amber-800 shrink-0">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-base font-semibold text-amber-950">
                {stats.lowStockCount} Products Below Minimum Stock Threshold in Warehouse
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Items like {stats.lowStockItems.map(i => i.name).join(', ')} require inbound stock replenishment.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToInventory}
            className="px-4 py-2 bg-amber-900 hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition self-start sm:self-auto shrink-0"
          >
            Manage Warehouse Stock <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Financial Metric Cards with Active Timeframe Label */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-slate-200/70 p-6 rounded-3xl shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {getPresetLabel()} Sales
              </span>
              <div className="p-2 bg-blue-50 rounded-xl">
                <Coins className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {formatMoney(stats.revenueToday)}
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">From {stats.ordersTodayCount} bills recorded</p>
          </div>

          <div className="bg-white border border-slate-200/70 p-6 rounded-3xl shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {getPresetLabel()} Cash Handover
              </span>
              <div className="p-2 bg-emerald-50 rounded-xl">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-emerald-600 font-mono">
              {formatMoney(stats.cashToday)}
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">Cash collected from drivers</p>
          </div>

          <div className="bg-white border border-slate-200/70 p-6 rounded-3xl shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {getPresetLabel()} Credit
              </span>
              <div className="p-2 bg-amber-50 rounded-xl">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {formatMoney(stats.creditToday)}
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">Credit given on paper bills</p>
          </div>

          <div className="bg-white border border-slate-200/70 p-6 rounded-3xl shadow-2xs hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Receivables
              </span>
              <div className="p-2 bg-purple-50 rounded-xl">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {formatMoney(stats.totalOutstanding)}
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">All retail client balances</p>
          </div>
        </div>
      )}

      {/* Orders Table */}
      {stats && (
        <div className="bg-white border border-slate-200/70 rounded-3xl shadow-2xs overflow-hidden">
          <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {getPresetLabel()} Driver Sales Bills
              </h2>
              <p className="text-xs text-slate-400">Bills brought by drivers and saved in the system</p>
            </div>
            <button
              onClick={onNavigateToBillEntry}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Enter More Bills <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="px-7 py-4">Bill #</th>
                  <th className="px-6 py-4">Paper Slip #</th>
                  <th className="px-6 py-4">Lorry / Driver</th>
                  <th className="px-6 py-4">Retail Client</th>
                  <th className="px-6 py-4">Net Total</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-7 py-4 text-right">Invoice Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stats.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-7 py-16 text-center text-slate-400">
                      <p className="text-base font-semibold text-slate-700">No driver bills found for {getPresetLabel().toLowerCase()}.</p>
                      <p className="text-xs text-slate-400 mt-1">Try selecting another date range or enter new bills.</p>
                    </td>
                  </tr>
                ) : (
                  stats.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-7 py-4 font-mono font-bold text-slate-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-blue-600">
                        {order.paperBillNumber || '—'}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {order.lorry ? (
                          <div>
                            <span className="font-bold text-slate-800 block">{order.lorry.vehicleNumber}</span>
                            <span className="text-slate-400">{order.lorry.driverName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Warehouse Counter</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{order.customer.name}</p>
                        <p className="text-xs text-slate-400">{order.customer.city}</p>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 font-mono">
                        {formatMoney(order.netTotal)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${order.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                          }`}>
                          {order.paymentMethod} • {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-7 py-4 text-right">
                        <button
                          onClick={() => onViewInvoice(order)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1"
                          title="View & Print Bill Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" /> View Bill
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
