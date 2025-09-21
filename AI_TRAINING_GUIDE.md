# 🤖 ShopEasly Offline AI Training Guide

This guide covers how to train and improve your offline AI system in ShopEasly. You currently have two AI systems:

1. **Offline TensorFlow.js Model** (Image Classification)
2. **Enhanced AI Handler** (Text Processing & Learning)

## 📋 Current AI Architecture

### 1. Offline Image Classification
- **File**: `src/EaslyOfflineAI.jsx`
- **Model**: MobileNet (pre-trained)
- **Purpose**: Product image classification
- **Storage**: IndexedDB for offline caching

### 2. Enhanced AI Handler
- **File**: `shopeasly-v11/easly/aiHandlerEnhanced.js`
- **Models**: OpenAI GPT-4 & Gemini
- **Purpose**: Conversational AI, inventory management, design generation
- **Learning**: Session-based context + conversation history

## 🎯 Training Your Offline AI

### Method 1: Enhanced Image Classification Training

#### Step 1: Create Custom Training Data
```javascript
// Create: src/training/ImageTrainer.js
import * as tf from '@tensorflow/tfjs';

class ProductImageTrainer {
    constructor() {
        this.model = null;
        this.categories = [
            'apparel', 'drinkware', 'stickers', 'prints', 
            'accessories', 'materials', 'packaging'
        ];
    }

    // Load your product images for training
    async loadTrainingData() {
        const trainingData = [];
        const labels = [];
        
        // Load images from your inventory
        for (const category of this.categories) {
            const images = await this.loadImagesForCategory(category);
            trainingData.push(...images);
            labels.push(...Array(images.length).fill(category));
        }
        
        return { images: trainingData, labels };
    }

    // Create a custom model for your products
    async createCustomModel() {
        const model = tf.sequential({
            layers: [
                tf.layers.conv2d({
                    inputShape: [224, 224, 3],
                    filters: 32,
                    kernelSize: 3,
                    activation: 'relu'
                }),
                tf.layers.maxPooling2d({ poolSize: 2 }),
                tf.layers.conv2d({ filters: 64, kernelSize: 3, activation: 'relu' }),
                tf.layers.maxPooling2d({ poolSize: 2 }),
                tf.layers.flatten(),
                tf.layers.dense({ units: 128, activation: 'relu' }),
                tf.layers.dropout({ rate: 0.5 }),
                tf.layers.dense({ 
                    units: this.categories.length, 
                    activation: 'softmax' 
                })
            ]
        });

        model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    // Train the model with your data
    async trainModel(images, labels) {
        const model = await this.createCustomModel();
        
        // Convert data to tensors
        const xs = tf.stack(images.map(img => tf.browser.fromPixels(img).resizeNearestNeighbor([224, 224]).expandDims()));
        const ys = tf.oneHot(labels.map(label => this.categories.indexOf(label)), this.categories.length);

        // Train the model
        await model.fit(xs, ys, {
            epochs: 50,
            batchSize: 32,
            validationSplit: 0.2,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
                }
            }
        });

        // Save the trained model
        await model.save('indexeddb://product-classifier');
        
        xs.dispose();
        ys.dispose();
        
        return model;
    }
}

export default ProductImageTrainer;
```

