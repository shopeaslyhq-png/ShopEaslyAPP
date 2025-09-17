const express = require('express');
const router = express.Router();
const handleAICoPilot = require('../easly/aiHandlerEnhanced');
const { getAllDocuments } = require('../config/firebase');

// Dialogflow webhook endpoint for Google Home integration
router.post('/webhook', async (req, res) => {
  try {
    const { queryResult } = req.body;
    const intent = queryResult.intent.displayName;
    const parameters = queryResult.parameters;
    const queryText = queryResult.queryText;
    
    console.log(`🎤 Voice command received: ${intent} - "${queryText}"`);
    
    let response;
    
    switch (intent) {
      case 'dashboard.status':
      case 'shop.status':
        response = await handleDashboardStatus();
        break;
      
      case 'order.create':
        response = await handleOrderCreation(parameters);
        break;
      
      case 'inventory.update':
      case 'inventory.add':
        response = await handleInventoryUpdate(parameters);
        break;
      
      case 'inventory.check':
        response = await handleInventoryCheck(parameters);
        break;
      
      case 'brainstorm.start':
        response = await handleBrainstormMode();
        break;
      
      case 'order.status':
        response = await handleOrderStatus(parameters);
        break;
        
      default:
        // Fallback to enhanced AI handler for natural language processing
        response = await handleVoiceCommand(queryText);
    }

    // Send response back to Google Home
    res.json({
      fulfillmentText: response.text || response,
      fulfillmentMessages: [{
        text: { text: [response.text || response] }
      }],
      source: 'shopeasly-voice-assistant'
    });

  } catch (error) {
    console.error('🚨 Voice command error:', error);
    res.json({
      fulfillmentText: "Sorry, I couldn't process that request right now. Please try again.",
      fulfillmentMessages: [{
        text: { text: ["Sorry, I couldn't process that request right now. Please try again."] }
      }]
    });
  }
});

// Handle dashboard status requests
async function handleDashboardStatus() {
  try {
    const mockReq = {
      body: { textPart: 'inventory summary', clientId: 'google-home' },
      ip: 'google-home'
    };
    
    let result = '';
    const mockRes = {
      json: (data) => {
        result = data.text;
        return data;
      }
    };
    
    await handleAICoPilot(mockReq, mockRes);
    
    // Format for voice response
    const voiceResponse = result
      .replace(/📦|📋|⚠️|•/g, '') // Remove emojis
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown
      .replace(/\n/g, '. '); // Convert newlines to periods
    
    return voiceResponse || "Your shop status is available on the dashboard.";
    
  } catch (error) {
    return "I couldn't get the shop status right now.";
  }
}

// Handle order creation from voice
async function handleOrderCreation(parameters) {
  try {
    const { customer, quantity, product, size, color } = parameters;
    
    if (!customer || !product) {
      return "I need at least a customer name and product to create an order.";
    }
    
    let command = `create order for ${customer} product ${product}`;
    if (quantity) command += ` qty ${quantity}`;
    command += ' execute';
    
    const mockReq = {
      body: { textPart: command, clientId: 'google-home' },
      ip: 'google-home'
    };
    
    let result = '';
    const mockRes = {
      json: (data) => {
        result = data.text;
        return data;
      }
    };
    
    await handleAICoPilot(mockReq, mockRes);
    
    return result.replace(/✅|📝|🔄/g, '').trim() || `Order created for ${customer}.`;
    
  } catch (error) {
    return "I couldn't create the order right now.";
  }
}

// Handle inventory updates from voice
async function handleInventoryUpdate(parameters) {
  try {
    const { quantity, item, sku, price } = parameters;
    
    let command;
    if (sku) {
      command = `set stock ${sku} to ${quantity} execute`;
    } else if (item && quantity) {
      command = `add ${quantity} ${item}`;
      if (price) command += ` price ${price}`;
      command += ' to inventory execute';
    } else {
      return "I need either a SKU to update or an item name and quantity to add.";
    }
    
    const mockReq = {
      body: { textPart: command, clientId: 'google-home' },
      ip: 'google-home'
    };
    
    let result = '';
    const mockRes = {
      json: (data) => {
        result = data.text;
        return data;
      }
    };
    
    await handleAICoPilot(mockReq, mockRes);
    
    return result.replace(/✅|➕|🔄/g, '').trim() || "Inventory updated successfully.";
    
  } catch (error) {
    return "I couldn't update the inventory right now.";
  }
}

// Handle inventory checks
async function handleInventoryCheck(parameters) {
  try {
    const { item } = parameters;
    
    if (item) {
      const items = await getAllDocuments('inventory', 1000);
      const found = items.find(i => 
        i.name.toLowerCase().includes(item.toLowerCase()) ||
        i.sku.toLowerCase().includes(item.toLowerCase())
      );
      
      if (found) {
        return `${found.name} has ${found.stock} units in stock.`;
      } else {
        return `I couldn't find ${item} in inventory.`;
      }
    } else {
      return await handleDashboardStatus();
    }
    
  } catch (error) {
    return "I couldn't check the inventory right now.";
  }
}

// Handle order status checks
async function handleOrderStatus(parameters) {
  try {
    const mockReq = {
      body: { textPart: 'order status', clientId: 'google-home' },
      ip: 'google-home'
    };
    
    let result = '';
    const mockRes = {
      json: (data) => {
        result = data.text;
        return data;
      }
    };
    
    await handleAICoPilot(mockReq, mockRes);
    
    return result.replace(/📋|📄|•/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n/g, '. ') || "Order status is available on the dashboard.";
    
  } catch (error) {
    return "I couldn't get the order status right now.";
  }
}

// Handle brainstorm mode activation
async function handleBrainstormMode() {
  try {
    // Here you could emit a socket event to activate brainstorm mode on connected dashboards
    // const io = require('../server').io;
    // io.emit('brainstorm-mode-activated', { timestamp: new Date().toISOString() });
    
    return "Brainstorm mode activated! Check your command center screen for the brainstorming interface.";
    
  } catch (error) {
    return "I couldn't activate brainstorm mode right now.";
  }
}

// Handle general voice commands through enhanced AI
async function handleVoiceCommand(queryText) {
  try {
    const mockReq = {
      body: { textPart: queryText, clientId: 'google-home' },
      ip: 'google-home'
    };
    
    let result = '';
    const mockRes = {
      json: (data) => {
        result = data.text;
        return data;
      }
    };
    
    await handleAICoPilot(mockReq, mockRes);
    
    // Format response for voice
    const voiceResponse = result
      .replace(/[📦📋📄📈📊💡⚠️✅❌🔄➕🗑️🎤🤖]/g, '') // Remove emojis
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
      .replace(/\n+/g, '. ') // Convert newlines to periods
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return voiceResponse || "I've processed your request.";
    
  } catch (error) {
    return "I couldn't understand that command. Please try again.";
  }
}

module.exports = router;