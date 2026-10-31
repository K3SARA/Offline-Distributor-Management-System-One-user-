import axios from 'axios';
import {
  Product,
  Customer,
  Order,
  DashboardStats,
  StockMovement,
  Route,
  Lorry,
  LorryLoading,
  SystemSettings,
  ProfitAndLossReport,
  Supplier,
  PurchaseOrder
} from '../types';

// Dynamic API URL: uses relative '/api' on Railway / production web,
// or fallback to localhost:4812 in standalone Vite dev / Electron
const isDevVite = typeof window !== 'undefined' && window.location.port === '5173';
const API_BASE_URL = import.meta.env.VITE_API_URL || (isDevVite ? 'http://127.0.0.1:4812/api' : '/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const ProductService = {
  getAll: (lowStock?: boolean, search?: string) =>
    api.get<Product[]>('/products', { params: { lowStock, search } }).then(r => r.data),
  create: (data: Partial<Product>) =>
    api.post<Product>('/products', data).then(r => r.data),
  update: (id: string, data: Partial<Product>) =>
    api.put<Product>(`/products/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/products/${id}`).then(r => r.data),
  adjustStock: (id: string, payload: { quantity: number; type: string; notes?: string; referenceId?: string }) =>
    api.post<Product>(`/products/${id}/stock-adjust`, payload).then(r => r.data)
};

export const RouteService = {
  getAll: () =>
    api.get<Route[]>('/routes').then(r => r.data),
  create: (data: { code: string; name: string; description?: string }) =>
    api.post<Route>('/routes', data).then(r => r.data)
};

export const LorryService = {
  getAll: () =>
    api.get<Lorry[]>('/lorries').then(r => r.data),
  getById: (id: string) =>
    api.get<Lorry>(`/lorries/${id}`).then(r => r.data),
  create: (data: { vehicleNumber: string; driverName: string; driverPhone?: string; routeId?: string; status?: string }) =>
    api.post<Lorry>('/lorries', data).then(r => r.data),
  update: (id: string, data: Partial<Lorry>) =>
    api.put<Lorry>(`/lorries/${id}`, data).then(r => r.data),
  loadMorningStock: (id: string, payload: { items: { productId: string; quantity: number }[]; notes?: string }) =>
    api.post<LorryLoading>(`/lorries/${id}/load`, payload).then(r => r.data),
  getCurrentLoading: (id: string) =>
    api.get<LorryLoading | null>(`/lorries/${id}/current-loading`).then(r => r.data),
  enterDriverBill: (id: string, payload: {
    paperBillNumber?: string;
    customerId: string;
    items: { productId: string; quantity: number; freeQuantity?: number }[];
    paymentMethod: 'CASH' | 'CREDIT' | 'CHEQUE';
    cashReceived: number;
    notes?: string;
  }) => api.post<Order>(`/lorries/${id}/bills`, payload).then(r => r.data),
  settleLorry: (id: string, payload: {
    loadingId: string;
    returns: { productId: string; returnedQty: number }[];
    cashHandover: number;
    notes?: string;
  }) => api.post<LorryLoading>(`/lorries/${id}/settle`, payload).then(r => r.data)
};

export const CustomerService = {
  getAll: (search?: string, routeId?: string) =>
    api.get<Customer[]>('/customers', { params: { search, routeId } }).then(r => r.data),
  create: (data: Partial<Customer>) =>
    api.post<Customer>('/customers', data).then(r => r.data),
  update: (id: string, data: Partial<Customer>) =>
    api.put<Customer>(`/customers/${id}`, data).then(r => r.data),
  getOrderHistory: (id: string) =>
    api.get<Order[]>(`/customers/${id}/orders`).then(r => r.data)
};

export const OrderService = {
  getAll: (status?: string, lorryId?: string, routeId?: string, limit?: number) =>
    api.get<Order[]>('/orders', { params: { status, lorryId, routeId, limit } }).then(r => r.data),
  getById: (id: string) =>
    api.get<Order>(`/orders/${id}`).then(r => r.data),
  create: (payload: {
    customerId?: string;
    walkInName?: string;
    walkInPhone?: string;
    paperBillNumber?: string;
    items: { productId: string; quantity: number; freeQuantity?: number }[];
    paymentStatus?: string;
    paymentMethod?: string;
    cashReceived?: number;
    notes?: string;
    lorryId?: string;
  }) => api.post<Order>('/orders', payload).then(r => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch<Order>(`/orders/${id}/status`, { status }).then(r => r.data)
};

export const ReportService = {
  getDashboardStats: (from?: string, to?: string) =>
    api.get<DashboardStats>('/reports/dashboard-stats', { params: { from, to } }).then(r => r.data),
  getLorryPerformance: (from?: string, to?: string) =>
    api.get<LorryLoading[]>('/reports/lorry-performance', { params: { from, to } }).then(r => r.data),
  getRouteSales: (from?: string, to?: string) =>
    api.get<any[]>('/reports/route-sales', { params: { from, to } }).then(r => r.data),
  getSalesSummary: (from?: string, to?: string, lorryId?: string, routeId?: string) =>
    api.get<any>('/reports/sales-summary', { params: { from, to, lorryId, routeId } }).then(r => r.data),
  getStockMovements: (type?: string, limit?: number, from?: string, to?: string) =>
    api.get<StockMovement[]>('/reports/stock-movements', { params: { type, limit, from, to } }).then(r => r.data),
  getCustomerBalances: () =>
    api.get<any>('/reports/customer-balances').then(r => r.data),
  getProfitAndLoss: (from?: string, to?: string) =>
    api.get<ProfitAndLossReport>('/reports/profit-and-loss', { params: { from, to } }).then(r => r.data)
};

export const SettingsService = {
  get: () =>
    api.get<SystemSettings>('/settings').then(r => r.data),
  update: (data: Partial<SystemSettings>) =>
    api.put<SystemSettings>('/settings', data).then(r => r.data)
};

export const SupplierService = {
  getAll: (search?: string) =>
    api.get<Supplier[]>('/suppliers', { params: { search } }).then(r => r.data),
  getById: (id: string) =>
    api.get<Supplier>(`/suppliers/${id}`).then(r => r.data),
  create: (data: Partial<Supplier>) =>
    api.post<Supplier>('/suppliers', data).then(r => r.data),
  update: (id: string, data: Partial<Supplier>) =>
    api.put<Supplier>(`/suppliers/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/suppliers/${id}`).then(r => r.data),
  recordPayment: (id: string, payload: { amount: number; paymentMethod?: string; notes?: string }) =>
    api.post<{ message: string; supplier: Supplier }>(`/suppliers/${id}/payments`, payload).then(r => r.data)
};

export const PurchaseOrderService = {
  getAll: (params?: { supplierId?: string; from?: string; to?: string }) =>
    api.get<PurchaseOrder[]>('/purchase-orders', { params }).then(r => r.data),
  create: (payload: {
    supplierId: string;
    supplierInvoiceNumber?: string;
    date?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    paidAmount?: number;
    notes?: string;
    items: { productId: string; quantity: number; costPrice: number }[];
  }) => api.post<PurchaseOrder>('/purchase-orders', payload).then(r => r.data)
};

