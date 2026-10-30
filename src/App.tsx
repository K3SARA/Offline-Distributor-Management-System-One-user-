import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { LorryLoading } from './pages/LorryLoading';
import { BillEntry } from './pages/BillEntry';
import { LorrySettlement } from './pages/LorrySettlement';
import { Customers } from './pages/Customers';
import { Reports } from './pages/Reports';
import { InvoiceModal } from './components/InvoiceModal';
import { CurrencyProvider } from './context/CurrencyContext';
import { Order } from './types';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F1F3F6] text-[#1D1D1F]">
      {/* Sidebar Navigation */}
      <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main Work Area */}
      <main className="flex-1 h-screen overflow-hidden flex flex-col">
        {currentTab === 'dashboard' && (
          <Dashboard
            onNavigateToLoading={() => setCurrentTab('lorry-loading')}
            onNavigateToBillEntry={() => setCurrentTab('bill-entry')}
            onNavigateToSettlement={() => setCurrentTab('lorry-settlement')}
            onNavigateToInventory={() => setCurrentTab('inventory')}
            onViewInvoice={(order) => setActiveInvoiceOrder(order)}
          />
        )}

        {currentTab === 'inventory' && <Inventory />}

        {currentTab === 'lorry-loading' && <LorryLoading />}

        {currentTab === 'bill-entry' && (
          <BillEntry onViewInvoice={(order) => setActiveInvoiceOrder(order)} />
        )}

        {currentTab === 'lorry-settlement' && <LorrySettlement />}

        {currentTab === 'customers' && (
          <Customers onViewInvoice={(order) => setActiveInvoiceOrder(order)} />
        )}

        {currentTab === 'reports' && <Reports />}
      </main>

      {/* Delivery Note & Invoice Preview Modal */}
      <InvoiceModal
        order={activeInvoiceOrder}
        onClose={() => setActiveInvoiceOrder(null)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <CurrencyProvider>
      <AppContent />
    </CurrencyProvider>
  );
};

export default App;
