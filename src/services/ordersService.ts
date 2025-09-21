// Service for CRUD operations on orders
import { appState, Order } from '../state/appState';

export const ordersService = {
  getAll(): Order[] {
    return appState.orders;
  },
  getById(id: string | number): Order | undefined {
    return appState.orders.find(o => o.id === id);
  },
  add(order: Order): void {
    appState.orders.push(order);
  },
  update(id: string | number, updates: Partial<Order>): void {
    const idx = appState.orders.findIndex(o => o.id === id);
    if (idx > -1) {
      appState.orders[idx] = { ...appState.orders[idx], ...updates };
    }
  },
  remove(id: string | number): void {
    appState.orders = appState.orders.filter(o => o.id !== id);
  }
};