#### Step 2: Update the Offline AI Component
```javascript
// Update: src/EaslyOfflineAI.jsx
import React, { useRef, useState, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import ProductImageTrainer from "./training/ImageTrainer";

export default function EaslyOfflineAI() {
  const [model, setModel] = useState(null);
  const [prediction, setPrediction] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const imgRef = useRef();

  // Try to load custom model first, fallback to MobileNet
  const loadModel = async () => {
    setLoading(true);
    try {
      // Try to load custom trained model
      const customModel = await tf.loadLayersModel('indexeddb://product-classifier');
      setModel(customModel);
      console.log('✅ Loaded custom trained model');
    } catch (error) {
      // Fallback to MobileNet
      const { loadMobilenet } = await import("@tensorflow-models/mobilenet");
      const loadedModel = await loadMobilenet();
      setModel(loadedModel);
      console.log('📱 Loaded MobileNet model');
    }
    setLoading(false);
  };

  // Train a new model with your product data
  const trainNewModel = async () => {
    setIsTraining(true);
    const trainer = new ProductImageTrainer();
    
    try {
      console.log('📚 Loading training data...');
      const { images, labels } = await trainer.loadTrainingData();
      
      console.log('🏋️ Training model...');
      const trainedModel = await trainer.trainModel(images, labels);
      
      setModel(trainedModel);
      console.log('✅ Model training complete!');
    } catch (error) {
      console.error('❌ Training failed:', error);
    }
    
    setIsTraining(false);
  };

  // Enhanced prediction with product-specific categories
  const handleImageChange = async (e) => {
    if (!model) await loadModel();
    const file = e.target.files[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    imgRef.current.src = url;
    imgRef.current.onload = async () => {
      try {
        const results = await model.classify(imgRef.current);
        const topResult = results[0];
        setPrediction(`${topResult.className} (${(topResult.probability * 100).toFixed(1)}%)`);
      } catch (error) {
        console.error('Prediction error:', error);
        setPrediction('Error during classification');
      }
      URL.revokeObjectURL(url);
    };
  };

  return (
    <div style={{ maxWidth: 500, margin: "2em auto", textAlign: "center" }}>
      <h2>🤖 Easly AI: Smart Product Classifier</h2>
      
      <div style={{ margin: "1em 0" }}>
        <input type="file" accept="image/*" onChange={handleImageChange} />
        <button onClick={trainNewModel} disabled={isTraining} style={{ marginLeft: '10px' }}>
          {isTraining ? '🏋️ Training...' : '📚 Train New Model'}
        </button>
      </div>
      
      <div style={{ margin: "1em 0" }}>
        <img 
          ref={imgRef} 
          alt="" 
          style={{ 
            maxWidth: "100%", 
            maxHeight: 300, 
            display: prediction ? "block" : "none",
            border: "2px solid #ddd",
            borderRadius: "8px"
          }} 
        />
      </div>
      
      {loading && <div>🔄 Loading model...</div>}
      {isTraining && <div>🏋️ Training in progress... This may take several minutes.</div>}
      {prediction && (
        <div style={{ 
          background: '#e8f5e8', 
          padding: '10px', 
          borderRadius: '6px',
          margin: '10px 0'
        }}>
          <strong>🎯 Prediction:</strong> {prediction}
        </div>
      )}
      
      <div style={{ fontSize: "0.9em", color: "#666", marginTop: "1em" }}>
        📱 Model is cached for offline use • 📚 Train with your product images for better accuracy
      </div>
    </div>
  );
}
```

### Method 2: Enhanced Conversational AI Training

