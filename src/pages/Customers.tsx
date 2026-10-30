import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  Edit3, 
  ShoppingBag, 
  CreditCard,
  Building2,
  Compass,
  X
} from 'lucide-react';
import { CustomerService, RouteService } from '../services/api';
import { Customer, Order, Route } from '../types';
import { CustomerModal } from '../components/CustomerModal';
import { useCurrency } from '../context/CurrencyContext';

export const Customers: React.FC<{ onViewInvoice?: (order: Order) => void }> = ({ onViewInvoice }) => {
  const { formatMoney } = useCurrency();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals & History drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadData = async () => {
    try {
      const [custList, routeList] = await Promise.all([
        CustomerService.getAll(search, selectedRouteId !== 'ALL' ? selectedRouteId : undefined),
        RouteService.getAll()
      ]);
      setCustomers(custList);
      setRoutes(routeList);
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedRouteId]);

  const openAddModal = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setIsModalOpen(true);
  };

  const openHistory = async (cust: Customer) => {
    setHistoryCustomer(cust);
    setLoadingHistory(true);
    try {
      const orders = await CustomerService.getOrderHistory(cust.id);
      setCustomerOrders(orders);
    } catch (err) {
      console.error('Failed to load customer order history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Retail Accounts & Routes
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Retail store directory across Route 1, Route 2 & Route 3 with credit limits and outstanding receivables.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-sm transition text-xs"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Register New Client
        </button>
      </div>

      {/* Search & Route Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by client name, code, phone, or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0071E3] font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedRouteId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedRouteId === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Routes
          </button>
          {routes.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRouteId(r.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedRouteId === r.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r.code}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((c) => (
          <div
            key={c.id}
            className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs hover:shadow-sm transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-mono font-bold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-lg">
                  {c.code}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    c.pricingTier === 'VIP'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : c.pricingTier === 'WHOLESALE'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {c.pricingTier} ({c.discountPercentage}%)
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 leading-snug">{c.name}</h3>
              {c.companyName && (
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" /> {c.companyName}
                </p>
              )}

              {c.route && (
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-lg">
                  <Compass className="w-3 h-3" />
                  <span>{c.route.name}</span>
                </div>
              )}

              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{c.phone}</span>
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{c.deliveryAddress}, {c.city}</span>
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 mt-6 pt-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Balance Due</span>
                <span className={`text-base font-bold font-mono ${c.outstandingBalance > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {formatMoney(c.outstandingBalance)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openHistory(c)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                  title="View Orders History"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Orders
                </button>
                <button
                  onClick={() => openEditModal(c)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
                  title="Edit Client"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* History Drawer Modal */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-xl p-8 overflow-y-auto space-y-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-mono font-bold text-slate-400">{historyCustomer.code}</span>
                  <h2 className="text-2xl font-bold text-slate-900">{historyCustomer.name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{historyCustomer.deliveryAddress}, {historyCustomer.city}</p>
                </div>
                <button
                  onClick={() => setHistoryCustomer(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-6 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Sales History & Bills ({customerOrders.length})
                </h3>

                {loadingHistory ? (
                  <p className="text-sm text-slate-400">Loading order records...</p>
                ) : customerOrders.length === 0 ? (
                  <p className="text-sm text-slate-400">No orders logged for this client yet.</p>
                ) : (
                  <div className="space-y-3">
                    {customerOrders.map(order => (
                      <div
                        key={order.id}
                        className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-mono font-bold text-sm text-slate-900">{order.orderNumber}</p>
                          {order.paperBillNumber && (
                            <p className="text-xs text-blue-600 font-mono">Slip: {order.paperBillNumber}</p>
                          )}
                          <p className="text-xs text-slate-500">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 font-mono">{formatMoney(order.netTotal)}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {order.paymentStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Add/Edit Modal */}
      <CustomerModal
        isOpen={isModalOpen}
        customer={editingCustomer}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadData}
      />
    </div>
  );
};
