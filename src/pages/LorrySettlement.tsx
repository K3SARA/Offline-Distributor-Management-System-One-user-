import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
  Boxes,
  FileCheck2,
  DollarSign,
  AlertTriangle,
  History,
  ArrowRight
} from 'lucide-react';
import { Lorry, LorryLoading } from '../types';
import { LorryService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface ReturnRow {
  productId: string;
  productName: string;
  unit: string;
  loadedQty: number;
  soldQty: number;
  freeQty: number;
  expectedRemaining: number;
  returnedQty: number;
}

export const LorrySettlement: React.FC = () => {
  const { formatMoney } = useCurrency();
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [selectedLorryId, setSelectedLorryId] = useState<string>('');
  const [activeLoading, setActiveLoading] = useState<LorryLoading | null>(null);
  const [returnRows, setReturnRows] = useState<ReturnRow[]>([]);
  const [cashHandover, setCashHandover] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadLorries();
  }, []);

  const loadLorries = async () => {
    try {
      setLoading(true);
      const list = await LorryService.getAll();
      setLorries(list);
      if (list.length > 0 && !selectedLorryId) {
        setSelectedLorryId(list[0].id);
        fetchLoading(list[0].id);
      }
    } catch (err: any) {
      setErrorMessage('Failed to load lorries.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoading = async (lorryId: string) => {
    try {
      const active = await LorryService.getCurrentLoading(lorryId);
      setActiveLoading(active);

      if (active) {
        const rows: ReturnRow[] = active.items.map(item => {
          const totalOutflow = item.soldQty + (item.freeQty || 0);
          const expected = Math.max(0, item.loadedQty - totalOutflow);
          return {
            productId: item.productId,
            productName: item.product.name,
            unit: item.product.unit,
            loadedQty: item.loadedQty,
            soldQty: item.soldQty,
            freeQty: item.freeQty || 0,
            expectedRemaining: expected,
            returnedQty: expected // Pre-populate with expected remaining
          };
        });
        setReturnRows(rows);
        setCashHandover(active.cashCollected.toString());
      } else {
        setReturnRows([]);
        setCashHandover('');
      }
    } catch (err) {
      setActiveLoading(null);
      setReturnRows([]);
    }
  };

  const handleLorrySelect = (lorryId: string) => {
    setSelectedLorryId(lorryId);
    setSuccessMessage(null);
    setErrorMessage(null);
    fetchLoading(lorryId);
  };

  const selectedLorry = lorries.find(l => l.id === selectedLorryId);

  const updateReturnedQty = (index: number, val: number) => {
    const updated = [...returnRows];
    updated[index].returnedQty = val;
    setReturnRows(updated);
  };

  const calculateTotalDiscrepancy = () => {
    return returnRows.reduce((acc, r) => {
      const diff = r.expectedRemaining - (r.returnedQty || 0);
      return acc + (diff > 0 ? diff : 0);
    }, 0);
  };

  const totalDiscrepancy = calculateTotalDiscrepancy();
  const expectedCash = activeLoading?.cashCollected || 0;
  const cashDifference = (parseFloat(cashHandover) || 0) - expectedCash;

  const handleCompleteSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoading) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setSubmitting(true);
      const payload = {
        loadingId: activeLoading.id,
        returns: returnRows.map(r => ({
          productId: r.productId,
          returnedQty: r.returnedQty || 0
        })),
        cashHandover: parseFloat(cashHandover) || 0,
        notes: notes.trim() || undefined
      };

      await LorryService.settleLorry(selectedLorryId, payload);
      setSuccessMessage(
        `Lorry ${selectedLorry?.vehicleNumber} day settlement completed! Unsold stock credited back to Central Warehouse.`
      );

      // Refresh
      await loadLorries();
      await fetchLoading(selectedLorryId);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Settlement failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F1F3F6] p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <RotateCcw className="w-4 h-4" />
            <span>Step 4: End-of-Day Reconciliation</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Lorry Day-End Settlement
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Compare morning loaded items against sales bills. Unsold items return to Central Warehouse.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lorry Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        {lorries.map((lorry) => {
          const isSelected = lorry.id === selectedLorryId;
          return (
            <button
              key={lorry.id}
              onClick={() => handleLorrySelect(lorry.id)}
              className={`text-left p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all ${isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600 ring-offset-2'
                  : 'bg-white text-slate-800 border-slate-200/80 hover:border-slate-300'
                }`}
            >
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-mono text-xs font-bold uppercase">{lorry.vehicleNumber}</span>
              </div>
              <div className="text-sm font-bold">{lorry.driverName}</div>
              <div className={`text-xs mt-0.5 sm:mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                {lorry.route?.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* Settlement Section */}
      {activeLoading ? (
        <form onSubmit={handleCompleteSettlement} className="space-y-4 sm:space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Morning Loaded
              </span>
              <span className="text-lg sm:text-2xl font-bold text-slate-900 mt-1 block font-mono">
                {activeLoading.totalLoadedItems} Units
              </span>
              <span className="text-xs text-slate-500 truncate block mt-0.5">Gate Pass: {activeLoading.loadingNumber}</span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Total Sold (Bills)
              </span>
              <span className="text-lg sm:text-2xl font-bold text-emerald-600 mt-1 block font-mono">
                {activeLoading.totalSoldItems} Units
              </span>
              <span className="text-xs text-slate-500 truncate block mt-0.5">
                {formatMoney(activeLoading.totalSalesAmount)} {activeLoading.totalFreeItems > 0 ? `(+${activeLoading.totalFreeItems} Free)` : ''}
              </span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Expected Cash
              </span>
              <span className="text-lg sm:text-2xl font-bold text-blue-600 mt-1 block font-mono">
                {formatMoney(activeLoading.cashCollected)}
              </span>
              <span className="text-xs text-slate-500 truncate block mt-0.5">Credit: {formatMoney(activeLoading.creditGiven)}</span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Stock Discrepancy
              </span>
              <span
                className={`text-lg sm:text-2xl font-bold mt-1 block font-mono ${totalDiscrepancy > 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}
              >
                {totalDiscrepancy} Units
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                {totalDiscrepancy === 0 ? 'Exact match' : 'Shortage'}
              </span>
            </div>
          </div>

          {/* Stock Reconciliation Table */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider">
                Item Reconciliation & Unsold Return
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Verify returned physical items. Returned units will be added back to warehouse stock.
              </p>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left text-sm min-w-[620px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3.5">Product Name</th>
                    <th className="py-3 px-3.5 text-center">Loaded</th>
                    <th className="py-3 px-3.5 text-center">Paid Sold</th>
                    <th className="py-3 px-3.5 text-center">Free Issued</th>
                    <th className="py-3 px-3.5 text-center">Expected Left</th>
                    <th className="py-3 px-3.5 text-center">Actual Returned</th>
                    <th className="py-3 px-3.5 text-right">Shortage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnRows.map((row, index) => {
                    const diff = row.expectedRemaining - (row.returnedQty || 0);
                    return (
                      <tr key={row.productId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-medium text-slate-900">
                          {row.productName}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                          {row.loadedQty} {row.unit}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600">
                          {row.soldQty} {row.unit}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-blue-600">
                          {row.freeQty > 0 ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                              +{row.freeQty} {row.unit}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {row.expectedRemaining} {row.unit}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={row.loadedQty}
                            value={row.returnedQty}
                            onChange={(e) => updateReturnedQty(index, parseInt(e.target.value, 10) || 0)}
                            className="w-20 sm:w-24 text-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {diff > 0 ? (
                            <span className="text-rose-600">-{diff} {row.unit}</span>
                          ) : diff < 0 ? (
                            <span className="text-amber-600">+{Math.abs(diff)}</span>
                          ) : (
                            <span className="text-emerald-600">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cash Handover & Closing Remarks */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs p-4 sm:p-6 space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
              Cash Handover & Audit Confirmation
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Expected Cash From Bills
                </label>
                <div className="px-3.5 py-2.5 bg-slate-100 rounded-xl font-mono font-bold text-slate-800 text-sm sm:text-base">
                  {formatMoney(expectedCash)}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Driver Handover Cash Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cashHandover}
                  onChange={(e) => setCashHandover(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono font-bold text-slate-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Cash Discrepancy
                </label>
                <div
                  className={`px-3.5 py-2.5 rounded-xl font-mono font-bold text-sm sm:text-base ${cashDifference < 0
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : cashDifference > 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                >
                  {cashDifference < 0
                    ? `Shortage: -${formatMoney(Math.abs(cashDifference))}`
                    : cashDifference > 0
                      ? `Excess: +${formatMoney(cashDifference)}`
                      : 'Exact Handover ($0.00 Diff)'}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Settlement Notes & Office Manager Sign-off
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Route 1 completed on time. Cash verified and deposited to safe."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Finalizing...' : 'Complete Settlement & Return Stock'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs p-8 sm:p-12 text-center space-y-3">
          <FileCheck2 className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm sm:text-base font-bold text-slate-800">
            No Active Loading Found for Lorry {selectedLorry?.vehicleNumber}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            This lorry has either not been loaded this morning, or has already completed and settled its daily run.
          </p>
        </div>
      )}
    </div>
  );
};
