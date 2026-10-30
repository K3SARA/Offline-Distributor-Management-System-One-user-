import axios from 'axios';
import { Product, Customer, Order, DashboardStats, StockMovement } from '../types';

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

export const CustomerService = {
  getAll: (search?: string) =>
    api.get<Customer[]>('/customers', { params: { search } }).then(r => r.data),
  create: (data: Partial<Customer>) =>
    api.post<Customer>('/customers', data).then(r => r.data),
  update: (id: string, data: Partial<Customer>) =>
    api.put<Customer>(`/customers/${id}`, data).then(r => r.data),
  getOrderHistory: (id: string) =>
    api.get<Order[]>(`/customers/${id}/orders`).then(r => r.data)
};

export const OrderService = {
  getAll: (status?: string, limit?: number) =>
    api.get<Order[]>('/orders', { params: { status, limit } }).then(r => r.data),
  getById: (id: string) =>
    api.get<Order>(`/orders/${id}`).then(r => r.data),
  create: (payload: { customerId: string; items: { productId: string; quantity: number }[]; paymentStatus?: string; notes?: string }) =>
    api.post<Order>('/orders', payload).then(r => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch<Order>(`/orders/${id}/status`, { status }).then(r => r.data)
};

export const ReportService = {
  getDashboardStats: () =>
    api.get<DashboardStats>('/reports/dashboard-stats').then(r => r.data),
  getSalesSummary: (from?: string, to?: string) =>
    api.get<any>('/reports/sales-summary', { params: { from, to } }).then(r => r.data),
  getStockMovements: (type?: string, limit?: number) =>
    api.get<StockMovement[]>('/reports/stock-movements', { params: { type, limit } }).then(r => r.data),
  getCustomerBalances: () =>
    api.get<any>('/reports/customer-balances').then(r => r.data)
};
