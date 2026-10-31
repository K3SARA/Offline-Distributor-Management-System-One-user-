import React, { useState } from 'react';
import {
  Menu,
  LayoutDashboard,
  Truck,
  Receipt,
  RotateCcw,
  Boxes,
  Users,
  BarChart3
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { LorryLoading } from './pages/LorryLoading';
import { BillEntry } from './pages/BillEntry';
import { LorrySettlement } from './pages/LorrySettlement';
import { Customers } from './pages/Customers';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { InvoiceModal } from './components/InvoiceModal';
import { CurrencyProvider, useCurrency, CURRENCIES } from './context/CurrencyContext';
import { Order } from './types';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);
  const { currency } = useCurrency();

  const bottomNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'lorry-loading', label: 'Load', icon: Truck },
    { id: 'bill-entry', label: 'Bills', icon: Receipt },
    { id: 'lorry-settlement', label: 'Settle', icon: RotateCcw },
    { id: 'menu', label: 'Menu', icon: Menu }
  ];

  const handleBottomNavClick = (id: string) => {
    if (id === 'menu') {
      setIsMobileDrawerOpen(true);
    } else {
      setCurrentTab(id);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F1F3F6] text-[#1D1D1F]">
      {/* Sidebar Navigation (Desktop persistent, Mobile drawer) */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Work Area */}
      <main className="flex-1 h-screen overflow-hidden flex flex-col min-w-0">
        {/* Mobile Top App Bar (visible on md:hidden) */}
        <header className="md:hidden bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-2 -ml-1 text-slate-700 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-2xs">
                <Truck className="w-4.5 h-4.5 stroke-[2.2]" />
              </div>
              <span className="font-bold text-slate-900 text-base tracking-tight">
                Distributor Pro
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
              {CURRENCIES[currency]?.symbol || 'Rs.'}
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Fleet Active" />
          </div>
        </header>

        {/* Dynamic Page Views with bottom padding for mobile bar */}
        <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {currentTab === 'dashboard' && (
            <Dashboard
              onNavigateToLoading={() => setCurrentTab('lorry-loading')}
              onNavigateToBillEntry={() => setCurrentTab('bill-entry')}
              onNavigateToSettlement={() => setCurrentTab('lorry-settlement')}
              onNavigateToInventory={() => setCurrentTab('inventory')}
              onViewInvoice={(order) => setActiveInvoiceOrder(order)}
            />
          )}

          {currentTab === 'inventory' && <Inventory />}

          {currentTab === 'lorry-loading' && <LorryLoading />}

          {currentTab === 'bill-entry' && (
            <BillEntry onViewInvoice={(order) => setActiveInvoiceOrder(order)} />
          )}

          {currentTab === 'lorry-settlement' && <LorrySettlement />}

          {currentTab === 'customers' && (
            <Customers onViewInvoice={(order) => setActiveInvoiceOrder(order)} />
          )}

          {currentTab === 'reports' && <Reports />}

          {currentTab === 'settings' && <Settings />}
        </div>

        {/* Mobile Bottom Navigation Bar (md:hidden) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around z-30 shadow-lg">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleBottomNavClick(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-150 min-w-[56px] ${
                  isActive
                    ? 'text-blue-600 font-bold'
                    : 'text-slate-500 hover:text-slate-900 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className="text-[11px] font-semibold mt-0.5 tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </main>

      {/* Delivery Note & Invoice Preview Modal */}
      <InvoiceModal
        order={activeInvoiceOrder}
        onClose={() => setActiveInvoiceOrder(null)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <CurrencyProvider>
      <AppContent />
    </CurrencyProvider>
  );
};

export default App;
