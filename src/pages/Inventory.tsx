import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ArrowDownRight, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  Package,
  Layers,
  Filter
} from 'lucide-react';
import { ProductService } from '../services/api';
import { Product } from '../types';
import { ProductModal } from '../components/ProductModal';
import { StockAdjustModal } from '../components/StockAdjustModal';
import { useCurrency } from '../context/CurrencyContext';

export const Inventory: React.FC = () => {
  const { formatCurrency } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

  const loadProducts = async () => {
    try {
      const data = await ProductService.getAll(lowStockOnly, search);
      setProducts(data);
    } catch (err) {
      console.error('Failed to load inventory', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [lowStockOnly, search]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product? Products with order history cannot be deleted.')) {
      try {
        await ProductService.delete(id);
        loadProducts();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to delete product');
      }
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const openAdjustModal = (product: Product) => {
    setAdjustingProduct(product);
    setIsAdjustModalOpen(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
            Inventory & Warehouse Stock
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Product catalog, stock reorder levels, and inbound shipment intake
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white font-medium rounded-2xl shadow-sm transition-all duration-150 text-base"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          Add New Product
        </button>
      </div>

      {/* Controls Bar: Search & Low Stock Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by SKU, product name, or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3] font-medium"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition ${
              lowStockOnly
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {lowStockOnly ? 'Showing Low Stock Only' : 'Filter Low Stock Alert'}
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200/70 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="px-7 py-4">SKU</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Unit Price</th>
                <th className="px-6 py-4">Cost Price</th>
                <th className="px-6 py-4">Current Stock</th>
                <th className="px-7 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-7 py-16 text-center text-slate-400">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = p.currentStock <= p.minStockAlert;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-7 py-4 font-mono font-bold text-slate-900">
                        {p.sku}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900 block">{p.name}</span>
                        <span className="text-xs text-slate-400">Pack: {p.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600">
                        <span className="px-2.5 py-1 bg-slate-100 rounded-lg">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {formatCurrency(p.unitPrice)}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {formatCurrency(p.costPrice)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-sm px-3 py-1 rounded-full ${
                              p.currentStock <= 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : isLow
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {p.currentStock} {p.unit}
                          </span>
                          {isLow && (
                            <span className="text-[11px] font-semibold text-amber-600" title={`Alert at ≤ ${p.minStockAlert}`}>
                              (Low)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-7 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openAdjustModal(p)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1 border border-emerald-200/60"
                        >
                          <ArrowDownRight className="w-3.5 h-3.5" /> Receive Stock
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition inline-block align-middle"
                          title="Edit Details"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition inline-block align-middle"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ProductModal
        isOpen={isProductModalOpen}
        product={editingProduct}
        onClose={() => setIsProductModalOpen(false)}
        onSaved={loadProducts}
      />

      <StockAdjustModal
        isOpen={isAdjustModalOpen}
        product={adjustingProduct}
        onClose={() => setIsAdjustModalOpen(false)}
        onAdjusted={loadProducts}
      />
    </div>
  );
};
