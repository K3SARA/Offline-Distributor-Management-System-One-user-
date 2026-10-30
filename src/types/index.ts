export interface Route {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  lorries?: Lorry[];
  _count?: {
    customers: number;
    orders: number;
  };
}

export interface Lorry {
  id: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone?: string | null;
  routeId?: string | null;
  route?: Route | null;
  status: 'ACTIVE' | 'MAINTENANCE';
  lorryStocks?: LorryStock[];
  loadings?: LorryLoading[];
}

export interface LorryStock {
  id: string;
  lorryId: string;
  productId: string;
  product: Product;
  quantity: number;
  updatedAt: string;
}

export interface LorryLoadingItem {
  id: string;
  loadingId: string;
  productId: string;
  product: Product;
  loadedQty: number;
  soldQty: number;
  freeQty: number;
  returnedQty: number;
  discrepancyQty: number;
}

export interface LorryLoading {
  id: string;
  loadingNumber: string;
  lorryId: string;
  lorry: Lorry;
  routeId?: string | null;
  date: string;
  status: 'LOADED' | 'IN_TRANSIT' | 'SETTLED';
  notes?: string | null;
  totalLoadedItems: number;
  totalSoldItems: number;
  totalFreeItems: number;
  totalReturnedItems: number;
  totalSalesAmount: number;
  cashCollected: number;
  creditGiven: number;
  settledAt?: string | null;
  items: LorryLoadingItem[];
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  costPrice: number;
  currentStock: number; // Main warehouse stock
  minStockAlert: number;
  freeRatioBuy?: number;
  freeRatioGet?: number;
  createdAt: string;
  updatedAt: string;
  lorryStocks?: {
    quantity: number;
    lorry: Lorry;
  }[];
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  companyName?: string | null;
  phone: string;
  deliveryAddress: string;
  city: string;
  routeId?: string | null;
  route?: Route | null;
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
  freeQuantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  paperBillNumber?: string | null;
  customerId: string;
  customer: Customer;
  lorryId?: string | null;
  lorry?: Lorry | null;
  routeId?: string | null;
  route?: Route | null;
  status: 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  paymentMethod: 'CASH' | 'CREDIT' | 'CHEQUE';
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  netTotal: number;
  cashReceived: number;
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
  type: 'INBOUND' | 'LORRY_LOAD' | 'LORRY_RETURN' | 'OUTBOUND' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface FleetLorryStatus {
  id: string;
  vehicleNumber: string;
  driverName: string;
  routeName: string;
  status: 'READY_TO_LOAD' | 'ACTIVE' | 'SETTLED';
  floatingStockUnits: number;
  todaySales: number;
  todayCash: number;
}

export interface DashboardStats {
  revenueToday: number;
  cashToday: number;
  creditToday: number;
  ordersTodayCount: number;
  lowStockCount: number;
  totalOutstanding: number;
  fleetStatus: FleetLorryStatus[];
  recentOrders: Order[];
  lowStockItems: Product[];
}
