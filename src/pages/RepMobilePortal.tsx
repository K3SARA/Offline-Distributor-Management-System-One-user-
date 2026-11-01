import React, { useState } from 'react';
import {
  Smartphone,
  LogOut,
  Truck,
  User as UserIcon,
  MapPin,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { User, Order } from '../types';
import { RepBilling } from './RepBilling';
import { InvoiceModal } from '../components/InvoiceModal';

interface RepMobilePortalProps {
  user: User;
  onLogout: () => void;
}

export const RepMobilePortal: React.FC<RepMobilePortalProps> = ({ user, onLogout }) => {
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen w-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] overflow-x-hidden">
      {/* Mobile-Native Rep Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Rep Profile Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-slate-900 truncate">
                  {user.fullName || user.username}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  REP
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                {user.lorry ? (
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    <span>{user.lorry.vehicleNumber}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 truncate">{user.lorry.routeName || 'Assigned Route'}</span>
                  </span>
                ) : (
                  <span className="text-slate-400">All Warehouse Stock</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{todayFormatted}</span>
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-250 bg-slate-50 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-xs font-semibold text-slate-600 transition shadow-sm"
              title="Log out of Rep account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Billing Body (Pure 5-Step Single Page) */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-2 sm:p-4 pb-12">
        <RepBilling
          initialLorryId={user.lorryId || undefined}
          onViewInvoice={order => setActiveInvoiceOrder(order)}
          onExitToMenu={() => setShowLogoutConfirm(true)}
        />
      </main>

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Log Out of Rep Portal?</h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to exit your mobile route billing session?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md shadow-red-600/25 transition"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal for Immediate Printing on Mobile */}
      {activeInvoiceOrder && (
        <InvoiceModal
          order={activeInvoiceOrder}
          onClose={() => setActiveInvoiceOrder(null)}
        />
      )}
    </div>
  );
};
