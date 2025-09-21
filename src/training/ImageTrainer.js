import * as tf from '@tensorflow/tfjs';

class ProductImageTrainer {
    constructor() {
        this.model = null;
        this.categories = [
            'apparel', 
            'drinkware', 
            'stickers', 
            'prints', 
            'accessories', 
            'materials', 
            'packaging',
            'electronics',
            'home-decor',
            'office-supplies'
        ];
        this.modelName = 'product-classifier-v2';
        this.trainingDataPath = 'product-training-data';
        this.imageSize = [224, 224, 3];
    }

    // Initialize training environment
    async initialize() {
        console.log('🚀 Initializing Product Image Trainer...');
        
        // Set backend (prefer webgl for speed)
        try {
            await tf.setBackend('webgl');
            console.log('✅ Using WebGL backend for training');
        } catch (error) {
            await tf.setBackend('cpu');
            console.log('⚠️ Fallback to CPU backend');
        }
        
        console.log(`🎯 Training for ${this.categories.length} product categories`);
        return true;
    }

    // Load training images from various sources
    async loadTrainingData() {
        console.log('📚 Loading training data...');
        
        const trainingData = [];
        const labels = [];
        
        try {
            // Method 1: Load from uploaded images in the uploads folder
            const uploadedImages = await this.loadUploadedImages();
            trainingData.push(...uploadedImages.images);
            labels.push(...uploadedImages.labels);
            
            // Method 2: Load from inventory product images
            const inventoryImages = await this.loadInventoryImages();
            trainingData.push(...inventoryImages.images);
            labels.push(...inventoryImages.labels);
            
            // Method 3: Generate synthetic training data
            const syntheticImages = await this.generateSyntheticData();
            trainingData.push(...syntheticImages.images);
            labels.push(...syntheticImages.labels);
            
            console.log(`📊 Loaded ${trainingData.length} training images`);
            console.log(`🏷️ Categories: ${[...new Set(labels)].join(', ')}`);
            
            return { images: trainingData, labels };
            
        } catch (error) {
            console.error('❌ Error loading training data:', error);
            return { images: [], labels: [] };
        }
    }

    // Load images from uploads folder
    async loadUploadedImages() {
        const images = [];
        const labels = [];
        
        // In a real environment, you'd scan the uploads directory
        // For now, we'll create a method that can be extended
        try {
            // This would be implemented with file system access in Node.js
            // For browser environment, we'll use a different approach
            console.log('📁 Scanning uploaded images...');
            
            // Placeholder for actual file loading logic
            // In production, this would scan directories and load images
            
            return { images, labels };
        } catch (error) {
            console.log('⚠️ No uploaded images found');
            return { images: [], labels: [] };
        }
    }

    // Load images from inventory data
    async loadInventoryImages() {
        const images = [];
        const labels = [];
        
        try {
            // Load inventory data
            const inventoryResponse = await fetch('/api/inventory');
            const inventory = await inventoryResponse.json();
            
            for (const product of inventory) {
                if (product.image_url) {
                    try {
                        const imageElement = await this.loadImageFromUrl(product.image_url);
                        const category = this.mapProductCategoryToTrainingCategory(product.category);
                        
                        images.push(imageElement);
                        labels.push(category);
                    } catch (error) {
                        console.log(`⚠️ Could not load image for ${product.name}`);
                    }
                }
            }
            
            console.log(`📦 Loaded ${images.length} images from inventory`);
            return { images, labels };
            
        } catch (error) {
            console.log('⚠️ Could not load inventory images');
            return { images: [], labels: [] };
        }
    }

    // Generate synthetic training data for categories with few examples
    async generateSyntheticData() {
        const images = [];
        const labels = [];
        
        // Create simple synthetic images for training
        // This helps when you don't have enough real images
        for (const category of this.categories) {
            const syntheticCount = 10; // Generate 10 synthetic images per category
            
            for (let i = 0; i < syntheticCount; i++) {
                const syntheticImage = this.createSyntheticImage(category);
                images.push(syntheticImage);
                labels.push(category);
            }
        }
        
        console.log(`🎨 Generated ${images.length} synthetic training images`);
        return { images, labels };
    }

