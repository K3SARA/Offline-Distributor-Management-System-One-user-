import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Users,
  BarChart3,
  ShieldCheck,
  Database,
  Coins
} from 'lucide-react';
import { useCurrency, CURRENCIES, CurrencyCode } from '../context/CurrencyContext';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { currency, setCurrency } = useCurrency();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
    { id: 'customers', label: 'Clients & Accounts', icon: Users },
    { id: 'reports', label: 'Reports & Audit', icon: BarChart3 }
  ];

  return (
    <aside className="w-64 bg-white/80 backdrop-blur-md border-r border-slate-200/80 flex flex-col justify-between select-none h-screen shrink-0">
      <div>
        {/* Apple Style App Title */}
        <div className="p-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm">
              <Boxes className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900 text-base tracking-tight leading-tight">
                Distributor Pro
              </h1>
              <span className="text-[11px] font-medium text-slate-400">
                Samantha Distributors
              </span>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-2 px-2.5 py-1 bg-emerald-50/80 border border-emerald-200/60 rounded-xl text-[11px] font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Offline Local Engine Active
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-150 text-left ${isActive
                    ? 'bg-[#0071E3] text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status & Currency Selector */}
      <div className="p-5 border-t border-slate-100 space-y-3.5">
        {/* Currency Switcher */}
        <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-blue-600" /> Currency
            </span>
            <span className="text-blue-600 font-bold">{CURRENCIES[currency].symbol}</span>
          </div>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3] shadow-2xs cursor-pointer"
          >
            <option value="LKR">LKR (Rs. - Sri Lanka)</option>
            <option value="USD">USD ($ - US Dollar)</option>
            <option value="INR">INR (₹ - Indian Rupee)</option>
            <option value="EUR">EUR (€ - Euro)</option>
            <option value="GBP">GBP (£ - British Pound)</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-400" /> SQLite Local DB
          </span>
          <span className="font-mono text-[10px] text-slate-500">v1.0.0</span>
        </div>
        <div className="text-[11px] text-slate-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          <span>Local Data Encrypted</span>
        </div>
      </div>
    </aside>
  );
};
