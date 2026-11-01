import React, { useState } from 'react';
import { User, Order } from '../types';
import { RepBilling } from './RepBilling';
import { InvoiceModal } from '../components/InvoiceModal';

interface RepMobilePortalProps {
  user: User;
  onLogout: () => void;
}

export const RepMobilePortal: React.FC<RepMobilePortalProps> = ({ user, onLogout }) => {
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);

  return (
    <div className="min-h-screen w-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] overflow-x-hidden">
      <RepBilling
        user={user}
        onLogout={onLogout}
        initialLorryId={user.lorryId || undefined}
        onViewInvoice={order => setActiveInvoiceOrder(order)}
      />

      {activeInvoiceOrder && (
        <InvoiceModal
          order={activeInvoiceOrder}
          onClose={() => setActiveInvoiceOrder(null)}
        />
      )}
    </div>
  );
};
