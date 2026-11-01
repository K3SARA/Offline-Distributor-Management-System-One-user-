import React, { useState } from 'react';
import {
  Smartphone,
  ShieldCheck,
  Lock,
  User as UserIcon,
  ArrowRight,
  Truck,
  AlertCircle,
  Eye,
  EyeOff,
  Building2
} from 'lucide-react';
import { AuthService } from '../services/api';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  // Determine default tab: if mobile viewport or url param '?mode=rep', default to 'REP'
  const [activeTab, setActiveTab] = useState<'REP' | 'ADMIN'>(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth <= 768;
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mode') === 'rep' || urlParams.get('role') === 'rep' || isMobile) {
        return 'REP';
      }
    }
    return 'REP'; // Route Rep by default for quick mobile access
  });

  const [username, setUsername] = useState('rep1');
  const [password, setPassword] = useState('rep123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Switch tabs and pre-clear or set helper
  const handleTabSwitch = (tab: 'REP' | 'ADMIN') => {
    setActiveTab(tab);
    setErrorMessage(null);
    if (tab === 'REP') {
      setUsername('rep1');
      setPassword('rep123');
    } else {
      setUsername('admin');
      setPassword('admin123');
    }
  };

  // Quick preset helper
  const setQuickCredentials = (u: string, p: string, tab: 'REP' | 'ADMIN') => {
    setActiveTab(tab);
    setUsername(u);
    setPassword(p);
    setErrorMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await AuthService.login({
        username: username.trim(),
        password: password.trim()
      });

      const user = response.user;
      localStorage.setItem('distributor_auth_user', JSON.stringify(user));
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('Login failure:', err);
      setErrorMessage(
        err.response?.data?.error || 'Invalid credentials. Please verify username and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-slate-100 p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-[-15%] left-[-10%] w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-750 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/25 mb-3">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Distributor <span className="text-blue-400">Pro</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Offline-First Enterprise Route Distribution System
          </p>
        </div>

        {/* Dual Mode Switcher: Rep Mobile vs Admin Dashboard */}
        <div className="grid grid-cols-2 p-1 bg-slate-800/80 border border-slate-700/60 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => handleTabSwitch('REP')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'REP'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Rep Mobile</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('ADMIN')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'ADMIN'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Backoffice</span>
          </button>
        </div>

        {/* Context Hint */}
        <div className="mb-5 text-center">
          {activeTab === 'REP' ? (
            <div className="bg-blue-950/40 border border-blue-800/30 rounded-lg p-2.5 text-xs text-blue-300 flex items-center justify-center gap-2">
              <Truck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Route Sales Reps • Mobile 5-Step Billing Portal</span>
            </div>
          ) : (
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-2.5 text-xs text-slate-300 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Owner & Admin • Full Desktop System Access</span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800/50 rounded-xl text-red-200 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {activeTab === 'REP' ? 'Rep ID / Username' : 'Admin Username'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={activeTab === 'REP' ? 'e.g. rep1' : 'e.g. admin'}
                required
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password / Access PIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all duration-200 mt-2 ${
              activeTab === 'REP'
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            } ${loading ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.99]'}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating...</span>
              </span>
            ) : (
              <>
                <span>Sign In to {activeTab === 'REP' ? 'Rep Billing' : 'Admin'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Fillers for Instant Field Testing */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2 text-center">
            Quick-Fill Field Accounts
          </p>

          {activeTab === 'REP' ? (
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setQuickCredentials('rep1', 'rep123', 'REP')}
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 text-[11px] font-medium text-slate-300 text-center transition"
              >
                <div className="font-bold text-blue-400">Rep 1</div>
                <div className="text-[10px] text-slate-400 truncate">Route 1 (Sunil)</div>
              </button>
              <button
                type="button"
                onClick={() => setQuickCredentials('rep2', 'rep123', 'REP')}
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 text-[11px] font-medium text-slate-300 text-center transition"
              >
                <div className="font-bold text-blue-400">Rep 2</div>
                <div className="text-[10px] text-slate-400 truncate">Route 2 (Kamal)</div>
              </button>
              <button
                type="button"
                onClick={() => setQuickCredentials('rep3', 'rep123', 'REP')}
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 text-[11px] font-medium text-slate-300 text-center transition"
              >
                <div className="font-bold text-blue-400">Rep 3</div>
                <div className="text-[10px] text-slate-400 truncate">Route 3 (Nimal)</div>
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setQuickCredentials('admin', 'admin123', 'ADMIN')}
                className="w-full p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Fill Default Admin Credentials (admin / admin123)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer System Info */}
      <div className="mt-6 text-center text-xs text-slate-500 font-mono">
        Distributor Pro v1.0 • Server: http://0.0.0.0:4812
      </div>
    </div>
  );
};