#### Step 1: Create Training Data Collector
```javascript
// Create: shopeasly-v11/training/ConversationTrainer.js
const fs = require('fs');
const path = require('path');

class ConversationTrainer {
    constructor() {
        this.trainingDataPath = path.join(__dirname, '..', 'data', 'training_conversations.json');
        this.modelDataPath = path.join(__dirname, '..', 'data', 'learned_responses.json');
    }

    // Collect successful interactions for training
    logSuccessfulInteraction(userInput, aiResponse, context = {}) {
        const trainingEntry = {
            timestamp: new Date().toISOString(),
            input: userInput,
            response: aiResponse,
            context,
            success: true,
            category: this.categorizeInput(userInput)
        };

        this.appendToTrainingData(trainingEntry);
    }

    // Categorize user inputs for better training
    categorizeInput(input) {
        const categories = {
            inventory: /(inventory|stock|add|remove|how many)/i,
            orders: /(order|purchase|buy|sell)/i,
            design: /(design|image|mockup|generate)/i,
            general: /(help|what|how|why|explain)/i
        };

        for (const [category, pattern] of Object.entries(categories)) {
            if (pattern.test(input)) return category;
        }
        return 'other';
    }

    // Learn from conversation patterns
    learnFromHistory() {
        const historyFile = path.join(__dirname, '..', 'data', 'ai_history.json');
        if (!fs.existsSync(historyFile)) return;

        const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        const patterns = this.extractPatterns(history);
        
        this.saveLearnedPatterns(patterns);
        return patterns;
    }

    // Extract common patterns from conversation history
    extractPatterns(history) {
        const patterns = {
            commonQuestions: {},
            successfulResponses: {},
            userIntents: {}
        };

        for (let i = 0; i < history.length - 1; i++) {
            const userMsg = history[i];
            const aiMsg = history[i + 1];

            if (userMsg.role === 'user' && aiMsg.role === 'assistant') {
                const question = userMsg.text.toLowerCase();
                
                // Track common questions
                patterns.commonQuestions[question] = (patterns.commonQuestions[question] || 0) + 1;
                
                // Track successful responses
                if (!patterns.successfulResponses[question]) {
                    patterns.successfulResponses[question] = [];
                }
                patterns.successfulResponses[question].push(aiMsg.text);
            }
        }

        return patterns;
    }

    // Generate improved responses based on learned patterns
    generateImprovedResponse(userInput, patterns) {
        const input = userInput.toLowerCase();
        
        // Check for exact matches first
        if (patterns.successfulResponses[input]) {
            const responses = patterns.successfulResponses[input];
            return responses[Math.floor(Math.random() * responses.length)];
        }

        // Check for partial matches
        for (const [question, responses] of Object.entries(patterns.successfulResponses)) {
            if (this.calculateSimilarity(input, question) > 0.7) {
                return responses[Math.floor(Math.random() * responses.length)];
            }
        }

        return null; // No learned response found
    }

    // Simple similarity calculation
    calculateSimilarity(str1, str2) {
        const words1 = str1.split(' ');
        const words2 = str2.split(' ');
        const intersection = words1.filter(word => words2.includes(word));
        return intersection.length / Math.max(words1.length, words2.length);
    }

    // Save training data
    appendToTrainingData(entry) {
        try {
            let data = [];
            if (fs.existsSync(this.trainingDataPath)) {
                data = JSON.parse(fs.readFileSync(this.trainingDataPath, 'utf8'));
            }
            data.push(entry);
            fs.writeFileSync(this.trainingDataPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving training data:', error);
        }
    }

    // Save learned patterns
    saveLearnedPatterns(patterns) {
        try {
            fs.writeFileSync(this.modelDataPath, JSON.stringify(patterns, null, 2));
        } catch (error) {
            console.error('Error saving learned patterns:', error);
        }
    }

    // Load learned patterns
    loadLearnedPatterns() {
        try {
            if (fs.existsSync(this.modelDataPath)) {
                return JSON.parse(fs.readFileSync(this.modelDataPath, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading learned patterns:', error);
        }
        return null;
    }
}

module.exports = ConversationTrainer;
```

#### Step 2: Integrate Training into AI Handler
```javascript
// Update: shopeasly-v11/easly/aiHandlerEnhanced.js
// Add this at the top of the file
const ConversationTrainer = require('../training/ConversationTrainer');
const trainer = new ConversationTrainer();

// Modify the main handler function to include learning
async function handleEnhancedRequest(req, res) {
    try {
        // ... existing code ...

        let response;
        
        // First, try to get response from learned patterns
        const learnedPatterns = trainer.loadLearnedPatterns();
        if (learnedPatterns) {
            const learnedResponse = trainer.generateImprovedResponse(text, learnedPatterns);
            if (learnedResponse) {
                response = learnedResponse;
                console.log('📚 Using learned response');
            }
        }

        // If no learned response, use existing AI logic
        if (!response) {
            // ... existing AI logic ...
            response = await processWithAI(text, clientId, imagePart);
        }

        // Log successful interactions for future learning
        if (response && !response.includes('error') && !response.includes('sorry')) {
            trainer.logSuccessfulInteraction(text, response, {
                clientId,
                hasImage: !!imagePart,
                timestamp: new Date().toISOString()
            });
        }

        // Periodically learn from conversation history
        if (Math.random() < 0.1) { // 10% chance to trigger learning
            setTimeout(() => {
                console.log('📚 Learning from conversation history...');
                trainer.learnFromHistory();
            }, 1000);
        }

        res.json({ response, action });

    } catch (error) {
        console.error('Enhanced AI error:', error);
        res.status(500).json({ error: 'AI processing failed' });
    }
}
```