    // Create synthetic image for a category
    createSyntheticImage(category) {
        // Create a canvas element for synthetic image generation
        const canvas = document.createElement('canvas');
        canvas.width = 224;
        canvas.height = 224;
        const ctx = canvas.getContext('2d');
        
        // Generate category-specific synthetic images
        const categoryColors = {
            apparel: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
            drinkware: ['#96CEB4', '#FFEAA7', '#DDA0DD'],
            stickers: ['#FD79A8', '#FDCB6E', '#E17055'],
            prints: ['#74B9FF', '#A29BFE', '#FD79A8'],
            accessories: ['#FDCB6E', '#E84393', '#00B894'],
            materials: ['#636E72', '#B2BEC3', '#DDD'],
            packaging: ['#8D6C42', '#F39C12', '#E74C3C']
        };
        
        const colors = categoryColors[category] || ['#74B9FF', '#FD79A8', '#FDCB6E'];
        
        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, 224, 224);
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(0.5, colors[1] || colors[0]);
        gradient.addColorStop(1, colors[2] || colors[0]);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 224, 224);
        
        // Add category-specific shapes
        this.addCategoryShapes(ctx, category);
        
        return canvas;
    }

    // Add category-specific shapes to synthetic images
    addCategoryShapes(ctx, category) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        
        switch (category) {
            case 'apparel':
                // Draw shirt-like shape
                ctx.fillRect(50, 50, 124, 80);
                ctx.fillRect(80, 30, 64, 40);
                break;
                
            case 'drinkware':
                // Draw mug shape
                ctx.beginPath();
                ctx.arc(112, 112, 50, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillRect(140, 100, 20, 24);
                break;
                
            case 'stickers':
                // Draw circular sticker
                ctx.beginPath();
                ctx.arc(112, 112, 40, 0, 2 * Math.PI);
                ctx.fill();
                break;
                
            case 'prints':
                // Draw frame
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 8;
                ctx.strokeRect(40, 40, 144, 144);
                break;
                
            default:
                // Generic rectangle
                ctx.fillRect(60, 60, 104, 104);
        }
    }

    // Map product categories to training categories
    mapProductCategoryToTrainingCategory(productCategory) {
        const categoryMap = {
            'tshirts': 'apparel',
            'hoodies': 'apparel',
            'mugs': 'drinkware',
            'bottles': 'drinkware',
            'sticker': 'stickers',
            'poster': 'prints',
            'canvas': 'prints',
            'bag': 'accessories',
            'phone-case': 'accessories'
        };
        
        return categoryMap[productCategory?.toLowerCase()] || 'accessories';
    }

    // Load image from URL
    async loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    // Create custom CNN model for product classification
    async createCustomModel() {
        console.log('🏗️ Building custom CNN model...');
        
        const model = tf.sequential({
            layers: [
                // First convolutional block
                tf.layers.conv2d({
                    inputShape: this.imageSize,
                    filters: 32,
                    kernelSize: 3,
                    activation: 'relu',
                    padding: 'same'
                }),
                tf.layers.batchNormalization(),
                tf.layers.maxPooling2d({ poolSize: 2 }),
                
                // Second convolutional block
                tf.layers.conv2d({
                    filters: 64,
                    kernelSize: 3,
                    activation: 'relu',
                    padding: 'same'
                }),
                tf.layers.batchNormalization(),
                tf.layers.maxPooling2d({ poolSize: 2 }),
                
                // Third convolutional block
                tf.layers.conv2d({
                    filters: 128,
                    kernelSize: 3,
                    activation: 'relu',
                    padding: 'same'
                }),
                tf.layers.batchNormalization(),
                tf.layers.maxPooling2d({ poolSize: 2 }),
                
                // Flatten and dense layers
                tf.layers.flatten(),
                tf.layers.dense({
                    units: 256,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.5 }),
                tf.layers.dense({
                    units: 128,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: this.categories.length,
                    activation: 'softmax'
                })
            ]
        });

        // Compile model with appropriate optimizer and loss
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        console.log('✅ Model architecture created');
        model.summary();
        
        return model;
    }

    // Preprocess images for training
    preprocessImages(images) {
        console.log('🔄 Preprocessing images...');
        
        const processedImages = images.map(img => {
            // Convert to tensor
            let tensor = tf.browser.fromPixels(img);
            
            // Resize to standard size
            tensor = tf.image.resizeBilinear(tensor, [224, 224]);
            
            // Normalize pixel values to [0, 1]
            tensor = tensor.div(255.0);
            
            return tensor;
        });
        
        // Stack into batch tensor
        return tf.stack(processedImages);
    }

    // Convert labels to one-hot encoding
    encodeLabels(labels) {
        console.log('🏷️ Encoding labels...');
        
        const labelIndices = labels.map(label => {
            const index = this.categories.indexOf(label);
            return index >= 0 ? index : 0; // Default to first category if not found
        });
        
        return tf.oneHot(labelIndices, this.categories.length);
    }

    // Train the model with loaded data
    async trainModel(images, labels, options = {}) {
        const {
            epochs = 50,
            batchSize = 16,
            validationSplit = 0.2,
            patience = 10
        } = options;
        
        console.log('🏋️ Starting model training...');
        console.log(`📊 Training with ${images.length} images for ${epochs} epochs`);
        
        try {
            // Create model
            const model = await this.createCustomModel();
            
            // Preprocess data
            const xs = this.preprocessImages(images);
            const ys = this.encodeLabels(labels);
            
            console.log(`📐 Input shape: ${xs.shape}`);
            console.log(`🎯 Output shape: ${ys.shape}`);
            
            // Training callbacks
            const callbacks = {
                onEpochEnd: (epoch, logs) => {
                    console.log(`Epoch ${epoch + 1}/${epochs}:`);
                    console.log(`  Loss: ${logs.loss.toFixed(4)}`);
                    console.log(`  Accuracy: ${(logs.acc * 100).toFixed(2)}%`);
                    
                    if (logs.val_loss) {
                        console.log(`  Val Loss: ${logs.val_loss.toFixed(4)}`);
                        console.log(`  Val Accuracy: ${(logs.val_acc * 100).toFixed(2)}%`);
                    }
                },
                
                onTrainEnd: () => {
                    console.log('🎉 Training completed!');
                }
            };
            
            // Train the model
            const history = await model.fit(xs, ys, {
                epochs,
                batchSize,
                validationSplit,
                callbacks,
                shuffle: true
            });
            
            // Save the trained model
            await this.saveModel(model);
            
            // Clean up tensors
            xs.dispose();
            ys.dispose();
            
            this.model = model;
            
            // Return training results
            return {
                model,
                history: history.history,
                finalAccuracy: history.history.acc[history.history.acc.length - 1],
                finalValAccuracy: history.history.val_acc ? history.history.val_acc[history.history.val_acc.length - 1] : null
            };
            
        } catch (error) {
            console.error('❌ Training failed:', error);
            throw error;
        }
    }

    // Save trained model
    async saveModel(model) {
        try {
            const saveUrl = `indexeddb://${this.modelName}`;
            await model.save(saveUrl);
            console.log(`💾 Model saved to ${saveUrl}`);
            
            // Also save model metadata
            const metadata = {
                categories: this.categories,
                version: '2.0',
                trainedAt: new Date().toISOString(),
                imageSize: this.imageSize
            };
            
            localStorage.setItem(`${this.modelName}-metadata`, JSON.stringify(metadata));
            console.log('📋 Model metadata saved');
            
        } catch (error) {
            console.error('❌ Error saving model:', error);
            throw error;
        }
    }

    // Load previously trained model
    async loadModel() {
        try {
            const loadUrl = `indexeddb://${this.modelName}`;
            const model = await tf.loadLayersModel(loadUrl);
            
            // Load metadata
            const metadataStr = localStorage.getItem(`${this.modelName}-metadata`);
            if (metadataStr) {
                const metadata = JSON.parse(metadataStr);
                this.categories = metadata.categories;
                console.log(`📋 Loaded model trained on ${this.categories.length} categories`);
            }
            
            this.model = model;
            console.log('✅ Trained model loaded successfully');
            return model;
            
        } catch (error) {
            console.log('⚠️ No trained model found, will need to train new model');
            return null;
        }
    }

    // Classify a single image
    async classifyImage(imageElement) {
        if (!this.model) {
            await this.loadModel();
            if (!this.model) {
                throw new Error('No trained model available. Please train a model first.');
            }
        }
        
        try {
            // Preprocess image
            let tensor = tf.browser.fromPixels(imageElement);
            tensor = tf.image.resizeBilinear(tensor, [224, 224]);
            tensor = tensor.div(255.0);
            tensor = tensor.expandDims(0); // Add batch dimension
            
            // Make prediction
            const predictions = await this.model.predict(tensor);
            const probabilities = await predictions.data();
            
            // Get top predictions
            const results = this.categories.map((category, index) => ({
                category,
                probability: probabilities[index],
                confidence: (probabilities[index] * 100).toFixed(2) + '%'
            }));
            
            // Sort by probability
            results.sort((a, b) => b.probability - a.probability);
            
            // Clean up
            tensor.dispose();
            predictions.dispose();
            
            return results;
            
        } catch (error) {
            console.error('❌ Classification error:', error);
            throw error;
        }
    }

    // Evaluate model performance
    async evaluateModel(testImages, testLabels) {
        if (!this.model) {
            throw new Error('No model loaded for evaluation');
        }
        
        console.log('📊 Evaluating model performance...');
        
        try {
            const xs = this.preprocessImages(testImages);
            const ys = this.encodeLabels(testLabels);
            
            const evaluation = await this.model.evaluate(xs, ys);
            const loss = await evaluation[0].data();
            const accuracy = await evaluation[1].data();
            
            console.log(`📈 Evaluation Results:`);
            console.log(`  Test Loss: ${loss[0].toFixed(4)}`);
            console.log(`  Test Accuracy: ${(accuracy[0] * 100).toFixed(2)}%`);
            
            // Clean up
            xs.dispose();
            ys.dispose();
            evaluation[0].dispose();
            evaluation[1].dispose();
            
            return {
                loss: loss[0],
                accuracy: accuracy[0]
            };
            
        } catch (error) {
            console.error('❌ Evaluation failed:', error);
            throw error;
        }
    }

    // Get training status and model info
    getTrainingStatus() {
        const metadata = localStorage.getItem(`${this.modelName}-metadata`);
        
        return {
            hasTrainedModel: !!this.model,
            modelExists: !!metadata,
            categories: this.categories,
            lastTrained: metadata ? JSON.parse(metadata).trainedAt : null,
            version: metadata ? JSON.parse(metadata).version : null
        };
    }

    // Clean up resources
    dispose() {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
        console.log('🧹 Training resources cleaned up');
    }
}

export default ProductImageTrainer;