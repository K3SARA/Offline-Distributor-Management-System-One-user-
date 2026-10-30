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
  Boxes
} from 'lucide-react';
import { ReportService } from '../services/api';
import { StockMovement, Customer } from '../types';
import { useCurrency } from '../context/CurrencyContext';

export const Reports: React.FC = () => {
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<'SALES' | 'STOCK' | 'BALANCES'>('SALES');
  const [loading, setLoading] = useState(false);

  // Sales summary data
  const [salesData, setSalesData] = useState<any>(null);

  // Stock movement logs
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  // Customer balances
  const [balancesData, setBalancesData] = useState<any>(null);

  useEffect(() => {
    loadActiveReport();
  }, [activeTab]);

  const loadActiveReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'SALES') {
        const data = await ReportService.getSalesSummary();
        setSalesData(data);
      } else if (activeTab === 'STOCK') {
        const movements = await ReportService.getStockMovements();
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

  const exportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeTab === 'SALES' && salesData?.orders) {
      csvContent += 'Order Number,Date,Client,Subtotal,Discount,Net Total,Status\n';
      salesData.orders.forEach((o: any) => {
        csvContent += `"${o.orderNumber}","${new Date(o.createdAt).toLocaleDateString()}","${o.customer.name}",${o.subtotal},${o.discountAmount},${o.netTotal},"${o.status}"\n`;
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
    <div className="p-8 max-w-7xl mx-auto space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
            Reports & Audit Logs
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            End-of-day sales, warehouse stock movements, and customer outstanding statements
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="px-5 py-3 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl shadow-sm transition text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold rounded-2xl shadow-sm transition text-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-2 bg-slate-200/60 p-1.5 rounded-2xl w-fit print:hidden">
        <button
          onClick={() => setActiveTab('SALES')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'SALES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-600" /> End-of-Day Sales Summary
        </button>
        <button
          onClick={() => setActiveTab('STOCK')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'STOCK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-4 h-4 text-blue-600" /> Stock Movement History
        </button>
        <button
          onClick={() => setActiveTab('BALANCES')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'BALANCES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-purple-600" /> Customer Receivables
        </button>
      </div>

      {/* REPORT CONTENT AREA */}
      <div className="bg-white border border-slate-200/70 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-8 space-y-6">
        {/* Printable Report Header */}
        <div className="border-b border-slate-100 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {activeTab === 'SALES' && 'Daily Sales & Distribution Summary'}
                {activeTab === 'STOCK' && 'Warehouse Stock Intake & Outbound Movements'}
                {activeTab === 'BALANCES' && 'Customer Outstanding Receivables Statement'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Generated: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {/* 1. SALES REPORT */}
        {activeTab === 'SALES' && salesData && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6 bg-slate-50/70 p-6 rounded-2xl border border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Orders
                </span>
                <span className="text-2xl font-bold text-slate-900">{salesData.ordersCount}</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Gross Subtotal
                </span>
                <span className="text-2xl font-bold text-slate-900">{formatCurrency(salesData.totalGross)}</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Net Dispatched Sales
                </span>
                <span className="text-2xl font-bold text-emerald-700">{formatCurrency(salesData.totalNet)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="p-3">Order #</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Time</th>
                    <th className="p-3 text-right">Subtotal</th>
                    <th className="p-3 text-right">Discount</th>
                    <th className="p-3 text-right">Net Total</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesData.orders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-bold text-slate-800">{o.orderNumber}</td>
                      <td className="p-3 font-medium text-slate-900">{o.customer.name}</td>
                      <td className="p-3 text-xs text-slate-500">
                        {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 text-right text-slate-600">{formatCurrency(o.subtotal)}</td>
                      <td className="p-3 text-right text-emerald-600 font-medium">-{formatCurrency(o.discountAmount)}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(o.netTotal)}</td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. STOCK MOVEMENTS REPORT */}
        {activeTab === 'STOCK' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3">Reference / PO</th>
                  <th className="p-3">Audit Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="p-3 text-xs text-slate-500">
                      {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">{m.product.sku}</td>
                    <td className="p-3 font-semibold text-slate-900">{m.product.name}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          m.type === 'INBOUND'
                            ? 'bg-emerald-50 text-emerald-700'
                            : m.type === 'OUTBOUND'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {m.type === 'INBOUND' && <ArrowDownRight className="w-3 h-3" />}
                        {m.type === 'OUTBOUND' && <ArrowUpRight className="w-3 h-3" />}
                        {m.type}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-bold ${m.quantity > 0 ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="p-3 text-xs font-mono text-slate-600">{m.referenceId || '—'}</td>
                    <td className="p-3 text-xs text-slate-500">{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. CUSTOMER BALANCES REPORT */}
        {activeTab === 'BALANCES' && balancesData && (
          <div className="space-y-6">
            <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Outstanding Receivables Across All Accounts
                </span>
                <span className="text-3xl font-bold text-slate-900">
                  {formatCurrency(balancesData.totalOutstanding)}
                </span>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
                {balancesData.count} Accounts with Due Balance
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="p-3">Client Code</th>
                    <th className="p-3">Client Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Pricing Tier</th>
                    <th className="p-3 text-right">Credit Limit</th>
                    <th className="p-3 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balancesData.customers.map((c: Customer) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-bold text-slate-900">{c.code}</td>
                      <td className="p-3 font-semibold text-slate-900">{c.name}</td>
                      <td className="p-3 font-mono text-xs text-slate-600">{c.phone}</td>
                      <td className="p-3 text-xs font-semibold text-slate-700">{c.pricingTier}</td>
                      <td className="p-3 text-right text-slate-500 font-medium">{formatCurrency(c.creditLimit)}</td>
                      <td className="p-3 text-right font-bold text-amber-700 text-base">
                        {formatCurrency(c.outstandingBalance)}
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
