// easly/dialogflowRoute.js
// Express route for handling Dialogflow webhook requests from Google Home
const express = require('express');
const router = express.Router();
const handleDialogflowQuery = require('./dialogflowHandler');

// POST /dialogflow/webhook
router.post('/webhook', async (req, res) => {
    const sessionId = req.body.sessionId || req.body.session || 'google-home-session';
    const textQuery = req.body.query || req.body.text || req.body.command || '';
    if (!textQuery) {
        return res.status(400).json({ error: 'No query provided' });
    }
    try {
        const result = await handleDialogflowQuery(textQuery, sessionId);
        let fulfillmentText = result.fulfillmentText;
        let data = null;
        const { getAllDocuments } = require('../config/firebase');
        switch (result.intent) {
            case 'ShowTopProducts': {
                // Get top 3 products by stock (or any logic you want)
                const items = await getAllDocuments('inventory', 100);
                const sorted = items.sort((a, b) => (b.stock || 0) - (a.stock || 0));
                const top = sorted.slice(0, 3);
                fulfillmentText = top.length
                    ? `Top products: ${top.map(i => `${i.name} (Stock: ${i.stock})`).join(', ')}`
                    : 'No products found.';
                data = top;
                break;
            }
            case 'CheckInventory': {
                // Check inventory for a specific product if provided
                const items = await getAllDocuments('inventory', 100);
                const productName = (result.parameters && result.parameters.product) ? String(result.parameters.product).toLowerCase() : null;
                let found = null;
                if (productName) {
                    found = items.find(i => i.name.toLowerCase().includes(productName));
                }
                if (found) {
                    fulfillmentText = `${found.name} has ${found.stock} units in stock.`;
                    data = found;
                } else if (productName) {
                    fulfillmentText = `I couldn't find inventory for ${productName}.`;
                } else {
                    fulfillmentText = `There are ${items.length} products in inventory.`;
                }
                break;
            }
            case 'OrderStatus': {
                // Check order status by order number or customer name
                const { getAllDocuments } = require('../config/firebase');
                const orders = await getAllDocuments('orders', 100);
                const orderNum = result.parameters && result.parameters.orderNumber;
                const customer = result.parameters && result.parameters.customerName;
                let found = null;
                if (orderNum) {
                    found = orders.find(o => o.orderNumber === orderNum);
                } else if (customer) {
                    found = orders.find(o => o.customerName.toLowerCase().includes(String(customer).toLowerCase()));
                }
                if (found) {
                    fulfillmentText = `Order ${found.orderNumber} for ${found.customerName} is currently ${found.status}.`;
                    data = found;
                } else {
                    fulfillmentText = 'Order not found.';
                }
                break;
            }
            default:
                // Use Dialogflow's default fulfillment
                break;
        }
        res.json({
            fulfillmentText,
            intent: result.intent,
            parameters: result.parameters,
            data,
            allResponse: result.allResponse
        });
    } catch (error) {
        res.status(500).json({ error: 'Dialogflow processing failed', details: error.message });
    }
});

module.exports = router;
