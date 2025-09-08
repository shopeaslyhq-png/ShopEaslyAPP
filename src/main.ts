import './index.css';
import { ShopEaslyApp } from './ShopEaslyApp';

/**
 * Starts the application.
 */
function startApp() {
    try {
        new ShopEaslyApp();
    } catch (error) {
        console.error("Failed to initialize ShopEaslyApp:", error);
        // Optionally, display an error message to the user on the page itself.
        document.body.innerHTML = `<div style="text-align: center; padding: 2rem; font-family: sans-serif; color: #ff6b6b;">
            <h1>Application Error</h1>
            <p>A critical error occurred and the application could not start. Please check the console for details.</p>
        </div>`;
    }
}

// This robustly handles starting the app whether the script is loaded early or late.
if (document.readyState === 'loading') {
    // The document is still loading, wait for it to be ready.
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    // The DOM is already ready, start the app immediately.
    startApp();
}
