
import { GoogleGenAI, Type, Chat } from "@google/genai";
import * as XLSX from "xlsx";
import DOMPurify from "dompurify";
import { marked } from "marked";

// --- GLOBAL STATE & CONSTANTS ---
// Support both Vite and Node environments for API_KEY
const API_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_KEY) 
    ? (import.meta as any).env.VITE_API_KEY 
    : (typeof process !== 'undefined' && process.env && process.env.API_KEY) 
        ? process.env.API_KEY 
        : undefined;
let ai: GoogleGenAI | null = null;

const appState: any = {
    currentView: 'sos-homepage', // This can be a hub ID or an inner view ID
    products: [],
    materials: [],
    packaging: [],
    orders: [],
    designs: [],
    aiChat: null as Chat | null,
    generatedImageData: null as any,
};

// --- SPEECH RECOGNITION SETUP ---
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
let recognition: any;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
}

// --- MAIN APPLICATION CLASS ---
export class ShopEaslyApp {

    updateDashboardGiantBtns(): void {
        if (this.giantProductsCount) this.giantProductsCount.textContent = String(appState.products.length);
        if (this.giantMaterialsCount) this.giantMaterialsCount.textContent = String(appState.materials.length);
        if (this.giantPackagingCount) this.giantPackagingCount.textContent = String(appState.packaging.length);
        if (this.giantOrdersList) {
            const orders = appState.orders.slice(0, 3).map((o: any) => {
                const items = (o.items || []).map((i: any) => {
                    const p = this.findItemById('products', i.productId);
                    return p ? p.name : 'Item';
                }).join(', ');
                return `<div>${o.customer}: ${items} <span style='color:#888;'>[${o.status}]</span></div>`;
            }).join('');
            this.giantOrdersList.innerHTML = orders || '<div style="color:#aaa;">No orders</div>';
        }
    }
    // A subset of critical DOM Elements for easy access
    [key: string]: HTMLElement | any;

    constructor() {
        console.log("Constructing ShopEaslyApp...");
        this.cacheDOMElements();
        this.init();
    }

    init() {
        console.log('ShopEasly App Initializing...');
        
        // DEFERRED AI INITIALIZATION: This is the critical fix.
        // Initialize AI only if the key exists. This prevents the entire app from crashing on start.
        if (API_KEY) {
            ai = new GoogleGenAI({ apiKey: API_KEY });
        } else {
            this.showToast('API_KEY is not configured. AI features will be disabled.', 'error');
            console.error("VITE_API_KEY is missing. Create a .env file in the project root and add VITE_API_KEY=your_key_here");
        }
        
        this.loadTheme();
        this.loadMockData();
        this.bindEvents(); // New robust event binding
        this.navigateTo(appState.currentView, true);
        this.updateAllStats();
        this.renderAllTables();
        this.updateDashboardGiantBtns();
        console.log('ShopEasly App Initialized Successfully.');
    }

    cacheDOMElements() {
        const ids = [
            'app', 'main-content', 'app-views', 'sidebar-toggle-btn', 'add-new-btn-header',
            'stat-active-orders', 'stat-in-production', 'stat-completed-today', 'stat-low-stock',
            'mcc-stat-active-orders', 'mcc-stat-in-production', 'mcc-stat-low-stock',
            'hp-stat-active-orders', 'hp-stat-in-production', 'hp-stat-completed-today', 'hp-stat-low-stock',
            'brainstorm-prompt', 'brainstorm-generate-btn', 'brainstorm-results',
            'orders-table', 'finished-goods-table', 'materials-table', 'packaging-table',
            'idea-form', 'prompt-input', 'refine-prompt-btn', 'generate-btn', 'image-output-container', 'loading-indicator', 'error-message', 'save-design-section', 'save-design-form', 'design-name', 'create-product-btn', 'save-design-btn',
            'creator-form', 'creator-prompt-input', 'creator-generate-btn', 'creator-output',
            'fulfillment-list', 'order-status-filter',
            'item-modal-overlay', 'close-modal-btn', 'modal-title', 'item-form', 'item-id', 'item-type', 'item-name', 'item-name-label', 'item-sku', 'price-form-group', 'item-price', 'item-stock', 'item-stock-threshold', 'item-supplier', 'item-notes',
            'order-modal-overlay', 'close-order-modal-btn', 'order-modal-title', 'order-form', 'order-id', 'order-customer-name', 'order-status', 'order-items-container', 'add-order-item-btn', 'order-total-price', 'order-notes',
            'ai-fab-btn', 'ai-assistant-modal', 'ai-modal-close-btn', 'ai-chat-history', 'ai-text-input', 'ai-voice-btn', 'ai-send-btn', 'ai-status-text', 'ai-guide-btn', 'ai-guide-modal', 'ai-guide-close-btn',
            'toast-notification', 'file-input-excel',
            'giant-products-count', 'giant-materials-count', 'giant-packaging-count', 'giant-orders-list'
        ];
        ids.forEach(id => {
            this[id.replace(/-./g, m => m[1].toUpperCase())] = document.getElementById(id);
        });
        
        // Fatal error check for critical elements
        const criticalElements = ['app', 'appViews', 'main-content'];
        for (const elName of criticalElements) {
            const camelCaseName = elName.replace(/-./g, m => m[1].toUpperCase());
            if (!this[camelCaseName]) {
                throw new Error(`FATAL: Critical element with ID '${elName}' not found. App cannot start.`);
            }
        }
    }
    
