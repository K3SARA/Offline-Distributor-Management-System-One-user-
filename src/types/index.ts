export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  costPrice: number;
  currentStock: number;
  minStockAlert: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  companyName?: string | null;
  phone: string;
  deliveryAddress: string;
  city: string;
  pricingTier: 'STANDARD' | 'WHOLESALE' | 'VIP';
  discountPercentage: number;
  creditLimit: number;
  outstandingBalance: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    orders: number;
  };
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customer: Customer;
  status: 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  netTotal: number;
  notes?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface StockMovement {
  id: string;
  productId: string;
  product: Product;
  type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface DashboardStats {
  revenueToday: number;
  ordersTodayCount: number;
  dispatchedCount: number;
  lowStockCount: number;
  totalOutstanding: number;
  recentOrders: Order[];
  lowStockItems: Product[];
}
