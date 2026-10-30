import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Customer, Route } from '../types';
import { CustomerService, RouteService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface CustomerModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  customer,
  isOpen,
  onClose,
  onSaved
}) => {
  const { currencyConfig } = useCurrency();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    phone: '',
    deliveryAddress: '',
    city: 'Local',
    routeId: '',
    pricingTier: 'STANDARD',
    discountPercentage: '0',
    creditLimit: '50000'
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      RouteService.getAll().then(setRoutes).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name,
        companyName: customer.companyName || '',
        phone: customer.phone,
        deliveryAddress: customer.deliveryAddress,
        city: customer.city,
        routeId: customer.routeId || '',
        pricingTier: customer.pricingTier,
        discountPercentage: customer.discountPercentage.toString(),
        creditLimit: customer.creditLimit.toString()
      });
    } else {
      setFormData({
        name: '',
        companyName: '',
        phone: '',
        deliveryAddress: '',
        city: 'Local',
        routeId: '',
        pricingTier: 'STANDARD',
        discountPercentage: '0',
        creditLimit: '50000'
      });
    }
    setError(null);
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.deliveryAddress) {
      setError('Please provide Client Name, Phone, and Delivery Address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (customer) {
        await CustomerService.update(customer.id, {
          name: formData.name,
          companyName: formData.companyName || null,
          phone: formData.phone,
          deliveryAddress: formData.deliveryAddress,
          city: formData.city,
          routeId: formData.routeId || null,
          pricingTier: formData.pricingTier as any,
          discountPercentage: parseFloat(formData.discountPercentage || '0'),
          creditLimit: parseFloat(formData.creditLimit || '50000')
        });
      } else {
        await CustomerService.create({
          name: formData.name,
          companyName: formData.companyName || null,
          phone: formData.phone,
          deliveryAddress: formData.deliveryAddress,
          city: formData.city,
          routeId: formData.routeId || null,
          pricingTier: formData.pricingTier as any,
          discountPercentage: parseFloat(formData.discountPercentage || '0'),
          creditLimit: parseFloat(formData.creditLimit || '50000')
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {customer ? 'Edit Client Profile' : 'Register New Retail Client'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-700 text-xs px-7 py-2.5 font-medium border-b border-rose-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-7 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Client / Store Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Apex Supermart & Provisions"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Company / Business Entity
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="e.g. Apex Retail Ltd"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Primary Phone *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+94 77 123 4567"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Delivery Address / Retail Outlet Location *
            </label>
            <input
              type="text"
              required
              value={formData.deliveryAddress}
              onChange={e => setFormData({ ...formData, deliveryAddress: e.target.value })}
              placeholder="e.g. 448 Galle Road, Colombo 03"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                City / Town
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                placeholder="Colombo"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Assigned Route (Lorry)
              </label>
              <select
                value={formData.routeId}
                onChange={e => setFormData({ ...formData, routeId: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              >
                <option value="">-- No Route Assigned --</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Pricing Tier
              </label>
              <select
                value={formData.pricingTier}
                onChange={e => {
                  const tier = e.target.value;
                  let defaultDiscount = '0';
                  if (tier === 'WHOLESALE') defaultDiscount = '10';
                  if (tier === 'VIP') defaultDiscount = '15';
                  setFormData({ ...formData, pricingTier: tier, discountPercentage: defaultDiscount });
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              >
                <option value="STANDARD">Standard</option>
                <option value="WHOLESALE">Wholesale (10%)</option>
                <option value="VIP">VIP (15%)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Discount (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.discountPercentage}
                onChange={e => setFormData({ ...formData, discountPercentage: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Credit Limit ({currencyConfig.symbol})
              </label>
              <input
                type="number"
                value={formData.creditLimit}
                onChange={e => setFormData({ ...formData, creditLimit: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