    bindEvents() {
        const body = document.body;

        // Use event delegation for dynamically added content and robustness
        body.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Sidebar toggle
            if (target.closest('#sidebar-toggle-btn')) {
                this.app?.classList.toggle('sidebar-open');
                return;
            }

            // Close sidebar on content click (mobile)
            if (this.app?.classList.contains('sidebar-open') && target.closest('#main-content')) {
                this.app?.classList.remove('sidebar-open');
            }

            // Theme buttons
            const themeBtn = target.closest('.theme-btn');
            if (themeBtn) {
                this.setTheme(themeBtn.getAttribute('data-theme'));
                return;
            }

            // Navigation (Giant Dashboard Buttons, Sidebar, Hub Cards, Widgets)
            const navTarget = target.closest('[data-view]');
            if (navTarget) {
                this.navigateTo(navTarget.getAttribute('data-view')!);
                return;
            }

            // Generic data-action buttons
            const actionTarget = target.closest('[data-action]');
            if (actionTarget) {
                this.handleDataAction(actionTarget.getAttribute('data-action')!, actionTarget.getAttribute('data-id'));
                return;
            }
            
            // Modal closes
            if (target.closest('.modal-close-btn') || target.classList.contains('modal-overlay')) {
                target.closest('.modal-overlay')?.classList.add('hidden');
                return;
            }
            
            // AI Assistant
            if (target.closest('#ai-fab-btn')) this.toggleAIModal(true);
            if (target.closest('#ai-voice-btn')) this.toggleMicListener();
            if (target.closest('#ai-send-btn')) this.sendTextMessage();
            if (target.closest('#ai-guide-btn')) this.aiGuideModal?.classList.remove('hidden');

            // Order form item management
            if (target.closest('#add-order-item-btn')) this.addOrderItemRow();
            if (target.closest('.remove-order-item-btn')) {
                target.closest('.order-item-row')?.remove();
                this.updateOrderTotal();
            }
        });

        // Form submissions
        this.itemForm?.addEventListener('submit', (e: Event) => this.handleItemFormSubmit(e));
        this.orderForm?.addEventListener('submit', (e: Event) => this.handleOrderFormSubmit(e));
        // Brainstorm bar (new compact UI)
        this.brainstormGenerateBtn?.addEventListener('click', () => this.generateBrainstormIdeas());
        this.brainstormPrompt?.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.generateBrainstormIdeas();
            }
        });
        this.ideaForm?.addEventListener('submit', (e: Event) => { e.preventDefault(); this.generateIdeaImage(); });
        this.creatorForm?.addEventListener('submit', (e: Event) => { e.preventDefault(); this.generateCreatorDoc(); });
        this.saveDesignForm?.addEventListener('submit', (e: Event) => { e.preventDefault(); this.saveDesign(); });
        
        // Other specific listeners
        this.fileInputExcel?.addEventListener('change', (e: any) => this.handleExcelUpload(e));

        // AI text input handlers
        if (this.aiTextInput) {
            this.aiTextInput.addEventListener('input', () => this.handleTextInputChange());
            this.aiTextInput?.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendTextMessage();
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
        this.orderStatusFilter?.addEventListener('change', () => this.renderFulfillmentOrders());
        this.orderItemsContainer?.addEventListener('change', () => this.updateOrderTotal());
        this.orderItemsContainer?.addEventListener('input', () => this.updateOrderTotal());
        this.refinePromptBtn?.addEventListener('click', () => this.refineImagePrompt());
        this.createProductBtn?.addEventListener('click', () => this.createProductFromDesign());

        // AI Assistant Speech Recognition
         if (recognition) {
            recognition.onresult = (event: any) => this.handleVoiceResult(event);
            recognition.onerror = (event: any) => this.handleVoiceError(event);
            recognition.onend = () => this.setMicState('idle');
        }
    }

    // --- NAVIGATION & UI ---

    navigateTo(viewId: string, isInitial = false) {
        if (!viewId) return;
        console.log(`Navigating to: ${viewId}`);

        // Close sidebar on navigation for mobile
        if (!isInitial) {
            this.app?.classList.remove('sidebar-open');
        }

        // Offline AI modal toggles (move to a click event handler)
        document.body.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('#offline-ai-toggle-btn')) {
                this.showOfflineAIModal();
                return;
            }
            if (target.closest('#offline-ai-close-btn') || (target.closest('#offline-ai-modal') && target.id === 'offline-ai-modal')) {
                this.hideOfflineAIModal();
                return;
            }
        });
        appState.currentView = viewId;

        // Define which views belong inside the main app panel
        const mainAppViews = new Set([
            'dashboard-view', 'orders-view', 'finished-goods-view',
            'materials-view', 'packaging-view', 'ideas-view'
        ]);
        
        let targetContainerId = viewId;
        let targetInnerViewId: string | null = null;
        
        // Determine the parent container and inner view
        if (mainAppViews.has(viewId)) {
            targetContainerId = 'shopeasly-app-panel';
            targetInnerViewId = viewId;
        } else if (viewId === 'shopeasly-app-panel') {
            // Default to dashboard when clicking the main app panel card
            targetContainerId = 'shopeasly-app-panel';
            targetInnerViewId = 'dashboard-view';
        }
        
        // Hide all top-level view containers
        this.appViews?.querySelectorAll('.app-view-container').forEach((container: HTMLElement) => {
            container.classList.add('hidden');
        });
        
        // Show the target top-level container
        const targetContainer = document.getElementById(targetContainerId);
        if (targetContainer) {
            targetContainer.classList.remove('hidden');
        } else {
            console.error(`Navigation error: Container with id '${targetContainerId}' not found.`);
            // Fallback to homepage if container is not found
            document.getElementById('sos-homepage')?.classList.remove('hidden');
            appState.currentView = 'sos-homepage';
            return;
        }

        // Handle inner views for the app panel
        if (targetContainerId === 'shopeasly-app-panel') {
            targetContainer.querySelectorAll('.view-container').forEach((view) => {
                (view as HTMLElement).classList.add('hidden');
            });
            if (targetInnerViewId) {
                document.getElementById(targetInnerViewId)?.classList.remove('hidden');
            }
        }
        
        this.updateSidebar(targetInnerViewId || targetContainerId);
        this.updateHeader(targetInnerViewId || targetContainerId);

        // Refresh data for specific views
        if (viewId === 'sos-tablet') {
            this.renderFulfillmentOrders();
        }
    }
    
    updateSidebar(activeViewId: string) {
        const navButtons = document.querySelectorAll('.sidebar-nav .nav-btn');
        navButtons.forEach(btn => {
            if (!btn) return;
            const btnView = btn.getAttribute('data-view');
            const isProductNav = activeViewId === 'finished-goods-view' && btn.id === 'nav-products';
            if (btnView === activeViewId || isProductNav) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    updateHeader(viewId: string) {
        const viewToActionMap: { [key: string]: string } = {
            'orders-view': 'add-order',
            'finished-goods-view': 'add-product',
            'materials-view': 'add-material',
            'packaging-view': 'add-packaging',
        };
        const action = viewToActionMap[viewId];
        if (action && this.addNewBtnHeader) {
            this.addNewBtnHeader.classList.remove('hidden');
            this.addNewBtnHeader.dataset.action = action;
        } else if (this.addNewBtnHeader) {
            this.addNewBtnHeader.classList.add('hidden');
        }
    }

    handleDataAction(action: string, id: string | null) {
        switch (action) {
            case 'add-order':
            case 'add-product':
            case 'add-material':
            case 'add-packaging':
                this.openModalFor(action, null);
                break;
            case 'edit-order':
            case 'edit-product':
            case 'edit-material':
            case 'edit-packaging':
                this.openModalFor(action, id);
                break;
            case 'delete-order':
            case 'delete-product':
            case 'delete-material':
            case 'delete-packaging':
                this.handleDeleteClick(action, id!);
                break;
            case 'upload-excel':
                this.fileInputExcel?.click();
                break;
            case 'go-to-ideas':
                this.navigateTo('ideas-view');
                break;
            case 'next-status':
                this.advanceOrderStatus(id!);
                break;
        }
    }
    
    showToast(message: string, type = 'info') {
        if (!this.toastNotification) return;
        this.toastNotification.textContent = message;
        this.toastNotification.className = `show ${type}`;
        setTimeout(() => {
            if (this.toastNotification) {
                this.toastNotification.className = this.toastNotification.className.replace('show', '');
            }
        }, 3000);
    }

    setTheme(theme: string | null) {
        if (!theme) return;
        document.body.dataset.theme = theme;
        localStorage.setItem('shopeasly-theme', theme);
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', (btn as HTMLElement).dataset.theme === theme);
        });
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('shopeasly-theme') || 'dark';
        this.setTheme(savedTheme);
    }
    
    // --- DATA MANAGEMENT ---
    
    loadMockData() {
        appState.products = [
            { id: 'p1', name: 'Gemini Logo T-Shirt', sku: 'TS-GEM-01', price: 29.99, stock: 150, threshold: 20, supplier: 'Printify', notes: '100% Cotton' },
            { id: 'p2', name: 'AI-Generated Art Poster', sku: 'PO-ART-01', price: 19.99, stock: 80, threshold: 10, supplier: 'Local Prints', notes: 'Matte finish' },
        ];
        appState.materials = [
            { id: 'm1', name: 'Black T-Shirt Blank (L)', sku: 'TS-BLK-L', stock: 200, threshold: 50, supplier: 'Bulk Tees Inc.', notes: '' },
            { id: 'm2', name: 'White Ink Cartridge', sku: 'INK-WHT-01', stock: 15, threshold: 5, supplier: 'Print Supplies Co', notes: '' },
        ];
        appState.packaging = [
            { id: 'pkg1', name: '12x10 Poly Mailer', sku: 'MAIL-POLY-12', stock: 500, threshold: 100, supplier: 'Shipping Depot', notes: 'For t-shirts' },
        ];
        appState.orders = [
            { id: 101, customer: 'John Doe', items: [{ productId: 'p1', quantity: 2 }], status: 'New', notes: 'Gift message included', date: new Date() },
            { id: 102, customer: 'Jane Smith', items: [{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }], status: 'In Production', notes: '', date: new Date() },
        ];
    }
    
    renderAllTables() {
        this.renderTable('products', this.finishedGoodsTable, ['Name', 'SKU', 'Price', 'Stock'], (item: any) => [
            `<img src="https://storage.googleapis.com/onlyimagesfortj/for%20the%20app/Gemini_Generated_Image_l6f5qul6f5qul6f5.png" alt="${item.name}" class="table-img">${item.name}`,
            item.sku,
            `$${item.price.toFixed(2)}`,
            `${item.stock} ${item.stock <= item.threshold ? '⚠️' : ''}`
        ]);
        this.renderTable('materials', this.materialsTable, ['Name', 'SKU', 'Stock'], (item: any) => [
            item.name,
            item.sku,
            `${item.stock} ${item.stock <= item.threshold ? '⚠️' : ''}`
        ]);
        this.renderTable('packaging', this.packagingTable, ['Name', 'SKU', 'Stock'], (item: any) => [
            item.name,
            item.sku,
            `${item.stock} ${item.stock <= item.threshold ? '⚠️' : ''}`
        ]);
        this.renderTable('orders', this.ordersTable, ['Order ID', 'Customer', 'Items', 'Status', 'Date'], (item: any) => {
             const itemsStr = item.items.map((i: any) => {
                const product = this.findItemById('products', i.productId);
                return `${i.quantity}x ${product ? product.name : 'Unknown'}`;
             }).join(', ');
             const date = new Date(item.date).toLocaleDateString();
             return [`#${item.id}`, item.customer, itemsStr, `<span class="status-badge status-${item.status.toLowerCase().replace(' ', '-')}">${item.status}</span>`, date];
        });
    }

    renderTable(type: string, tableElement: HTMLElement, headers: string[], rowRenderer: (item: any) => string[]) {
        if (!tableElement) return;
        const data = appState[type];
        const singularType = type.slice(0, -1);
        let html = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}<th>Actions</th></tr></thead><tbody>`;
        if (data.length === 0) {
            html += `<tr><td colspan="${headers.length + 1}" class="empty-state-small">No items found.</td></tr>`;
        } else {
            html += data.map((item: any) => `
                <tr data-id="${item.id}">
                    ${rowRenderer(item).map(cell => `<td>${cell}</td>`).join('')}
                    <td class="actions-cell">
                        <button class="btn btn-icon" data-action="edit-${singularType}" data-id="${item.id}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button class="btn btn-icon" data-action="delete-${singularType}" data-id="${item.id}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </td>
                </tr>
            `).join('');
        }
        html += '</tbody>';
        tableElement.innerHTML = html;
    }
    
    updateAllStats() {
        const activeOrders = appState.orders.filter((o: any) => o.status === 'New').length;
        const inProduction = appState.orders.filter((o: any) => o.status === 'In Production').length;
        const today = new Date().setHours(0,0,0,0);
        const completedToday = appState.orders.filter((o: any) => new Date(o.date).setHours(0,0,0,0) === today && o.status === 'Completed').length;
        const lowStock = [...appState.products, ...appState.materials, ...appState.packaging].filter((i: any) => i.stock <= i.threshold).length;

        if(this.statActiveOrders) this.statActiveOrders.textContent = String(activeOrders);
        if(this.statInProduction) this.statInProduction.textContent = String(inProduction);
        if(this.statCompletedToday) this.statCompletedToday.textContent = String(completedToday);
        if(this.statLowStock) this.statLowStock.textContent = String(lowStock);

        if(this.mccStatActiveOrders) this.mccStatActiveOrders.textContent = String(activeOrders);
        if(this.mccStatInProduction) this.mccStatInProduction.textContent = String(inProduction);
        if(this.mccStatLowStock) this.mccStatLowStock.textContent = String(lowStock);

        if(this.hpStatActiveOrders) this.hpStatActiveOrders.textContent = String(activeOrders);
        if(this.hpStatInProduction) this.hpStatInProduction.textContent = String(inProduction);
        if(this.hpStatCompletedToday) this.hpStatCompletedToday.textContent = String(completedToday);
        if(this.hpStatLowStock) this.hpStatLowStock.textContent = String(lowStock);
    }
    
    findItemById(type: string, id: string | number) {
        return appState[type].find((item: any) => item.id == id);
    }
    
    // --- MODAL & FORM LOGIC ---
    
    openModalFor(action: string, itemId: string | number | null) {
        const typeMap: { [key: string]: any } = {
            'add-order': { type: 'order' },
            'edit-order': { type: 'order' },
            'add-product': { type: 'product', title: 'New Product' },
            'edit-product': { type: 'product', title: 'Edit Product' },
            'add-material': { type: 'material', title: 'New Material' },
            'edit-material': { type: 'material', title: 'Edit Material' },
            'add-packaging': { type: 'packaging', title: 'New Packaging' },
            'edit-packaging': { type: 'packaging', title: 'Edit Packaging' },
        };
        const config = typeMap[action];
        if (!config) return;

        if (config.type === 'order') {
            this.openOrderModal(itemId);
        } else {
            this.openItemModal(config.type, config.title, itemId);
        }
    }

    openItemModal(type: string, title: string, id: string | number | null) {
        this.itemForm?.reset();
        if (this.modalTitle) this.modalTitle.textContent = title;
        if (this.itemType) this.itemType.value = type;
        if (this.itemId) this.itemId.value = id || '';
        
        const isProduct = type === 'product';
        this.priceFormGroup?.classList.toggle('hidden', !isProduct);
        if (this.itemNameLabel) this.itemNameLabel.textContent = isProduct ? 'Product Name' : 'Name';
        
        if (id) {
            const item = this.findItemById(`${type}s`, id);
            if (item) {
                if (this.itemName) this.itemName.value = item.name;
                if (this.itemSku) this.itemSku.value = item.sku;
                if (isProduct && this.itemPrice) this.itemPrice.value = String(item.price);
                if (this.itemStock) this.itemStock.value = String(item.stock);
                if (this.itemStockThreshold) this.itemStockThreshold.value = String(item.threshold);
                if (this.itemSupplier) this.itemSupplier.value = item.supplier;
                if (this.itemNotes) this.itemNotes.value = item.notes;
            }
        }
        
        this.itemModalOverlay?.classList.remove('hidden');
    }

    handleItemFormSubmit(e: Event) {
        e.preventDefault();
        const id = this.itemId.value;
        const type = this.itemType.value;
        const data = {
            id: id || `item_${Date.now()}`,
            name: this.itemName.value,
            sku: this.itemSku.value,
            price: parseFloat(this.itemPrice.value) || 0,
            stock: parseInt(this.itemStock.value),
            threshold: parseInt(this.itemStockThreshold.value) || 0,
            supplier: this.itemSupplier.value,
            notes: this.itemNotes.value
        };
        
        const dataArray = appState[`${type}s`];
        const existingIndex = dataArray.findIndex((i: any) => i.id === id);

        if (existingIndex > -1) {
            dataArray[existingIndex] = { ...dataArray[existingIndex], ...data };
            this.showToast(`${type} updated successfully.`, 'success');
        } else {
            dataArray.push(data);
            this.showToast(`${type} added successfully.`, 'success');
        }

        this.renderAllTables();
        this.updateAllStats();
        this.itemModalOverlay?.classList.add('hidden');
    }

    openOrderModal(id: string | number | null) {
        this.orderForm?.reset();
        if(this.orderId) this.orderId.value = id || '';
        if(this.orderItemsContainer) this.orderItemsContainer.innerHTML = '';

        if (id) {
            if(this.orderModalTitle) this.orderModalTitle.textContent = `Edit Order #${id}`;
            const order = this.findItemById('orders', id);
            if (order) {
                if(this.orderCustomerName) this.orderCustomerName.value = order.customer;
                if(this.orderStatus) this.orderStatus.value = order.status;
                if(this.orderNotes) this.orderNotes.value = order.notes;
                order.items.forEach((item: any) => this.addOrderItemRow(item.productId, item.quantity));
            }
        } else {
            if(this.orderModalTitle) this.orderModalTitle.textContent = 'New Order';
            this.addOrderItemRow();
        }
        this.updateOrderTotal();
        this.orderModalOverlay?.classList.remove('hidden');
    }

    handleOrderFormSubmit(e: Event) {
        e.preventDefault();
        const id = this.orderId.value;
        const items: any[] = [];
        this.orderItemsContainer?.querySelectorAll('.order-item-row').forEach((row: any) => {
            const productId = (row.querySelector('select') as HTMLSelectElement).value;
            const quantity = parseInt((row.querySelector('input') as HTMLInputElement).value);
            if (productId && quantity > 0) {
                items.push({ productId, quantity });
            }
        });

        if (items.length === 0) {
            this.showToast('Please add at least one item to the order.', 'error');
            return;
        }

        const data: any = {
            id: id || Math.max(0, ...appState.orders.map((o: any) => o.id)) + 1,
            customer: this.orderCustomerName.value,
            status: this.orderStatus.value,
            notes: this.orderNotes.value,
            date: new Date(),
            items: items,
        };

        const existingIndex = appState.orders.findIndex((o: any) => o.id == id);
        if (existingIndex > -1) {
            data.date = appState.orders[existingIndex].date; // Keep original date
            appState.orders[existingIndex] = data;
            this.showToast(`Order #${id} updated successfully.`, 'success');
        } else {
            appState.orders.push(data);
            this.showToast(`Order #${data.id} created successfully.`, 'success');
        }
        
        this.renderAllTables();
        this.updateAllStats();
        this.orderModalOverlay?.classList.add('hidden');
    }

    addOrderItemRow(productId = '', quantity = 1) {
        const row = document.createElement('div');
        row.className = 'order-item-row';
        
        const select = document.createElement('select');
        select.className = 'form-input order-item-select';
        select.innerHTML = appState.products.map((p: any) => `<option value="${p.id}" ${p.id === productId ? 'selected' : ''}>${p.name} - $${p.price.toFixed(2)}</option>`).join('');
        
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.className = 'form-input order-item-qty';
        qtyInput.value = String(quantity);
        qtyInput.min = "1";
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-icon remove-order-item-btn';
        removeBtn.innerHTML = '&times;';
        
        row.append(select, qtyInput, removeBtn);
        this.orderItemsContainer?.appendChild(row);
    }
    
    updateOrderTotal() {
        let total = 0;
        this.orderItemsContainer?.querySelectorAll('.order-item-row').forEach((row: any) => {
            const productId = (row.querySelector('select') as HTMLSelectElement).value;
            const quantity = parseInt((row.querySelector('input') as HTMLInputElement).value) || 0;
            const product = this.findItemById('products', productId);
            if(product) {
                total += product.price * quantity;
            }
        });
        if(this.orderTotalPrice) this.orderTotalPrice.textContent = `Total: $${total.toFixed(2)}`;
    }

    // --- EVENT HANDLERS ---
    
    handleDeleteClick(action: string, id: string) {
        const type = action.split('-')[1]; // "product"
        
        if (confirm(`Are you sure you want to delete this ${type}?`)) {
            const dataArrayName = `${type}s`;
            const dataArray = appState[dataArrayName];
            appState[dataArrayName] = dataArray.filter((i: any) => i.id != id);
            this.showToast(`${type} deleted.`, 'success');
            this.renderAllTables();
            this.updateAllStats();
        }
    }
    
    // --- FULFILLMENT VIEW ---
    renderFulfillmentOrders() {
        if (!this.fulfillmentList || !this.orderStatusFilter) return;
        const filterStatus = this.orderStatusFilter.value;
        const ordersToDisplay = appState.orders.filter((o: any) => o.status === filterStatus);
        
        if (ordersToDisplay.length === 0) {
            this.fulfillmentList.innerHTML = `<div class="empty-state">No ${filterStatus.toLowerCase()} orders.</div>`;
            return;
        }

        this.fulfillmentList.innerHTML = ordersToDisplay.map((order: any) => `
            <div class="fulfillment-card">
                <div class="card-header">
                    <h3>Order #${order.id}</h3>
                    <p>Customer: ${order.customer}</p>
                </div>
                <div class="item-list">
                    ${order.items.map((item: any) => {
                        const product = this.findItemById('products', item.productId);
                        return `<div class="item"><span class="quantity">${item.quantity}x</span> ${product ? product.name : 'Unknown Product'}</div>`;
                    }).join('')}
                </div>
                <div class="card-actions">
                    <button class="btn btn-primary" data-id="${order.id}" data-action="next-status">${this.getNextStatusActionText(order.status)}</button>
                </div>
            </div>
        `).join('');
    }
    
    getNextStatusActionText(status: string) {
        const statusMap: { [key: string]: string } = {
            'New': 'Start Production',
            'In Production': 'Mark as Completed',
            'Completed': 'Mark as Shipped',
        };
        return statusMap[status] || 'Done';
    }

    advanceOrderStatus(orderId: string) {
        const order = this.findItemById('orders', orderId);
        if (!order) return;
        
        const nextStatusMap: { [key: string]: string } = {
            'New': 'In Production',
            'In Production': 'Completed',
            'Completed': 'Shipped',
        };
        
        const nextStatus = nextStatusMap[order.status];
        if (nextStatus) {
            order.status = nextStatus;
            this.showToast(`Order #${order.id} moved to ${nextStatus}`, 'info');
            this.renderFulfillmentOrders();
            this.updateAllStats();
            this.renderAllTables();
        }
    }

    // --- GEMINI API FEATURES ---

    // Stateful, conversational brainstorm flow
    brainstormState: any = null;
    async generateBrainstormIdeas() {
        if (!ai) return this.showToast('AI is not configured.', 'error');
        if (!this.brainstormPrompt) return;
        const prompt = this.brainstormPrompt.value.trim();
        if (!prompt) return;

        this.setLoadingState(this.brainstormGenerateBtn, true);
        if (this.brainstormResults) {
            this.brainstormResults.style.display = 'none';
            this.brainstormResults.innerHTML = '';
        }

        try {
            // Loosen filter: allow any prompt that isn't clearly off-topic
            const offTopic = /(weather|joke|movie|music|celebrity|politics|sports|news|recipe|travel|game|roleplay|story|fanfic|fiction|poem|song|lyrics|astrology|horoscope|dating|relationship|personal|therapy|medical|legal|finance|investment|crypto|stock|betting|gambling|adult|nsfw|inappropriate)/i;
            if (offTopic.test(prompt)) {
                if (this.brainstormResults) {
                    this.brainstormResults.innerHTML = 'I’m only able to assist with shop and dashboard operations.';
                    this.brainstormResults.style.display = 'block';
                }
                this.setLoadingState(this.brainstormGenerateBtn, false);
                return;
            }

            // Step 1: Brainstorm product idea (short, direct)
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Suggest a new product for an e-commerce shop. Reply with: Name: ...\nDescription: ...` 
            });
            let idea = response.text || '';
            let nameMatch = idea.match(/Name:\s*(.+)/i);
            let descMatch = idea.match(/Description:\s*(.+)/i);
            let productName = nameMatch ? nameMatch[1].trim() : 'New Product';
            let productDesc = descMatch ? descMatch[1].trim() : '';

            // Initialize state for conversational flow
            this.brainstormState = {
                name: productName,
                description: productDesc,
                material: '',
                image: '',
                price: '',
                qty: '',
                step: 'material',
                saved: false
            };
            this.renderBrainstormConversation();
        } catch (error) {
            console.error(error);
            this.showToast('Error generating ideas.', 'error');
        } finally {
            this.setLoadingState(this.brainstormGenerateBtn, false);
        }
    }

    renderBrainstormConversation() {
        if (!this.brainstormResults || !this.brainstormState) return;
        const s = this.brainstormState;
        let html = `<div style='margin-bottom:0.5rem;'><strong>${s.name}</strong><br><span style='color:#666;'>${s.description}</span></div>`;
        if (!s.saved) {
            html += `<form id='brainstorm-product-form' style='display:flex;flex-direction:column;gap:0.5rem;'>`;
            html += `<input class='form-input' id='brainstorm-material' placeholder='Material' maxlength='40' value='${s.material || ''}' required>`;
            html += `<input class='form-input' id='brainstorm-image' placeholder='Image URL or description' maxlength='120' value='${s.image || ''}' required>`;
            html += `<input class='form-input' id='brainstorm-price' type='number' min='0' step='0.01' placeholder='Price' value='${s.price || ''}' required>`;
            html += `<input class='form-input' id='brainstorm-qty' type='number' min='1' step='1' placeholder='Qty' value='${s.qty || ''}' required>`;
            html += `<div style='display:flex;gap:0.5rem;'>`;
            html += `<button type='submit' class='btn btn-primary'>Save</button>`;
            html += `<button type='button' class='btn btn-secondary' id='brainstorm-update-btn'>Update</button>`;
            html += `</div></form>`;
        } else {
            html += `<div class='success-text' style='margin-bottom:0.5rem;'>Saved.</div>`;
            html += `<button class='btn btn-secondary' id='brainstorm-create-order-btn'>Create Order</button>`;
        }
        this.brainstormResults.innerHTML = html;
        this.brainstormResults.style.display = 'block';

        // Form logic
        setTimeout(() => {
            if (!s.saved) {
                const form = document.getElementById('brainstorm-product-form') as HTMLFormElement;
                if (form) {
                    form.onsubmit = (ev) => {
                        ev.preventDefault();
                        s.material = (document.getElementById('brainstorm-material') as HTMLInputElement).value.trim();
                        s.image = (document.getElementById('brainstorm-image') as HTMLInputElement).value.trim();
                        s.price = (document.getElementById('brainstorm-price') as HTMLInputElement).value.trim();
                        s.qty = (document.getElementById('brainstorm-qty') as HTMLInputElement).value.trim();
                        if (!s.material || !s.image || !s.price || !s.qty) return;
                        // Save product
                        const newProduct = {
                            id: `p${Date.now()}`,
                            name: s.name,
                            description: s.description,
                            sku: '',
                            price: parseFloat(s.price),
                            stock: parseInt(s.qty),
                            threshold: 5,
                            supplier: '',
                            notes: s.material,
                            imageUrl: s.image
                        };
                        appState.products.push(newProduct);
                        this.renderAllTables();
                        this.updateAllStats();
                        s.saved = true;
                        s.productId = newProduct.id;
                        this.showToast('Saved.', 'success');
                        this.renderBrainstormConversation();
                    };
                }
                // Update fields button
                const updateBtn = document.getElementById('brainstorm-update-btn');
                if (updateBtn) {
                    updateBtn.onclick = () => {
                        s.material = (document.getElementById('brainstorm-material') as HTMLInputElement).value.trim();
                        s.image = (document.getElementById('brainstorm-image') as HTMLInputElement).value.trim();
                        s.price = (document.getElementById('brainstorm-price') as HTMLInputElement).value.trim();
                        s.qty = (document.getElementById('brainstorm-qty') as HTMLInputElement).value.trim();
                        this.showToast('Updated.', 'info');
                        this.renderBrainstormConversation();
                    };
                }
            } else {
                // Create order button
                const orderBtn = document.getElementById('brainstorm-create-order-btn');
                if (orderBtn && s.productId) {
                    orderBtn.onclick = () => {
                        this.openOrderModal(s.productId);
                    };
                }
            }
        }, 100);
    }
    
    async refineImagePrompt() {
        if (!ai) return this.showToast('AI is not configured.', 'error');
        if (!this.promptInput) return;
        const prompt = this.promptInput.value;
        if (!prompt) return;

        this.setLoadingState(this.refinePromptBtn, true);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `You are a creative assistant for an image generation AI. Take the following user prompt and expand it into a more detailed, vivid, and effective prompt for generating high-quality images. Add descriptive keywords related to style, lighting, and composition. User prompt: "${prompt}"`
            });
            this.promptInput.value = response.text;
        } catch (error) {
            console.error(error);
            this.showToast('Error refining prompt.', 'error');
        } finally {
            this.setLoadingState(this.refinePromptBtn, false);
        }
    }
    
    async generateIdeaImage() {
        if (!ai) return this.showToast('AI is not configured.', 'error');
        if (!this.promptInput) return;
        const promptText = this.promptInput.value;
        if (!promptText) return;

        this.loadingIndicator?.classList.remove('hidden');
        if (this.imageOutputContainer) this.imageOutputContainer.innerHTML = '';
        this.errorMessage?.classList.add('hidden');
        this.saveDesignSection?.classList.add('hidden');
        this.setLoadingState(this.generateBtn, true);

        try {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: promptText,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: (document.getElementById('aspect-ratio-select') as HTMLSelectElement).value as any,
                }
            });

            if (
                response.generatedImages &&
                response.generatedImages[0] &&
                response.generatedImages[0].image &&
                response.generatedImages[0].image.imageBytes
            ) {
                const base64Image = response.generatedImages[0].image.imageBytes;
                const imageUrl = `data:image/jpeg;base64,${base64Image}`;
                if (this.imageOutputContainer) {
                    this.imageOutputContainer.innerHTML = `<img src="${imageUrl}" alt="Generated design">`;
                }
                this.saveDesignSection?.classList.remove('hidden');
                if (this.designName) this.designName.value = '';
                
                appState.generatedImageData = { url: imageUrl, prompt: promptText };
            } else {
                throw new Error('No image was generated.');
            }

        } catch (error) {
            console.error(error);
            if (this.errorMessage) {
                this.errorMessage.textContent = 'Failed to generate image. Please try again.';
                this.errorMessage.classList.remove('hidden');
            }
        } finally {
            this.loadingIndicator?.classList.add('hidden');
            this.setLoadingState(this.generateBtn, false);
        }
    }

    saveDesign() {
        if (!this.designName) return;
        const name = this.designName.value;
        if (!name || !appState.generatedImageData) return;
        
        const newDesign = {
            id: `design_${Date.now()}`,
            name: name,
            prompt: appState.generatedImageData.prompt,
            imageUrl: appState.generatedImageData.url,
        };
        appState.designs.push(newDesign);
        this.showToast(`Design '${name}' saved!`, 'success');
        this.saveDesignSection?.classList.add('hidden');
        appState.generatedImageData = null;
    }
    
    createProductFromDesign() {
        if (!this.designName) return;
        const name = this.designName.value;
        if (!name) {
            this.showToast('Please enter a design name first.', 'error');
            return;
        }
        this.openModalFor('add-product', null);
        if (this.itemName) this.itemName.value = name;
        if (this.itemNotes) this.itemNotes.value = `Design from Ideas Hub. Prompt: ${appState.generatedImageData.prompt}`;
        this.saveDesignSection?.classList.add('hidden');
        appState.generatedImageData = null;
    }
    
    async generateCreatorDoc() {
        if (!ai) return this.showToast('AI is not configured.', 'error');
        if (!this.creatorPromptInput) return;
        const prompt = this.creatorPromptInput.value;
        if (!prompt) return;

        this.setLoadingState(this.creatorGenerateBtn, true);
        if(this.creatorOutput) this.creatorOutput.innerHTML = '<div class="spinner-large" style="display:block; margin: 2rem auto;"></div>';

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Create a professional document based on the following topic. Format it clearly using markdown, with headings, lists, and bold text for readability. Topic: "${prompt}"`
            });
            if (this.creatorOutput) this.creatorOutput.innerHTML = await this.safeMarkdown(response.text ?? '');
        } catch (error) {
            console.error(error);
            if (this.creatorOutput) this.creatorOutput.innerHTML = '<div class="error-text">Failed to generate document.</div>';
            this.showToast('Error generating document.', 'error');
        } finally {
            this.setLoadingState(this.creatorGenerateBtn, false);
        }
    }
    
    // --- AI ASSISTANT (VOICE) ---
    
    async toggleAIModal(show: boolean) {
        if (!ai) return this.showToast('AI is not configured.', 'error');
        if (show) {
            this.aiAssistantModal?.classList.remove('hidden');
            if (!appState.aiChat) {
                appState.aiChat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: {
                        systemInstruction: `You are "Easly", an AI assistant for the ShopEasly e-commerce management app. Your goal is to help the user manage their store by voice. When the user gives a command, you MUST respond ONLY with a JSON object following the provided schema. Do not add any conversational text or markdown formatting. The action must be one of the following: 'create', 'update', 'find', 'navigate', or 'unknown'. For 'create' or 'update', the entity must be one of 'product', 'material', 'packaging', or 'order'. The parameters object should contain all extracted information. If a parameter is missing, omit it from the object. If you cannot understand the command, respond with action: 'unknown'.`,
                    },
                });
                await this.addMessageToChat('model', 'Welcome! I’m Easly AI. How can I help you today?');
            }
        } else {
            this.aiAssistantModal?.classList.add('hidden');
            if (recognition) recognition.stop();
        }
    }

    setMicState(state: 'idle' | 'listening' | 'thinking') {
        if (!this.aiVoiceBtn || !this.aiStatusText) return;
        this.aiVoiceBtn.classList.remove('listening', 'thinking');
        if (state === 'listening') {
            this.aiVoiceBtn.classList.add('listening');
            this.aiStatusText.textContent = 'Listening...';
        } else if (state === 'thinking') {
            this.aiVoiceBtn.classList.add('thinking');
            this.aiStatusText.textContent = 'Processing...';
        } else {
            this.aiStatusText.textContent = 'Type a message or tap the mic for voice input';
        }
    }

    handleTextInputChange() {
        if (!this.aiTextInput || !this.aiSendBtn) return;
        const hasText = this.aiTextInput.value.trim().length > 0;
        this.aiSendBtn.disabled = !hasText;

        // Auto-resize textarea
        this.aiTextInput.style.height = 'auto';
        this.aiTextInput.style.height = Math.min(this.aiTextInput.scrollHeight, 120) + 'px';
    }

    async sendTextMessage() {
        if (!this.aiTextInput || !appState.aiChat) return;
        const message = this.aiTextInput.value.trim();
        if (!message) return;

        // Clear input and disable send button
        this.aiTextInput.value = '';
        this.handleTextInputChange();

        // Add user message to chat
        await this.addMessageToChat('user', message);

        // Set thinking state
        this.setMicState('thinking');

        try {
            // Send to AI
            const response = await appState.aiChat.sendMessage(message);
            await this.addMessageToChat('model', response.text);
        } catch (error) {
            console.error('AI Error:', error);
            await this.addMessageToChat('model', 'Sorry, I encountered an error. Please try again.');
        } finally {
            this.setMicState('idle');
        }
    }

    closeAllModals() {
        // Close all modals
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.add('hidden');
        });

        // Reset AI state
        this.setMicState('idle');
        if (recognition) recognition.stop();
    }

    toggleMicListener() {
        if (!recognition) {
            this.showToast("Speech recognition not supported in your browser.", "error");
            return;
        }

        if (this.aiMicContainer?.classList.contains('listening')) {
            recognition.stop();
            this.setMicState('idle');
        } else {
            recognition.start();
            this.setMicState('listening');
        }
    }

    async handleVoiceResult(event: any) {
        const transcript = event.results[0][0].transcript;
        this.setMicState('thinking');
        await this.addMessageToChat('user', transcript);
        this.processVoiceCommand(transcript);
    }
    
    handleVoiceError(event: any) {
        this.showToast(`Speech recognition error: ${event.error}`, 'error');
        this.setMicState('idle');
    }

    async processVoiceCommand(command: string) {
        if (!appState.aiChat) return;
        try {
            // Restrict Easly AI to shop and dashboard operations only
            const allowedEntities = ['product', 'material', 'packaging', 'order', 'inventory', 'dashboard', 'report', 'products', 'orders', 'materials', 'packagings', 'reports'];
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    action: { type: Type.STRING },
                    entity: { type: Type.STRING },
                    parameters: { 
                        type: Type.OBJECT,
                        properties: {
                           name: { type: Type.STRING },
                           stock: { type: Type.NUMBER },
                           id: { type: Type.NUMBER },
                           status: { type: Type.STRING },
                        },
                     },
                },
            };

            const response = await appState.aiChat.sendMessage({ 
                message: command, 
                config: { responseMimeType: "application/json", responseSchema } 
            });
            const jsonText = response.text.trim();
            let actionData;
            try {
                actionData = JSON.parse(jsonText);
            } catch (err) {
                actionData = { action: 'unknown' };
            }

            // If the action or entity is not allowed, respond with the restricted message
            if (!actionData.entity || !allowedEntities.includes(actionData.entity.toLowerCase()) || actionData.action === 'unknown') {
                await this.addMessageToChat('model', 'I’m only able to assist with shop and dashboard operations.');
                return;
            }

            await this.executeAICommand(actionData);

        } catch (error) {
            console.error("AI Command Error:", error);
            await this.addMessageToChat('model', "I’m only able to assist with shop and dashboard operations.");
        } finally {
            this.setMicState('idle');
        }
    }
    
    async executeAICommand(data: any) {
        const { action, entity, parameters } = data;
        let responseMessage = "I'm not sure how to do that. Please try another command.";

        // Always use a polite, professional, admin-aware tone
        switch(action) {
            case 'create': {
                const typeSingular = entity;
                const typePlural = `${entity}s`;
                if (appState[typePlural]) {
                    const newItem: any = {
                        id: `${typeSingular.slice(0,1)}${Date.now()}`,
                        name: parameters.name || `New ${entity}`,
                        stock: parameters.stock || 0,
                        sku: '', price: 0, threshold: 0, supplier: '', notes: '',
                    };
                    appState[typePlural].push(newItem);
                    this.renderAllTables();
                    this.updateAllStats();
                    responseMessage = `The new ${entity} “${newItem.name}” has been added. Would you like to review or update its details?`;
                    this.toggleAIModal(false);
                    this.openModalFor(`edit-${entity}`, newItem.id);
                }
                break;
            }
            case 'update': {
                if (entity === 'order' && parameters.id && parameters.status) {
                    const order = this.findItemById('orders', parameters.id);
                    if (order) {
                        order.status = parameters.status.charAt(0).toUpperCase() + parameters.status.slice(1);
                        this.renderAllTables();
                        this.updateAllStats();
                        responseMessage = `Order #${parameters.id} status is now “${order.status}.” The dashboard reflects this update.`;
                    } else {
                        responseMessage = `Order #${parameters.id} was not found. No changes were made.`;
                    }
                }
                break;
            }
            case 'navigate': {
                const viewMap: { [key: string]: string } = {
                    'orders': 'orders-view',
                    'products': 'finished-goods-view',
                    'materials': 'materials-view',
                    'dashboard': 'dashboard-view',
                    'ideas': 'ideas-view',
                    'reports': 'dashboard-view',
                };
                if (viewMap[entity]) {
                    this.navigateTo(viewMap[entity]);
                    responseMessage = `You’re now viewing the ${entity} page. Let me know if you need further assistance.`;
                    setTimeout(() => this.toggleAIModal(false), 1000);
                }
                break;
            }
            default:
                responseMessage = "I’m only able to assist with shop and dashboard operations.";
        }

        await this.addMessageToChat('model', responseMessage);
    }
    
    async addMessageToChat(role: string, text: string) {
        if (!this.aiChatHistory) return;
        const turnDiv = document.createElement('div');
        turnDiv.className = `chat-turn chat-turn-${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'markdown-content';
        contentDiv.innerHTML = await this.safeMarkdown(text);
        
        turnDiv.appendChild(contentDiv);
        this.aiChatHistory.appendChild(turnDiv);
        this.aiChatHistory.scrollTop = this.aiChatHistory.scrollHeight;
    }
    
    // --- UTILITIES ---
    
    setLoadingState(button: HTMLButtonElement, isLoading: boolean) {
        if (!button) return;
        button.dataset.loading = String(isLoading);
        button.disabled = isLoading;
    }

    async safeMarkdown(content: string) {
        // The content from the API can sometimes be null or undefined.
        if (typeof content !== 'string') {
            return '';
        }
        const parsed = await marked.parse(content);
        // Fallback to an empty string if parsed is undefined to prevent crash
        return DOMPurify.sanitize(parsed || '');
    }
    
    handleExcelUpload(event: Event) {
        const file = (event.target as HTMLInputElement).files![0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const productsSheet = workbook.Sheets[workbook.SheetNames[0]];
                const productsData: any[] = XLSX.utils.sheet_to_json(productsSheet);
                
                productsData.forEach((p: any) => {
                    appState.products.push({
                        id: `p_${Date.now()}_${Math.random()}`,
                        name: p.Name,
                        sku: p.SKU,
                        price: parseFloat(p.Price) || 0,
                        stock: parseInt(p.Stock) || 0,
                        threshold: parseInt(p['Low Stock Threshold']) || 0,
                        supplier: p.Supplier || '',
                        notes: p.Notes || ''
                    });
                });
                this.renderAllTables();
                this.updateAllStats();
                this.showToast(`${productsData.length} products imported successfully!`, 'success');
            } catch (error) {
                console.error("Failed to process Excel file:", error);
                this.showToast('There was an error processing the Excel file.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }
}