### Method 3: Product-Specific Knowledge Training

#### Create Knowledge Base
```javascript
// Create: shopeasly-v11/training/ProductKnowledgeBase.js
const fs = require('fs');
const path = require('path');

class ProductKnowledgeBase {
    constructor() {
        this.knowledgePath = path.join(__dirname, '..', 'data', 'product_knowledge.json');
        this.inventoryPath = path.join(__dirname, '..', 'data', 'inventory.json');
    }

    // Build knowledge from your inventory
    buildKnowledgeBase() {
        const inventory = this.loadInventory();
        const knowledge = {
            products: {},
            categories: {},
            materials: {},
            pricing_patterns: {},
            last_updated: new Date().toISOString()
        };

        // Analyze products
        for (const product of inventory) {
            knowledge.products[product.name] = {
                category: product.category,
                price: product.price,
                description: product.description,
                materials: product.materials || [],
                tags: this.extractTags(product)
            };

            // Build category knowledge
            if (!knowledge.categories[product.category]) {
                knowledge.categories[product.category] = {
                    products: [],
                    avg_price: 0,
                    common_materials: []
                };
            }
            knowledge.categories[product.category].products.push(product.name);
        }

        // Calculate insights
        this.calculateInsights(knowledge, inventory);
        
        // Save knowledge base
        fs.writeFileSync(this.knowledgePath, JSON.stringify(knowledge, null, 2));
        
        return knowledge;
    }

    // Extract tags from product data
    extractTags(product) {
        const tags = [];
        const text = `${product.name} ${product.description}`.toLowerCase();
        
        // Common product tags
        const tagPatterns = {
            style: ['vintage', 'modern', 'retro', 'classic', 'trendy'],
            color: ['black', 'white', 'red', 'blue', 'green', 'yellow'],
            material: ['cotton', 'polyester', 'vinyl', 'ceramic', 'paper'],
            theme: ['space', 'nature', 'abstract', 'minimalist', 'bold']
        };

        for (const [category, words] of Object.entries(tagPatterns)) {
            for (const word of words) {
                if (text.includes(word)) {
                    tags.push(`${category}:${word}`);
                }
            }
        }

        return tags;
    }

    // Calculate pricing and category insights
    calculateInsights(knowledge, inventory) {
        // Category insights
        for (const [category, data] of Object.entries(knowledge.categories)) {
            const categoryProducts = inventory.filter(p => p.category === category);
            
            data.avg_price = categoryProducts.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0) / categoryProducts.length;
            data.product_count = categoryProducts.length;
            
            // Find common materials
            const allMaterials = categoryProducts.flatMap(p => p.materials || []);
            const materialCounts = {};
            allMaterials.forEach(m => materialCounts[m] = (materialCounts[m] || 0) + 1);
            
            data.common_materials = Object.entries(materialCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([material]) => material);
        }
    }

    // Load inventory data
    loadInventory() {
        try {
            if (fs.existsSync(this.inventoryPath)) {
                return JSON.parse(fs.readFileSync(this.inventoryPath, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading inventory:', error);
        }
        return [];
    }

    // Query knowledge base
    queryKnowledge(question) {
        try {
            if (!fs.existsSync(this.knowledgePath)) {
                this.buildKnowledgeBase();
            }
            
            const knowledge = JSON.parse(fs.readFileSync(this.knowledgePath, 'utf8'));
            const query = question.toLowerCase();
            
            // Product-specific queries
            for (const [productName, data] of Object.entries(knowledge.products)) {
                if (query.includes(productName.toLowerCase())) {
                    return this.formatProductInfo(productName, data);
                }
            }
            
            // Category queries
            for (const [category, data] of Object.entries(knowledge.categories)) {
                if (query.includes(category.toLowerCase())) {
                    return this.formatCategoryInfo(category, data);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error querying knowledge base:', error);
            return null;
        }
    }

    // Format product information
    formatProductInfo(name, data) {
        return `${name} is in our ${data.category} category, priced at $${data.price}. ${data.description || ''} ${data.materials.length ? `Materials: ${data.materials.join(', ')}` : ''}`;
    }

    // Format category information
    formatCategoryInfo(category, data) {
        return `Our ${category} category has ${data.product_count} products with an average price of $${data.avg_price.toFixed(2)}. Common materials include: ${data.common_materials.join(', ')}.`;
    }
}

module.exports = ProductKnowledgeBase;
```

