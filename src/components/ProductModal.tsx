import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Product } from '../types';
import { ProductService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onSaved
}) => {
  const { currencyConfig } = useCurrency();
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Beverages',
    unit: 'Case',
    unitPrice: '',
    costPrice: '',
    currentStock: '0',
    minStockAlert: '10',
    freeRatioBuy: '0',
    freeRatioGet: '0',
    isRawMaterial: false
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku,
        name: product.name,
        category: product.category,
        unit: product.unit,
        unitPrice: product.unitPrice.toString(),
        costPrice: product.costPrice.toString(),
        currentStock: product.currentStock.toString(),
        minStockAlert: product.minStockAlert.toString(),
        freeRatioBuy: (product.freeRatioBuy || 0).toString(),
        freeRatioGet: (product.freeRatioGet || 0).toString(),
        isRawMaterial: Boolean(product.isRawMaterial)
      });
    } else {
      setFormData({
        sku: '',
        name: '',
        category: 'Beverages',
        unit: 'Case',
        unitPrice: '',
        costPrice: '',
        currentStock: '0',
        minStockAlert: '10',
        freeRatioBuy: '0',
        freeRatioGet: '0',
        isRawMaterial: false
      });
    }
    setError(null);
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku || !formData.unitPrice) {
      setError('Please provide SKU, Product Name, and Unit Selling Price.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (product) {
        await ProductService.update(product.id, {
          sku: formData.sku,
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          unitPrice: parseFloat(formData.unitPrice),
          costPrice: parseFloat(formData.costPrice || '0'),
          minStockAlert: parseInt(formData.minStockAlert, 10),
          freeRatioBuy: parseInt(formData.freeRatioBuy, 10) || 0,
          freeRatioGet: parseInt(formData.freeRatioGet, 10) || 0,
          isRawMaterial: formData.isRawMaterial
        });
      } else {
        await ProductService.create({
          sku: formData.sku,
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          unitPrice: parseFloat(formData.unitPrice),
          costPrice: parseFloat(formData.costPrice || '0'),
          currentStock: parseInt(formData.currentStock, 10),
          minStockAlert: parseInt(formData.minStockAlert, 10),
          freeRatioBuy: parseInt(formData.freeRatioBuy, 10) || 0,
          freeRatioGet: parseInt(formData.freeRatioGet, 10) || 0,
          isRawMaterial: formData.isRawMaterial
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900">
            {product ? 'Edit Product Details' : 'Add New Inventory Item'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-700 text-xs px-5 sm:px-7 py-2.5 font-medium border-b border-rose-100 shrink-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-3.5 sm:space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                SKU / Barcode *
              </label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder="e.g. BEV-003"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g. Beverages"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Product Description / Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Premium Cold Brew Coffee"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Unit Type
              </label>
              <select
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              >
                <option value="Case">Case</option>
                <option value="Box">Box</option>
                <option value="Carton">Carton</option>
                <option value="Bag">Bag</option>
                <option value="Pack">Pack</option>
                <option value="Unit">Unit</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Sale Price ({currencyConfig.symbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.unitPrice}
                onChange={e => setFormData({ ...formData, unitPrice: e.target.value })}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Cost Price ({currencyConfig.symbol})
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.costPrice}
                onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            {!product && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Starting Stock
                </label>
                <input
                  type="number"
                  value={formData.currentStock}
                  onChange={e => setFormData({ ...formData, currentStock: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                />
              </div>
            )}
            <div className={product ? 'col-span-2' : ''}>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Low Stock Warning Level
              </label>
              <input
                type="number"
                value={formData.minStockAlert}
                onChange={e => setFormData({ ...formData, minStockAlert: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
          </div>

          {/* Trade Promotion / Free Issue Scheme */}
          <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Trade Promotion Scheme (Free Issue Offer)
              </span>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-100/70 px-2 py-0.5 rounded-full">
                Optional
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Buy Target (Units)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.freeRatioBuy}
                  onChange={e => setFormData({ ...formData, freeRatioBuy: e.target.value })}
                  placeholder="e.g. 10"
                  className="w-full bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Get Free (Units)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.freeRatioGet}
                  onChange={e => setFormData({ ...formData, freeRatioGet: e.target.value })}
                  placeholder="e.g. 1"
                  className="w-full bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              {parseInt(formData.freeRatioBuy, 10) > 0 && parseInt(formData.freeRatioGet, 10) > 0
                ? `Active offer: Buy ${formData.freeRatioBuy} get ${formData.freeRatioGet} Free. Office Bill Entry will auto-suggest free units.`
                : 'No default offer. Free issues can still be entered manually during bill entry.'}
            </p>
          </div>

          {/* Raw Material / Component Flag */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Raw Material / Manufacturing Component
              </span>
              <span className="text-[11px] text-slate-500">
                Ingredient or packaging item consumed in Manufacturing BOM production runs.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isRawMaterial}
                onChange={(e) => setFormData({ ...formData, isRawMaterial: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
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
              className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-sm font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
