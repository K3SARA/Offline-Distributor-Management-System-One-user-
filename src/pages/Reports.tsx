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
  RotateCcw,
  TrendingUp
} from 'lucide-react';
import { ReportService } from '../services/api';
import { StockMovement, Customer, LorryLoading } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { DateRangeFilter, DatePreset } from '../components/DateRangeFilter';
import { ProfitAndLoss } from './ProfitAndLoss';

export const Reports: React.FC = () => {
  const { formatMoney } = useCurrency();
  const [activeTab, setActiveTab] = useState<'PNL' | 'LORRIES' | 'ROUTES' | 'SALES' | 'STOCK' | 'BALANCES'>('LORRIES');
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
      csvContent += 'Loading Number,Date,Lorry,Driver,Route,Status,Loaded Units,Paid Sold Units,Free Issue Units,Returned Units,Sales Amount,Cash Collected\n';
      lorryLoadings.forEach((l) => {
        csvContent += `"${l.loadingNumber}","${new Date(l.date).toLocaleDateString()}","${l.lorry.vehicleNumber}","${l.lorry.driverName}","${l.lorry.route?.name || ''}","${l.status}",${l.totalLoadedItems},${l.totalSoldItems},${l.totalFreeItems || 0},${l.totalReturnedItems},${l.totalSalesAmount},${l.cashCollected}\n`;
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto h-full pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/80 pb-4 sm:pb-6 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Reports & Fleet Audit
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
            Reconciliation sheets for 3 lorries, route analysis, driver bills, and warehouse stock flow.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={exportCSV}
            className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl shadow-2xs transition text-xs flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2 sm:py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white font-semibold rounded-2xl shadow-sm transition text-xs flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Toolbar: Report Tabs & Date Range Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 print:hidden">
        {/* Report Tabs */}
        <div className="flex gap-1 sm:gap-1.5 bg-slate-200/60 p-1 sm:p-1.5 rounded-2xl w-full sm:w-fit overflow-x-auto pb-1 sm:pb-1.5">
          <button
            onClick={() => setActiveTab('PNL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'PNL' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-700 hover:text-slate-900'
              }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Profit & Loss (P&L)
          </button>
          <button
            onClick={() => setActiveTab('LORRIES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'LORRIES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Truck className="w-3.5 h-3.5 text-blue-600" /> Lorry Audit
          </button>
          <button
            onClick={() => setActiveTab('ROUTES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'ROUTES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Compass className="w-3.5 h-3.5 text-emerald-600" /> Routes
          </button>
          <button
            onClick={() => setActiveTab('SALES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'SALES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-600" /> Driver Bills
          </button>
          <button
            onClick={() => setActiveTab('STOCK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'STOCK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-600" /> Stock Movements
          </button>
          <button
            onClick={() => setActiveTab('BALANCES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'BALANCES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
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
      {activeTab === 'PNL' ? (
        <ProfitAndLoss />
      ) : (
        <div className="bg-white border border-slate-200/70 rounded-2xl sm:rounded-3xl shadow-2xs p-4 sm:p-8 space-y-4 sm:space-y-6">
        {/* Printable Report Header */}
        <div className="border-b border-slate-100 pb-3 sm:pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {activeTab === 'LORRIES' && 'Lorry Morning Load & Evening Settlement Audit'}
                {activeTab === 'ROUTES' && `${routeSummaries.length || 3} Routes Distribution Performance Analysis`}
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
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left border-collapse text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-3.5">Gate Pass #</th>
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Lorry / Driver</th>
                    <th className="py-3 px-3.5">Route</th>
                    <th className="py-3 px-3.5 text-center">Loaded</th>
                    <th className="py-3 px-3.5 text-center">Paid Sold</th>
                    <th className="py-3 px-3.5 text-center">Free Issued</th>
                    <th className="py-3 px-3.5 text-center">Returned</th>
                    <th className="py-3 px-3.5 text-right">Sales Value</th>
                    <th className="py-3 px-3.5 text-right">Cash Handover</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lorryLoadings.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        No lorry loadings recorded for {getPresetLabel().toLowerCase()}.
                      </td>
                    </tr>
                  ) : (
                    lorryLoadings.map((load) => (
                      <tr key={load.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-900">{load.loadingNumber}</td>
                        <td className="py-3 px-3.5 text-slate-500 font-mono">
                          {new Date(load.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="font-bold text-slate-800 block">{load.lorry.vehicleNumber}</span>
                          <span className="text-slate-400">{load.lorry.driverName}</span>
                        </td>
                        <td className="py-3 px-3.5 font-medium text-slate-700">{load.lorry.route?.name || '—'}</td>
                        <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-900">{load.totalLoadedItems}</td>
                        <td className="py-3 px-3.5 text-center font-mono font-bold text-emerald-600">{load.totalSoldItems}</td>
                        <td className="py-3 px-3.5 text-center font-mono font-semibold text-blue-600">
                          {load.totalFreeItems > 0 ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-bold text-xs">
                              +{load.totalFreeItems}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono font-bold text-blue-600">{load.totalReturnedItems}</td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">{formatMoney(load.totalSalesAmount)}</td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-600">{formatMoney(load.cashCollected)}</td>
                        <td className="py-3 px-3.5 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${load.status === 'SETTLED'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-blue-50 text-blue-700 border border-blue-200/60'
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
        {activeTab === 'ROUTES' && (() => {
          const totalSalesAll = routeSummaries.reduce((sum, r) => sum + (r.totalSales || 0), 0);
          const totalCashAll = routeSummaries.reduce((sum, r) => sum + (r.totalCash || 0), 0);
          const totalCreditAll = routeSummaries.reduce((sum, r) => sum + (r.totalCredit || 0), 0);
          const totalBillsAll = routeSummaries.reduce((sum, r) => sum + (r.totalBills || 0), 0);

          return (
            <div className="space-y-6">
              {/* Route Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {routeSummaries.map((route) => {
                  const cashRatio = route.totalSales > 0 ? (route.totalCash / route.totalSales) * 100 : 0;
                  const creditRatio = route.totalSales > 0 ? (route.totalCredit / route.totalSales) * 100 : 0;

                  return (
                    <div key={route.id} className="p-5 bg-slate-50/70 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3.5 hover:border-slate-300 transition">
                      {/* Top Header */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 shadow-3xs">
                          {route.code}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          {route.customerCount} Outlets
                        </span>
                      </div>

                      {/* Route Name & Lorry */}
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{route.name}</h3>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Lorry: <strong className="text-slate-800">{route.lorry?.vehicleNumber || 'Unassigned'}</strong> {route.lorry?.driverName ? `(${route.lorry.driverName})` : ''}
                        </div>
                      </div>

                      {/* Total Period Sales Header */}
                      <div className="pt-2 border-t border-slate-200/70 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                            Period Sales
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {route.totalBills} {route.totalBills === 1 ? 'bill' : 'bills'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 text-base">
                          {formatMoney(route.totalSales)}
                        </span>
                      </div>

                      {/* Separate Cash and Credit Sections */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Cash Collected Box */}
                        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/60 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Cash
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-700">
                              {Math.round(cashRatio)}%
                            </span>
                          </div>
                          <div className="font-mono font-bold text-emerald-700 text-sm">
                            {formatMoney(route.totalCash)}
                          </div>
                          <span className="text-[9px] text-emerald-600/80 block font-medium">
                            Collected cash
                          </span>
                        </div>

                        {/* Credit Given Box */}
                        <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Credit
                            </span>
                            <span className="text-[10px] font-mono font-bold text-amber-700">
                              {Math.round(creditRatio)}%
                            </span>
                          </div>
                          <div className="font-mono font-bold text-amber-700 text-sm">
                            {formatMoney(route.totalCredit)}
                          </div>
                          <span className="text-[9px] text-amber-600/80 block font-medium">
                            Pending credit
                          </span>
                        </div>
                      </div>

                      {/* Visual Cash vs Credit Ratio Bar */}
                      <div className="space-y-1 pt-0.5">
                        <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${cashRatio}%` }}
                            className="h-full bg-emerald-500 transition-all duration-300"
                            title={`Cash: ${Math.round(cashRatio)}%`}
                          />
                          <div
                            style={{ width: `${creditRatio}%` }}
                            className="h-full bg-amber-400 transition-all duration-300"
                            title={`Credit: ${Math.round(creditRatio)}%`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Route Breakdown & Settlement Audit Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Route-Wise Cash & Credit Settlement Audit
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    {getPresetLabel()}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Route</th>
                        <th className="py-3 px-4">Lorry / Driver</th>
                        <th className="py-3 px-3 text-center">Outlets</th>
                        <th className="py-3 px-3 text-center">Bills</th>
                        <th className="py-3 px-4 text-right">Total Net Sales</th>
                        <th className="py-3 px-4 text-right text-emerald-700">Cash Collected</th>
                        <th className="py-3 px-4 text-right text-amber-700">Credit Given</th>
                        <th className="py-3 px-4 text-center">Collection Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {routeSummaries.map((route) => {
                        const cashRatio = route.totalSales > 0 ? (route.totalCash / route.totalSales) * 100 : 0;
                        return (
                          <tr key={route.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-blue-600 block">{route.code}</span>
                              <span className="font-semibold text-slate-900">{route.name}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-800 block">{route.lorry?.vehicleNumber || 'Unassigned'}</span>
                              <span className="text-[11px] text-slate-400">{route.lorry?.driverName || 'No driver assigned'}</span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono">{route.customerCount}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">{route.totalBills}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {formatMoney(route.totalSales)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 bg-emerald-50/20">
                              {formatMoney(route.totalCash)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 bg-amber-50/20">
                              {formatMoney(route.totalCredit)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                cashRatio >= 99
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  : cashRatio >= 50
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              }`}>
                                {Math.round(cashRatio)}% Cash
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-xs text-slate-900">
                      <tr>
                        <td colSpan={2} className="py-3.5 px-4 uppercase tracking-wider text-slate-600 font-extrabold text-[11px]">
                          All Routes Total
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-slate-600">
                          {routeSummaries.reduce((sum, r) => sum + (r.customerCount || 0), 0)}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-slate-900">
                          {totalBillsAll}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-900">
                          {formatMoney(totalSalesAll)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-700 bg-emerald-100/40">
                          {formatMoney(totalCashAll)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-amber-700 bg-amber-100/40">
                          {formatMoney(totalCreditAll)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono text-xs font-bold text-slate-700">
                            {totalSalesAll > 0 ? Math.round((totalCashAll / totalSalesAll) * 100) : 0}% Overall Cash
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 3. SALES REPORT */}
        {activeTab === 'SALES' && salesData && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 bg-slate-50/70 p-4 sm:p-6 rounded-2xl border border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
                  Total Bills ({getPresetLabel()})
                </span>
                <span className="text-xl sm:text-2xl font-bold text-slate-900">{salesData.ordersCount}</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
                  Gross Subtotal
                </span>
                <span className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">{formatMoney(salesData.totalGross)}</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
                  Net Dispatched Sales
                </span>
                <span className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono">{formatMoney(salesData.totalNet)}</span>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left border-collapse text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-3.5">Bill #</th>
                    <th className="py-3 px-3.5">Paper Slip</th>
                    <th className="py-3 px-3.5">Lorry</th>
                    <th className="py-3 px-3.5">Retail Client</th>
                    <th className="py-3 px-3.5 text-right">Subtotal</th>
                    <th className="py-3 px-3.5 text-right">Net Total</th>
                    <th className="py-3 px-3.5 text-right">Cash Paid</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
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
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-900">{o.orderNumber}</td>
                        <td className="py-3 px-3.5 font-mono font-semibold text-blue-600">{o.paperBillNumber || '—'}</td>
                        <td className="py-3 px-3.5 text-slate-700 font-medium">{o.lorry?.vehicleNumber || 'Warehouse'}</td>
                        <td className="py-3 px-3.5 font-semibold text-slate-900">{o.customer.name}</td>
                        <td className="py-3 px-3.5 text-right font-mono text-slate-600">{formatMoney(o.subtotal)}</td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">{formatMoney(o.netTotal)}</td>
                        <td className="py-3 px-3.5 text-right font-mono font-semibold text-emerald-600">{formatMoney(o.cashReceived)}</td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
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
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-left border-collapse text-sm min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-3.5">Timestamp</th>
                  <th className="py-3 px-3.5">SKU</th>
                  <th className="py-3 px-3.5">Product Name</th>
                  <th className="py-3 px-3.5">Movement Type</th>
                  <th className="py-3 px-3.5 text-right">Qty Units</th>
                  <th className="py-3 px-3.5">Reference / Gate Pass</th>
                  <th className="py-3 px-3.5">Audit Details</th>
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
                      <td className="py-3 px-3.5 text-slate-500 font-mono text-xs">
                        {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900">{m.product.sku}</td>
                      <td className="py-3 px-3.5 font-semibold text-slate-900">{m.product.name}</td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${m.type === 'INBOUND' || m.type === 'LORRY_RETURN'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : m.type === 'LORRY_LOAD' || m.type === 'OUTBOUND'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            }`}
                        >
                          {m.type === 'INBOUND' && <ArrowDownRight className="w-3.5 h-3.5" />}
                          {m.type === 'LORRY_RETURN' && <RotateCcw className="w-3.5 h-3.5" />}
                          {m.type === 'LORRY_LOAD' && <Truck className="w-3.5 h-3.5" />}
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
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-slate-50/80 p-4 sm:p-6 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
                  Total Outstanding Receivables Across All Accounts
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono">
                  {formatMoney(balancesData.totalOutstanding)}
                </span>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
                {balancesData.count} Accounts with Due Balance
              </span>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left border-collapse text-xs min-w-[700px]">
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
      )}
    </div>
  );
};
