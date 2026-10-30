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
  X
} from 'lucide-react';
import { CustomerService } from '../services/api';
import { Customer, Order } from '../types';
import { CustomerModal } from '../components/CustomerModal';
import { useCurrency } from '../context/CurrencyContext';

export const Customers: React.FC<{ onViewInvoice?: (order: Order) => void }> = ({ onViewInvoice }) => {
  const { formatCurrency } = useCurrency();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals & History drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadCustomers = async () => {
    try {
      const data = await CustomerService.getAll(search);
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search]);

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
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
            Clients & Distributors
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Accounts database, delivery addresses, pricing tier profiles, and receivables
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white font-medium rounded-2xl shadow-sm transition-all duration-150 text-base"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          Register New Client
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by client name, code, phone, or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3] font-medium"
          />
        </div>
        <span className="text-xs text-slate-400 font-medium">
          {customers.length} Accounts Registered
        </span>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((c) => (
          <div
            key={c.id}
            className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition flex flex-col justify-between"
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
                <span className={`text-base font-bold ${c.outstandingBalance > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {formatCurrency(c.outstandingBalance)}
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

      {/* Customer Modal */}
      <CustomerModal
        isOpen={isModalOpen}
        customer={editingCustomer}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadCustomers}
      />

      {/* Order History Drawer */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{historyCustomer.name}</h3>
                <p className="text-xs text-slate-400">Order History & Fulfillment Slips</p>
              </div>
              <button
                onClick={() => setHistoryCustomer(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {loadingHistory ? (
                <p className="text-center text-sm text-slate-400 py-10">Loading history...</p>
              ) : customerOrders.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-10">No orders placed by this client yet.</p>
              ) : (
                customerOrders.map(order => (
                  <div key={order.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono font-bold text-slate-900">{order.orderNumber}</span>
                      <span className="text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      {order.items.map(item => (
                        <div key={item.id} className="flex justify-between">
                          <span>{item.quantity}x {item.product.name}</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(item.lineTotal)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
                      <span>Total: {formatCurrency(order.netTotal)}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {order.status}
                      </span>
                    </div>

                    {onViewInvoice && (
                      <button
                        onClick={() => {
                          onViewInvoice({ ...order, customer: historyCustomer });
                        }}
                        className="w-full mt-2 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition"
                      >
                        Print Delivery Note
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
