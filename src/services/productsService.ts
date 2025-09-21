// Service for CRUD operations on products
import { appState, Product } from '../state/appState';

export const productsService = {
  getAll(): Product[] {
    return appState.products;
  },
  getById(id: string): Product | undefined {
    return appState.products.find(p => p.id === id);
  },
  add(product: Product): void {
    appState.products.push(product);
  },
  update(id: string, updates: Partial<Product>): void {
    const idx = appState.products.findIndex(p => p.id === id);
    if (idx > -1) {
      appState.products[idx] = { ...appState.products[idx], ...updates };
    }
  },
  remove(id: string): void {
    appState.products = appState.products.filter(p => p.id !== id);
  }
};
