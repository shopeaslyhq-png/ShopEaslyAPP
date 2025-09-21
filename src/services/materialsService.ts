// Service for CRUD operations on materials
import { appState, Material } from '../state/appState';

export const materialsService = {
  getAll(): Material[] {
    return appState.materials;
  },
  getById(id: string): Material | undefined {
    return appState.materials.find(m => m.id === id);
  },
  add(material: Material): void {
    appState.materials.push(material);
  },
  update(id: string, updates: Partial<Material>): void {
    const idx = appState.materials.findIndex(m => m.id === id);
    if (idx > -1) {
      appState.materials[idx] = { ...appState.materials[idx], ...updates };
    }
  },
  remove(id: string): void {
    appState.materials = appState.materials.filter(m => m.id !== id);
  }
};
