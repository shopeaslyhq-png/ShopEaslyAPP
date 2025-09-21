// Service for CRUD operations on packaging
import { appState, Packaging } from '../state/appState';

export const packagingService = {
  getAll(): Packaging[] {
    return appState.packaging;
  },
  getById(id: string): Packaging | undefined {
    return appState.packaging.find(p => p.id === id);
  },
  add(packaging: Packaging): void {
    appState.packaging.push(packaging);
  },
  update(id: string, updates: Partial<Packaging>): void {
    const idx = appState.packaging.findIndex(p => p.id === id);
    if (idx > -1) {
      appState.packaging[idx] = { ...appState.packaging[idx], ...updates };
    }
  },
  remove(id: string): void {
    appState.packaging = appState.packaging.filter(p => p.id !== id);
  }
};
