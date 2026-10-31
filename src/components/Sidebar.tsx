import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  Receipt,
  RotateCcw,
  Users,
  BarChart3,
  ShieldCheck,
  Database,
  Coins,
  Settings as SettingsIcon,
  TrendingUp,
  X
} from 'lucide-react';
import { useCurrency, CURRENCIES, CurrencyCode } from '../context/CurrencyContext';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  isOpen = false,
  onClose
}) => {
  const { currency, setCurrency } = useCurrency();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Warehouse Stock', icon: Boxes, badge: 'Step 1' },
    { id: 'lorry-loading', label: 'Morning Lorry Load', icon: Truck, badge: 'Step 2' },
    { id: 'bill-entry', label: 'Office Bill Entry', icon: Receipt, badge: 'Step 3' },
    { id: 'lorry-settlement', label: 'Day Settlement', icon: RotateCcw, badge: 'Step 4' },
    { id: 'customers', label: 'Clients & Accounts', icon: Users },
    { id: 'pnl', label: 'Profit & Loss', icon: TrendingUp, badge: 'P&L' },
    { id: 'reports', label: 'Reports & Audit', icon: BarChart3 },
    { id: 'settings', label: 'Fleet & Settings', icon: SettingsIcon }
  ];

  const handleItemClick = (id: string) => {
    onTabChange(id);
    if (onClose) {
      onClose();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full select-none">
      <div>
        {/* App Title & Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm shrink-0">
              <Truck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight leading-snug">
                Distributor Pro
              </h1>
              <span className="text-xs font-medium text-slate-400 block -mt-0.5">
                3-Lorry Fleet Edition
              </span>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 md:hidden"
              aria-label="Close Navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-5 sm:px-6 pt-3 pb-1">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/90 border border-emerald-200/60 rounded-xl text-xs font-semibold text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            3 Routes Active
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-3 sm:p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all duration-150 text-left ${
                  isActive
                    ? 'bg-[#0071E3] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status & Currency Selector */}
      <div className="p-4 sm:p-5 border-t border-slate-100 space-y-3">
        {/* Currency Switcher */}
        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-blue-600" /> Currency
            </span>
            <span className="text-blue-600 font-bold">{CURRENCIES[currency].symbol}</span>
          </div>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3] shadow-2xs cursor-pointer"
          >
            <option value="LKR">LKR (Rs. - Sri Lanka)</option>
            <option value="USD">USD ($ - US Dollar)</option>
            <option value="INR">INR (₹ - Indian Rupee)</option>
            <option value="EUR">EUR (€ - Euro)</option>
            <option value="GBP">GBP (£ - British Pound)</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
          <span className="flex items-center gap-1.5 font-medium">
            <Database className="w-3.5 h-3.5 text-slate-400" /> Offline DB
          </span>
          <span className="font-mono text-xs text-slate-500">v1.2.0</span>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          <span>Local Engine Active</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (md and up) */}
      <aside className="hidden md:flex w-64 bg-white/80 backdrop-blur-md border-r border-slate-200/80 flex-col h-screen shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (under md) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Dimmed Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer Slide-in Panel */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl z-10 flex flex-col animate-slideIn">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
