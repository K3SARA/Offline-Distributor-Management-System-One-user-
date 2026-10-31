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
  expenses?: Expense[];
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
  isRawMaterial?: boolean;
  supplierId?: string | null;
  supplier?: Supplier | null;
  createdAt: string;
  updatedAt: string;
  lorryStocks?: {
    quantity: number;
    lorry: Lorry;
  }[];
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  city: string;
  paymentTerms?: string | null;
  outstandingBalance: number;
  createdAt: string;
  updatedAt: string;
  products?: Product[];
  purchaseOrders?: PurchaseOrder[];
  _count?: {
    products: number;
    purchaseOrders: number;
  };
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  product: Product;
  quantity: number;
  costPrice: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierInvoiceNumber?: string | null;
  supplierId: string;
  supplier: Supplier;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  date: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  notes?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
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
  maxCreditInvoices?: number;
  createdAt: string;
  updatedAt: string;
  payments?: CustomerPayment[];
  _count?: {
    orders: number;
    payments?: number;
  };
}

export interface CustomerPayment {
  id: string;
  receiptNumber: string;
  customerId: string;
  customer?: Customer;
  amount: number;
  paymentMethod: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER';
  chequeNumber?: string | null;
  bankName?: string | null;
  chequeDate?: string | null;
  reference?: string | null;
  notes?: string | null;
  collectedBy?: string | null;
  lorryId?: string | null;
  lorry?: Lorry | null;
  allocations?: BillPaymentAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface BillPaymentAllocation {
  id: string;
  paymentId: string;
  payment?: CustomerPayment;
  orderId: string;
  order?: Order;
  amount: number;
  notes?: string | null;
  createdAt: string;
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
  paidAmount?: number;
  balanceAmount?: number;
  daysOpen?: number;
  allocations?: BillPaymentAllocation[];
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
  todayExpenses?: number;
}

export interface DashboardStats {
  revenueToday: number;
  cashToday: number;
  creditToday: number;
  ordersTodayCount: number;
  lowStockCount: number;
  totalOutstanding: number;
  expensesToday: number;
  netProfitToday: number;
  creditCollectionsToday?: number;
  fleetStatus: FleetLorryStatus[];
  recentOrders: Order[];
  lowStockItems: Product[];
}

export interface SystemSettings {
  companyName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  registrationNumber: string;
  invoiceFooterNote: string;
  defaultCurrency: string;
  defaultCreditLimit: number;
  lowStockThreshold: number;
}

export type ExpenseCategory =
  | 'FUEL'
  | 'VEHICLE_MAINTENANCE'
  | 'DRIVER_ALLOWANCE'
  | 'RENT'
  | 'UTILITIES'
  | 'SALARIES'
  | 'PACKAGING'
  | 'PETTY_CASH'
  | 'OTHER';

export interface Expense {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  date: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  referenceNumber?: string | null;
  paidTo?: string | null;
  notes?: string | null;
  lorryId?: string | null;
  lorry?: Lorry | null;
  loadingId?: string | null;
  loading?: LorryLoading | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummary {
  totalAmount: number;
  totalCount: number;
  fleetExpenses: number;
  overheadExpenses: number;
  byCategory: Array<{
    category: ExpenseCategory;
    amount: number;
    count: number;
  }>;
  byLorry: Array<{
    lorryId: string;
    vehicleNumber: string;
    driverName: string;
    amount: number;
    count: number;
  }>;
  byPaymentMethod: Array<{
    paymentMethod: string;
    amount: number;
  }>;
}

export interface ProfitAndLossReport {
  period: {
    from: string;
    to: string;
  };
  summary: {
    grossRevenue: number;
    discounts: number;
    netRevenue: number;
    cogs: number;
    freeIssueCost: number;
    totalCostOfSales: number;
    grossProfit: number;
    grossProfitMargin: number;
    markupPercentage: number;
    totalUnitsSold: number;
    totalFreeUnits: number;
    totalOrdersCount: number;
    cashCollected: number;
    creditReceivables: number;
    totalExpenses: number;
    netOperatingProfit: number;
    netProfitMargin: number;
    fleetExpenses: number;
    overheadExpenses: number;
  };
  expensesByCategory: Array<{
    category: ExpenseCategory;
    amount: number;
    count: number;
  }>;
  channelBreakdown: Array<{
    id: string;
    channelName: string;
    subtext: string;
    billsCount: number;
    netRevenue: number;
    cogs: number;
    freeIssueCost: number;
    totalCost: number;
    grossProfit: number;
    margin: number;
    expenses?: number;
    netProfit?: number;
  }>;
  productBreakdown: Array<{
    productId: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
    unitPrice: number;
    costPrice: number;
    unitsSold: number;
    unitsFree: number;
    revenue: number;
    cogs: number;
    freeCost: number;
    totalCost: number;
    grossProfit: number;
    margin: number;
  }>;
  dailyBreakdown: Array<{
    date: string;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    expenses?: number;
  }>;
}

export interface RecipeItem {
  id: string;
  recipeId: string;
  componentProductId: string;
  componentProduct?: Product;
  quantity: number;
  notes?: string | null;
}

export interface Recipe {
  id: string;
  code: string;
  name: string;
  productId: string;
  product?: Product;
  outputYield: number;
  estimatedOverheadCost: number;
  notes?: string | null;
  items: RecipeItem[];
  productionRuns?: ProductionRun[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductionRunItem {
  id: string;
  productionRunId: string;
  productId: string;
  product?: Product;
  plannedQuantity: number;
  actualQuantity: number;
  unitCost: number;
  lineCost: number;
}

export interface ProductionRun {
  id: string;
  batchNumber: string;
  recipeId: string;
  recipe?: Recipe;
  targetQuantity: number;
  actualQuantity: number;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  totalRawMaterialCost: number;
  overheadCost: number;
  totalProductionCost: number;
  unitCost: number;
  producedBy?: string | null;
  notes?: string | null;
  startDate: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: ProductionRunItem[];
}
export interface ManufacturingSummary {
  totalBatchesCount: number;
  totalUnitsManufactured: number;
  totalProductionCost: number;
  activeRecipesCount: number;
}

export interface LorryWiseSummary {
  lorryId: string;
  vehicleNumber: string;
  driverName: string;
  routeName?: string | null;
  routeCode?: string | null;
  loadingsCount: number;
  ordersCount: number;
  totalAllSales: number;
  totalCashSales: number;
  totalCreditSale: number;
  cashRatio: number;
  totalSoldItems: number;
}

export interface LorryPerformanceReport {
  summary: {
    totalAllSales: number;
    totalCashSales: number;
    totalCreditSale: number;
    totalLoadedItems: number;
    totalSoldItems: number;
    totalFreeItems: number;
    totalReturnedItems: number;
    activeLorriesCount: number;
    totalLoadingsCount: number;
  };
  lorrySummaries: LorryWiseSummary[];
  loadings: (LorryLoading & {
    totalAllSales: number;
    totalCashSales: number;
    totalCreditSale: number;
  })[];
}
