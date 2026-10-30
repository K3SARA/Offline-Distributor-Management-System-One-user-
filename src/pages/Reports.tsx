import React, { useState, useEffect } from 'react';
import {
  Download,
  Printer,
  FileText,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Calendar,
  Users,
  Boxes,
  Truck,
  Compass,
  RotateCcw
} from 'lucide-react';
import { ReportService } from '../services/api';
import { StockMovement, Customer, LorryLoading } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { DateRangeFilter, DatePreset } from '../components/DateRangeFilter';

export const Reports: React.FC = () => {
  const { formatMoney } = useCurrency();
  const [activeTab, setActiveTab] = useState<'LORRIES' | 'ROUTES' | 'SALES' | 'STOCK' | 'BALANCES'>('LORRIES');
  const [loading, setLoading] = useState(false);

  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  // Data
  const [lorryLoadings, setLorryLoadings] = useState<LorryLoading[]>([]);
  const [routeSummaries, setRouteSummaries] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [balancesData, setBalancesData] = useState<any>(null);

  useEffect(() => {
    loadActiveReport();
  }, [activeTab, dateRange]);

  const loadActiveReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'LORRIES') {
        const data = await ReportService.getLorryPerformance(dateRange.from, dateRange.to);
        setLorryLoadings(data);
      } else if (activeTab === 'ROUTES') {
        const data = await ReportService.getRouteSales(dateRange.from, dateRange.to);
        setRouteSummaries(data);
      } else if (activeTab === 'SALES') {
        const data = await ReportService.getSalesSummary(dateRange.from, dateRange.to);
        setSalesData(data);
      } else if (activeTab === 'STOCK') {
        const movements = await ReportService.getStockMovements(undefined, 100, dateRange.from, dateRange.to);
        setStockMovements(movements);
      } else if (activeTab === 'BALANCES') {
        const balances = await ReportService.getCustomerBalances();
        setBalancesData(balances);
      }
    } catch (err) {
      console.error('Failed to load report data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (range: { from: string; to: string; preset: DatePreset }) => {
    setDatePreset(range.preset);
    setDateRange({ from: range.from, to: range.to });
  };

  const getPresetLabel = () => {
    switch (datePreset) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'thisWeek':
        return 'This Week';
      case 'thisMonth':
        return 'This Month';
      case 'custom':
        return 'Custom Date Range';
      default:
        return 'Period';
    }
  };

  const exportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeTab === 'LORRIES') {
      csvContent += 'Loading Number,Date,Lorry,Driver,Route,Status,Loaded Units,Sold Units,Returned Units,Sales Amount,Cash Collected\n';
      lorryLoadings.forEach((l) => {
        csvContent += `"${l.loadingNumber}","${new Date(l.date).toLocaleDateString()}","${l.lorry.vehicleNumber}","${l.lorry.driverName}","${l.lorry.route?.name || ''}","${l.status}",${l.totalLoadedItems},${l.totalSoldItems},${l.totalReturnedItems},${l.totalSalesAmount},${l.cashCollected}\n`;
      });
    } else if (activeTab === 'ROUTES') {
      csvContent += 'Route Code,Route Name,Driver / Lorry,Customers,Total Bills,Total Sales,Cash Collected,Credit Given\n';
      routeSummaries.forEach((r) => {
        csvContent += `"${r.code}","${r.name}","${r.lorry?.vehicleNumber || ''}",${r.customerCount},${r.totalBills},${r.totalSales},${r.totalCash},${r.totalCredit}\n`;
      });
    } else if (activeTab === 'SALES' && salesData?.orders) {
      csvContent += 'Bill Number,Paper Slip,Date,Client,Lorry,Subtotal,Discount,Net Total,Status\n';
      salesData.orders.forEach((o: any) => {
        csvContent += `"${o.orderNumber}","${o.paperBillNumber || ''}","${new Date(o.createdAt).toLocaleDateString()}","${o.customer.name}","${o.lorry?.vehicleNumber || 'Warehouse'}",${o.subtotal},${o.discountAmount},${o.netTotal},"${o.status}"\n`;
      });
    } else if (activeTab === 'STOCK') {
      csvContent += 'Date,SKU,Product Name,Type,Quantity,Reference ID,Notes\n';
      stockMovements.forEach((m) => {
        csvContent += `"${new Date(m.createdAt).toLocaleDateString()}","${m.product.sku}","${m.product.name}","${m.type}",${m.quantity},"${m.referenceId || ''}","${m.notes || ''}"\n`;
      });
    } else if (activeTab === 'BALANCES' && balancesData?.customers) {
      csvContent += 'Customer Code,Name,Phone,Pricing Tier,Credit Limit,Outstanding Balance\n';
      balancesData.customers.forEach((c: Customer) => {
        csvContent += `"${c.code}","${c.name}","${c.phone}","${c.pricingTier}",${c.creditLimit},${c.outstandingBalance}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `distributor_report_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-7 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Reports & Fleet Audit
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Reconciliation sheets for 3 lorries, route analysis, driver bills, and warehouse stock flow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="px-4 py-2.5 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl shadow-2xs transition text-xs flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white font-semibold rounded-2xl shadow-sm transition text-xs flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>
      </div>

      {/* Toolbar: Report Tabs & Date Range Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        {/* Report Tabs */}
        <div className="flex gap-1.5 bg-slate-200/60 p-1.5 rounded-2xl w-fit flex-wrap">
          <button
            onClick={() => setActiveTab('LORRIES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${activeTab === 'LORRIES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Truck className="w-3.5 h-3.5 text-blue-600" /> Lorry Settlement Audit
          </button>
          <button
            onClick={() => setActiveTab('ROUTES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${activeTab === 'ROUTES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Compass className="w-3.5 h-3.5 text-emerald-600" /> Route Analysis
          </button>
          <button
            onClick={() => setActiveTab('SALES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${activeTab === 'SALES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-600" /> Driver Bills
          </button>
          <button
            onClick={() => setActiveTab('STOCK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${activeTab === 'STOCK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-600" /> Stock Movements
          </button>
          <button
            onClick={() => setActiveTab('BALANCES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${activeTab === 'BALANCES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-600" /> Receivables
          </button>
        </div>

        {/* Date Filter (Not applicable to static balances) */}
        {activeTab !== 'BALANCES' && (
          <DateRangeFilter
            initialPreset="today"
            onRangeChange={handleDateRangeChange}
          />
        )}
      </div>

      {/* REPORT CONTENT AREA */}
      <div className="bg-white border border-slate-200/70 rounded-3xl shadow-2xs p-8 space-y-6">
        {/* Printable Report Header */}
        <div className="border-b border-slate-100 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {activeTab === 'LORRIES' && 'Lorry Morning Load & Evening Settlement Audit'}
                {activeTab === 'ROUTES' && '3 Routes Distribution Performance Analysis'}
                {activeTab === 'SALES' && 'Daily Driver Sales Bills Log'}
                {activeTab === 'STOCK' && 'Central Warehouse Stock Movements (Inbounds, Loads, Returns)'}
                {activeTab === 'BALANCES' && 'Route Retail Customer Credit Statements'}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span>Filter: <strong>{getPresetLabel()}</strong></span>
                <span>•</span>
                <span>Generated: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 1. LORRIES REPORT */}
        {activeTab === 'LORRIES' && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="p-3">Gate Pass #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Lorry / Driver</th>
                    <th className="p-3">Route</th>
                    <th className="p-3 text-center">Loaded</th>
                    <th className="p-3 text-center">Sold</th>
                    <th className="p-3 text-center">Returned</th>
                    <th className="p-3 text-right">Sales Value</th>
                    <th className="p-3 text-right">Cash Handover</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lorryLoadings.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        No lorry loadings recorded for {getPresetLabel().toLowerCase()}.
                      </td>
                    </tr>
                  ) : (
                    lorryLoadings.map((load) => (
                      <tr key={load.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-bold text-slate-900">{load.loadingNumber}</td>
                        <td className="p-3 text-slate-500 font-mono">
                          {new Date(load.date).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-800 block">{load.lorry.vehicleNumber}</span>
                          <span className="text-slate-400">{load.lorry.driverName}</span>
                        </td>
                        <td className="p-3 font-medium text-slate-700">{load.lorry.route?.name || '—'}</td>
                        <td className="p-3 text-center font-mono font-bold text-slate-900">{load.totalLoadedItems}</td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-600">{load.totalSoldItems}</td>
                        <td className="p-3 text-center font-mono font-bold text-blue-600">{load.totalReturnedItems}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">{formatMoney(load.totalSalesAmount)}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600">{formatMoney(load.cashCollected)}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${load.status === 'SETTLED'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-blue-50 text-blue-700'
                              }`}
                          >
                            {load.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. ROUTES REPORT */}
        {activeTab === 'ROUTES' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {routeSummaries.map((route) => (
                <div key={route.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-600">{route.code}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                      {route.customerCount} Outlets
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{route.name}</h3>
                  <div className="text-xs text-slate-500">
                    Lorry: <strong className="text-slate-800">{route.lorry?.vehicleNumber || 'Unassigned'}</strong> ({route.lorry?.driverName || ''})
                  </div>
                  <div className="pt-2 border-t border-slate-200/70 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Period Sales</span>
                      <span className="font-mono font-bold text-slate-900">{formatMoney(route.totalSales)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Cash / Credit</span>
                      <span className="font-mono font-bold text-emerald-600">{formatMoney(route.totalCash)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. SALES REPORT */}
        {activeTab === 'SALES' && salesData && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6 bg-slate-50/70 p-6 rounded-2xl border border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Bills ({getPresetLabel()})
                </span>
                <span className="text-2xl font-bold text-slate-900">{salesData.ordersCount}</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Gross Subtotal
                </span>
                <span className="text-2xl font-bold text-slate-900 font-mono">{formatMoney(salesData.totalGross)}</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Net Dispatched Sales
                </span>
                <span className="text-2xl font-bold text-emerald-700 font-mono">{formatMoney(salesData.totalNet)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="p-3">Bill #</th>
                    <th className="p-3">Paper Slip</th>
                    <th className="p-3">Lorry</th>
                    <th className="p-3">Retail Client</th>
                    <th className="p-3 text-right">Subtotal</th>
                    <th className="p-3 text-right">Net Total</th>
                    <th className="p-3 text-right">Cash Paid</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesData.orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No sales bills found for {getPresetLabel().toLowerCase()}.
                      </td>
                    </tr>
                  ) : (
                    salesData.orders.map((o: any) => (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-bold text-slate-800">{o.orderNumber}</td>
                        <td className="p-3 font-mono font-semibold text-blue-600">{o.paperBillNumber || '—'}</td>
                        <td className="p-3 text-slate-600">{o.lorry?.vehicleNumber || 'Warehouse'}</td>
                        <td className="p-3 font-medium text-slate-900">{o.customer.name}</td>
                        <td className="p-3 text-right font-mono text-slate-600">{formatMoney(o.subtotal)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">{formatMoney(o.netTotal)}</td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-600">{formatMoney(o.cashReceived)}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                            {o.paymentMethod} • {o.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. STOCK MOVEMENTS REPORT */}
        {activeTab === 'STOCK' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Movement Type</th>
                  <th className="p-3 text-right">Qty Units</th>
                  <th className="p-3">Reference / Gate Pass</th>
                  <th className="p-3">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No stock movements recorded for {getPresetLabel().toLowerCase()}.
                    </td>
                  </tr>
                ) : (
                  stockMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-500 font-mono">
                        {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">{m.product.sku}</td>
                      <td className="p-3 font-semibold text-slate-900">{m.product.name}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${m.type === 'INBOUND' || m.type === 'LORRY_RETURN'
                              ? 'bg-emerald-50 text-emerald-700'
                              : m.type === 'LORRY_LOAD' || m.type === 'OUTBOUND'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                        >
                          {m.type === 'INBOUND' && <ArrowDownRight className="w-3 h-3" />}
                          {m.type === 'LORRY_RETURN' && <RotateCcw className="w-3 h-3" />}
                          {m.type === 'LORRY_LOAD' && <Truck className="w-3 h-3" />}
                          {m.type}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${m.quantity > 0 ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{m.referenceId || '—'}</td>
                      <td className="p-3 text-slate-500">{m.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. CUSTOMER BALANCES REPORT */}
        {activeTab === 'BALANCES' && balancesData && (
          <div className="space-y-6">
            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Outstanding Receivables Across All Accounts
                </span>
                <span className="text-3xl font-bold text-slate-900 font-mono">
                  {formatMoney(balancesData.totalOutstanding)}
                </span>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
                {balancesData.count} Accounts with Due Balance
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="p-3">Client Code</th>
                    <th className="p-3">Client Name</th>
                    <th className="p-3">Assigned Route</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Pricing Tier</th>
                    <th className="p-3 text-right">Credit Limit</th>
                    <th className="p-3 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balancesData.customers.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-bold text-slate-900">{c.code}</td>
                      <td className="p-3 font-semibold text-slate-900">{c.name}</td>
                      <td className="p-3 text-slate-600 font-medium">{c.route?.name || 'Local'}</td>
                      <td className="p-3 font-mono text-slate-600">{c.phone}</td>
                      <td className="p-3 font-semibold text-slate-700">{c.pricingTier}</td>
                      <td className="p-3 text-right text-slate-500 font-mono">{formatMoney(c.creditLimit)}</td>
                      <td className="p-3 text-right font-bold text-amber-700 text-sm font-mono">
                        {formatMoney(c.outstandingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
