// Centralized, typed app state for ShopEasly

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  threshold: number;
  supplier: string;
  notes: string;
}

export interface Material {
  id: string;
  name: string;
  sku: string;
  stock: number;
  threshold: number;
  supplier: string;
  notes: string;
}

export interface Packaging {
  id: string;
  name: string;
  sku: string;
  stock: number;
  threshold: number;
  supplier: string;
  notes: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface Order {
  id: string | number;
  customer: string;
  items: OrderItem[];
  status: string;
  notes: string;
  date: Date | string;
}

export interface Notification {
  id: number;
  type: string;
  icon: string;
  text: string;
  time: number;
  read: boolean;
}

export interface AppState {
  currentView: string;
  products: Product[];
  materials: Material[];
  packaging: Packaging[];
  orders: Order[];
  designs: any[];
  aiChat: any;
  generatedImageData: any;
  notifications: Notification[];
  // Add filtered arrays for search if needed
  filteredProducts?: Product[];
  filteredMaterials?: Material[];
  filteredPackaging?: Packaging[];
  filteredOrders?: Order[];
  [key: string]: any; // Index signature for dynamic property access
}

export const appState: AppState = {
  currentView: 'sos-homepage',
  products: [],
  materials: [],
  packaging: [],
  orders: [],
  designs: [],
  aiChat: null,
  generatedImageData: null,
  notifications: [
    { id: 1, type: 'order', icon: '📝', text: 'New order #1234 received', time: Date.now() - 1000 * 60 * 5, read: false },
    { id: 2, type: 'stock', icon: '⚠️', text: 'Low stock: Gemini Logo T-Shirt', time: Date.now() - 1000 * 60 * 30, read: false },
    { id: 3, type: 'ai', icon: '🤖', text: 'AI brainstormed 3 new product ideas', time: Date.now() - 1000 * 60 * 60, read: true },
  ],
};