## 🚀 Training Workflow

### Daily Training Routine

1. **Morning**: Run knowledge base update
```bash
# Add to your package.json scripts
"train-ai": "node scripts/train-ai.js"
```

2. **Create training script**:
```javascript
// Create: shopeasly-v11/scripts/train-ai.js
const ConversationTrainer = require('../training/ConversationTrainer');
const ProductKnowledgeBase = require('../training/ProductKnowledgeBase');

async function runDailyTraining() {
    console.log('🚀 Starting daily AI training...');
    
    // Update knowledge base
    const kb = new ProductKnowledgeBase();
    const knowledge = kb.buildKnowledgeBase();
    console.log('📚 Knowledge base updated');
    
    // Learn from conversations
    const trainer = new ConversationTrainer();
    const patterns = trainer.learnFromHistory();
    console.log('🧠 Conversation patterns learned');
    
    console.log('✅ Training complete!');
    console.log(`📊 Products in knowledge base: ${Object.keys(knowledge.products).length}`);
    console.log(`💬 Learned patterns: ${Object.keys(patterns.commonQuestions).length}`);
}

runDailyTraining().catch(console.error);
```

### Performance Monitoring

```javascript
// Create: shopeasly-v11/monitoring/AIPerformance.js
class AIPerformanceMonitor {
    constructor() {
        this.metricsPath = path.join(__dirname, '..', 'data', 'ai_metrics.json');
    }

    logInteraction(input, response, satisfaction = null) {
        const metric = {
            timestamp: new Date().toISOString(),
            input_length: input.length,
            response_length: response.length,
            response_time: Date.now() - this.startTime,
            satisfaction_score: satisfaction,
            category: this.categorizeInput(input)
        };

        this.saveMetric(metric);
    }

    generatePerformanceReport() {
        const metrics = this.loadMetrics();
        
        return {
            total_interactions: metrics.length,
            avg_response_time: metrics.reduce((sum, m) => sum + m.response_time, 0) / metrics.length,
            category_distribution: this.getCategoryDistribution(metrics),
            satisfaction_score: this.getAverageSatisfaction(metrics)
        };
    }
}
```

## 📊 Expected Results

After implementing this training system:

1. **Better Product Recognition**: AI will learn your specific product names and categories
2. **Improved Responses**: AI will use successful past responses for similar questions  
3. **Faster Processing**: Cached responses for common questions
4. **Personalized Experience**: AI learns your business patterns and terminology

## 🔧 Next Steps

1. Implement the training modules
2. Set up daily training routine
3. Monitor AI performance metrics
4. Gradually improve based on user feedback

Would you like me to implement any specific part of this training system?