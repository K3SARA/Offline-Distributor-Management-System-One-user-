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
  Filter,
  Boxes,
  Truck
} from 'lucide-react';
import { ProductService } from '../services/api';
import { Product } from '../types';
import { ProductModal } from '../components/ProductModal';
import { StockAdjustModal } from '../components/StockAdjustModal';
import { useCurrency } from '../context/CurrencyContext';

export const Inventory: React.FC = () => {
  const { formatMoney } = useCurrency();
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto h-full pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/80 pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Boxes className="w-4 h-4" />
            <span>Step 1: Central Warehouse Bulk Inward</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Central Warehouse Stock
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
            Bulk stock inward from suppliers. Items here will be loaded into the 3 lorries every morning.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-sm transition text-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Add New Product
          </button>
        </div>
      </div>

      {/* Controls Bar: Search & Low Stock Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search SKU, product name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0071E3] font-medium"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
              lowStockOnly
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {lowStockOnly ? 'Low Stock Only' : 'Filter Low Stock Alert'}
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200/70 rounded-2xl sm:rounded-3xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-left border-collapse text-xs min-w-[680px]">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="px-7 py-4">SKU</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Unit Price</th>
                <th className="px-6 py-4">Warehouse Stock</th>
                <th className="px-6 py-4">In Lorries</th>
                <th className="px-7 py-4 text-right">Inward / Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-7 py-16 text-center text-slate-400">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = p.currentStock <= p.minStockAlert;
                  const totalInLorries = p.lorryStocks?.reduce((acc, s) => acc + s.quantity, 0) || 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-7 py-4 font-mono font-bold text-slate-900">
                        {p.sku}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900 block">{p.name}</span>
                        <span className="text-[10px] text-slate-400">Pack: {p.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600">
                        <span className="px-2.5 py-1 bg-slate-100 rounded-lg">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 font-mono">
                        {formatMoney(p.unitPrice)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-xs px-3 py-1 rounded-full ${
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
                            <span className="text-[10px] font-semibold text-amber-600" title={`Alert at ≤ ${p.minStockAlert}`}>
                              (Low)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-semibold text-blue-600 flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-blue-500" />
                          {totalInLorries} {p.unit}
                        </span>
                      </td>
                      <td className="px-7 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openAdjustModal(p)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1 border border-emerald-200/60"
                        >
                          <ArrowDownRight className="w-3.5 h-3.5" /> Bulk Inward
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition inline-block align-middle"
                          title="Edit Details"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition inline-block align-middle"
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
