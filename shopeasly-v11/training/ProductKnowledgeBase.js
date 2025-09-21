const fs = require('fs');
const path = require('path');

class ProductKnowledgeBase {
    constructor() {
        this.knowledgePath = path.join(__dirname, '..', 'data', 'product_knowledge.json');
        this.inventoryPath = path.join(__dirname, '..', 'data', 'inventory.json');
        this.ordersPath = path.join(__dirname, '..', 'data', 'orders.json');
        this.ideasPath = path.join(__dirname, '..', 'data', 'ideas.json');
    }

    // Build comprehensive knowledge base from all data sources
    async buildKnowledgeBase() {
        console.log('🏗️ Building product knowledge base...');
        
        try {
            const knowledge = {
                products: {},
                categories: {},
                materials: {},
                pricing_patterns: {},
                sales_insights: {},
                design_trends: {},
                business_metrics: {},
                last_updated: new Date().toISOString(),
                version: '1.0'
            };

            // Load all data sources
            const inventory = this.loadInventory();
            const orders = this.loadOrders();
            const ideas = this.loadIdeas();

            console.log(`📦 Loaded ${inventory.length} products`);
            console.log(`🛒 Loaded ${orders.length} orders`);
            console.log(`💡 Loaded ${ideas.length} design ideas`);

            // Build product knowledge
            this.buildProductKnowledge(knowledge, inventory);
            
            // Build category insights
            this.buildCategoryInsights(knowledge, inventory);
            
            // Build pricing patterns
            this.buildPricingPatterns(knowledge, inventory);
            
            // Build sales insights
            this.buildSalesInsights(knowledge, orders, inventory);
            
            // Build design trends
            this.buildDesignTrends(knowledge, ideas);
            
            // Calculate business metrics
            this.calculateBusinessMetrics(knowledge, inventory, orders);
            
            // Save knowledge base
            fs.writeFileSync(this.knowledgePath, JSON.stringify(knowledge, null, 2));
            
            console.log('✅ Knowledge base built successfully!');
            console.log(`📊 ${Object.keys(knowledge.products).length} products analyzed`);
            console.log(`🏷️ ${Object.keys(knowledge.categories).length} categories identified`);
            
            return knowledge;
            
        } catch (error) {
            console.error('❌ Error building knowledge base:', error);
            return null;
        }
    }

    // Build detailed product knowledge
    buildProductKnowledge(knowledge, inventory) {
        for (const product of inventory) {
            if (!product.name) continue;
            
            const productKey = product.name.toLowerCase();
            knowledge.products[productKey] = {
                original_name: product.name,
                category: product.category || 'uncategorized',
                price: this.parsePrice(product.price),
                description: product.description || '',
                materials: this.extractMaterials(product),
                tags: this.extractTags(product),
                colors: this.extractColors(product),
                sizes: this.extractSizes(product),
                keywords: this.generateKeywords(product),
                difficulty_level: this.assessDifficultyLevel(product),
                profit_margin: this.calculateProfitMargin(product),
                seasonal_relevance: this.assessSeasonalRelevance(product)
            };
        }
    }

    // Build category insights and patterns
    buildCategoryInsights(knowledge, inventory) {
        const categoryMap = {};
        
        for (const product of inventory) {
            const category = product.category || 'uncategorized';
            
            if (!categoryMap[category]) {
                categoryMap[category] = {
                    products: [],
                    total_value: 0,
                    price_range: { min: Infinity, max: 0 },
                    common_materials: {},
                    common_colors: {},
                    avg_profit: 0,
                    complexity_levels: {}
                };
            }
            
            const price = this.parsePrice(product.price);
            categoryMap[category].products.push(product.name);
            categoryMap[category].total_value += price;
            categoryMap[category].price_range.min = Math.min(categoryMap[category].price_range.min, price);
            categoryMap[category].price_range.max = Math.max(categoryMap[category].price_range.max, price);
            
            // Track materials
            const materials = this.extractMaterials(product);
            materials.forEach(material => {
                categoryMap[category].common_materials[material] = (categoryMap[category].common_materials[material] || 0) + 1;
            });
            
            // Track colors
            const colors = this.extractColors(product);
            colors.forEach(color => {
                categoryMap[category].common_colors[color] = (categoryMap[category].common_colors[color] || 0) + 1;
            });
        }
        
        // Calculate insights for each category
        for (const [category, data] of Object.entries(categoryMap)) {
            knowledge.categories[category] = {
                product_count: data.products.length,
                avg_price: data.total_value / data.products.length,
                price_range: {
                    min: data.price_range.min === Infinity ? 0 : data.price_range.min,
                    max: data.price_range.max
                },
                top_materials: this.getTopItems(data.common_materials, 5),
                top_colors: this.getTopItems(data.common_colors, 5),
                market_share: (data.products.length / inventory.length) * 100,
                profitability: this.calculateCategoryProfitability(data.products, inventory)
            };
        }
    }

    // Build pricing patterns and recommendations
    buildPricingPatterns(knowledge, inventory) {
        const patterns = {
            price_tiers: { budget: 0, mid: 0, premium: 0 },
            material_pricing: {},
            category_pricing: {},
            size_impact: {},
            complexity_pricing: {}
        };
        
        for (const product of inventory) {
            const price = this.parsePrice(product.price);
            
            // Price tiers
            if (price < 15) patterns.price_tiers.budget++;
            else if (price < 30) patterns.price_tiers.mid++;
            else patterns.price_tiers.premium++;
            
            // Material pricing
            const materials = this.extractMaterials(product);
            materials.forEach(material => {
                if (!patterns.material_pricing[material]) {
                    patterns.material_pricing[material] = { prices: [], avg: 0 };
                }
                patterns.material_pricing[material].prices.push(price);
            });
            
            // Category pricing
            const category = product.category || 'uncategorized';
            if (!patterns.category_pricing[category]) {
                patterns.category_pricing[category] = { prices: [], avg: 0 };
            }
            patterns.category_pricing[category].prices.push(price);
        }
        
        // Calculate averages
        for (const material of Object.keys(patterns.material_pricing)) {
            const prices = patterns.material_pricing[material].prices;
            patterns.material_pricing[material].avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        }
        
        for (const category of Object.keys(patterns.category_pricing)) {
            const prices = patterns.category_pricing[category].prices;
            patterns.category_pricing[category].avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        }
        
        knowledge.pricing_patterns = patterns;
    }

    // Build sales insights from order data
    buildSalesInsights(knowledge, orders, inventory) {
        const insights = {
            top_sellers: {},
            revenue_by_category: {},
            seasonal_trends: {},
            customer_preferences: {},
            reorder_patterns: {}
        };
        
        for (const order of orders) {
            if (!order.items || !Array.isArray(order.items)) continue;
            
            for (const item of order.items) {
                const productName = item.name || item.product;
                if (!productName) continue;
                
                // Track sales volume
                if (!insights.top_sellers[productName]) {
                    insights.top_sellers[productName] = { quantity: 0, revenue: 0 };
                }
                insights.top_sellers[productName].quantity += item.quantity || 1;
                insights.top_sellers[productName].revenue += (item.price || 0) * (item.quantity || 1);
                
                // Find product category
                const product = inventory.find(p => p.name === productName);
                if (product) {
                    const category = product.category || 'uncategorized';
                    if (!insights.revenue_by_category[category]) {
                        insights.revenue_by_category[category] = 0;
                    }
                    insights.revenue_by_category[category] += (item.price || 0) * (item.quantity || 1);
                }
            }
        }
        
        knowledge.sales_insights = insights;
    }

    // Build design trends from ideas data
    buildDesignTrends(knowledge, ideas) {
        const trends = {
            popular_themes: {},
            color_trends: {},
            style_preferences: {},
            seasonal_designs: {},
            trending_keywords: {}
        };
        
        for (const idea of ideas) {
            if (!idea.description) continue;
            
            const text = idea.description.toLowerCase();
            
            // Extract themes
            const themes = this.extractThemes(text);
            themes.forEach(theme => {
                trends.popular_themes[theme] = (trends.popular_themes[theme] || 0) + 1;
            });
            
            // Extract colors
            const colors = this.extractColorsFromText(text);
            colors.forEach(color => {
                trends.color_trends[color] = (trends.color_trends[color] || 0) + 1;
            });
            
            // Extract keywords
            const keywords = this.extractKeywordsFromText(text);
            keywords.forEach(keyword => {
                trends.trending_keywords[keyword] = (trends.trending_keywords[keyword] || 0) + 1;
            });
        }
        
        knowledge.design_trends = trends;
    }

    // Calculate comprehensive business metrics
    calculateBusinessMetrics(knowledge, inventory, orders) {
        const metrics = {
            total_products: inventory.length,
            total_categories: Object.keys(knowledge.categories).length,
            avg_product_price: 0,
            total_inventory_value: 0,
            most_profitable_category: null,
            growth_opportunities: [],
            optimization_suggestions: []
        };
        
        // Calculate averages
        const prices = inventory.map(p => this.parsePrice(p.price)).filter(p => p > 0);
        metrics.avg_product_price = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        metrics.total_inventory_value = prices.reduce((sum, p) => sum + p, 0);
        
        // Find most profitable category
        let maxProfitability = 0;
        for (const [category, data] of Object.entries(knowledge.categories)) {
            if (data.profitability > maxProfitability) {
                maxProfitability = data.profitability;
                metrics.most_profitable_category = category;
            }
        }
        
        // Generate optimization suggestions
        metrics.optimization_suggestions = this.generateOptimizationSuggestions(knowledge, inventory, orders);
        
        knowledge.business_metrics = metrics;
    }

    // Query knowledge base for intelligent responses
    queryKnowledge(question) {
        try {
            if (!fs.existsSync(this.knowledgePath)) {
                console.log('🏗️ Knowledge base not found, building...');
                this.buildKnowledgeBase();
            }
            
            const knowledge = JSON.parse(fs.readFileSync(this.knowledgePath, 'utf8'));
            const queryLower = question.toLowerCase();
            
            // Product-specific queries
            for (const [productKey, data] of Object.entries(knowledge.products)) {
                if (queryLower.includes(productKey) || queryLower.includes(data.original_name.toLowerCase())) {
                    return this.formatProductResponse(data);
                }
            }
            
            // Category queries
            for (const [category, data] of Object.entries(knowledge.categories)) {
                if (queryLower.includes(category.toLowerCase())) {
                    return this.formatCategoryResponse(category, data);
                }
            }
            
            // Pricing queries
            if (queryLower.includes('price') || queryLower.includes('cost') || queryLower.includes('expensive')) {
                return this.formatPricingResponse(knowledge.pricing_patterns);
            }
            
            // Sales queries
            if (queryLower.includes('sales') || queryLower.includes('popular') || queryLower.includes('selling')) {
                return this.formatSalesResponse(knowledge.sales_insights);
            }
            
            // Business metrics queries
            if (queryLower.includes('business') || queryLower.includes('profit') || queryLower.includes('analytics')) {
                return this.formatBusinessResponse(knowledge.business_metrics);
            }
            
            return null;
        } catch (error) {
            console.error('Error querying knowledge base:', error);
            return null;
        }
    }

    // Helper methods for data extraction and formatting

    extractMaterials(product) {
        const text = `${product.name} ${product.description || ''}`.toLowerCase();
        const materials = ['cotton', 'polyester', 'vinyl', 'ceramic', 'paper', 'canvas', 'metal', 'plastic', 'glass', 'fabric', 'leather', 'wood'];
        return materials.filter(material => text.includes(material));
    }

    extractColors(product) {
        const text = `${product.name} ${product.description || ''}`.toLowerCase();
        const colors = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'gray', 'silver', 'gold'];
        return colors.filter(color => text.includes(color));
    }

    extractSizes(product) {
        const text = `${product.name} ${product.description || ''}`.toLowerCase();
        const sizes = ['xs', 'small', 'medium', 'large', 'xl', 'xxl', '2xl', '3xl'];
        return sizes.filter(size => text.includes(size));
    }

    extractTags(product) {
        const tags = [];
        const text = `${product.name} ${product.description || ''}`.toLowerCase();
        
        const tagPatterns = {
            style: ['vintage', 'modern', 'retro', 'classic', 'trendy', 'minimalist', 'bold', 'elegant'],
            theme: ['space', 'nature', 'abstract', 'geometric', 'floral', 'animal', 'sports', 'music'],
            occasion: ['birthday', 'wedding', 'holiday', 'christmas', 'valentine', 'graduation', 'corporate']
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

    generateKeywords(product) {
        const text = `${product.name} ${product.description || ''}`.toLowerCase();
        const words = text.split(/\s+/).filter(word => word.length > 3);
        return [...new Set(words)]; // Remove duplicates
    }

    parsePrice(price) {
        if (typeof price === 'number') return price;
        if (typeof price === 'string') {
            const numericPrice = parseFloat(price.replace(/[^0-9.]/g, ''));
            return isNaN(numericPrice) ? 0 : numericPrice;
        }
        return 0;
    }

    assessDifficultyLevel(product) {
        const text = `${product.name} ${product.description || ''}`.toLowerCase();
        
        if (text.includes('custom') || text.includes('complex') || text.includes('detailed')) return 'high';
        if (text.includes('simple') || text.includes('basic') || text.includes('standard')) return 'low';
        return 'medium';
    }

    calculateProfitMargin(product) {
        const price = this.parsePrice(product.price);
        // Estimate based on product type and price
        if (price < 10) return 0.3; // 30% margin for low-cost items
        if (price < 25) return 0.5; // 50% margin for mid-range
        return 0.6; // 60% margin for premium items
    }

    assessSeasonalRelevance(product) {
        const text = `${product.name} ${product.description || ''}`.toLowerCase();
        const seasons = {
            spring: ['spring', 'easter', 'flower', 'fresh'],
            summer: ['summer', 'beach', 'vacation', 'sun'],
            fall: ['fall', 'autumn', 'halloween', 'harvest'],
            winter: ['winter', 'christmas', 'holiday', 'snow']
        };
        
        for (const [season, keywords] of Object.entries(seasons)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return season;
            }
        }
        return 'year-round';
    }

    getTopItems(items, limit) {
        return Object.entries(items)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([item, count]) => ({ item, count }));
    }

    calculateCategoryProfitability(products, inventory) {
        // Simplified profitability calculation
        const categoryProducts = inventory.filter(p => products.includes(p.name));
        const avgPrice = categoryProducts.reduce((sum, p) => sum + this.parsePrice(p.price), 0) / categoryProducts.length;
        
        if (avgPrice < 15) return 0.3;
        if (avgPrice < 30) return 0.5;
        return 0.7;
    }

    extractThemes(text) {
        const themes = ['space', 'nature', 'vintage', 'modern', 'abstract', 'geometric', 'floral', 'minimalist'];
        return themes.filter(theme => text.includes(theme));
    }

    extractColorsFromText(text) {
        const colors = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown'];
        return colors.filter(color => text.includes(color));
    }

    extractKeywordsFromText(text) {
        return text.split(/\s+/)
            .filter(word => word.length > 4)
            .filter(word => !['design', 'product', 'create', 'print'].includes(word))
            .slice(0, 10);
    }

    generateOptimizationSuggestions(knowledge, inventory, orders) {
        const suggestions = [];
        
        // Price optimization
        const avgPrice = knowledge.business_metrics.avg_product_price;
        if (avgPrice < 20) {
            suggestions.push('Consider adding premium product lines to increase average order value');
        }
        
        // Category gaps
        const categories = Object.keys(knowledge.categories);
        if (categories.length < 5) {
            suggestions.push('Expand into new product categories to diversify offerings');
        }
        
        // Inventory balance
        const totalProducts = knowledge.business_metrics.total_products;
        if (totalProducts < 50) {
            suggestions.push('Increase product variety to offer more customer choice');
        }
        
        return suggestions;
    }

    // Response formatting methods

    formatProductResponse(data) {
        const materials = data.materials.length ? ` Materials: ${data.materials.join(', ')}.` : '';
        const tags = data.tags.length ? ` Tags: ${data.tags.join(', ')}.` : '';
        
        return `${data.original_name} is in our ${data.category} category, priced at $${data.price.toFixed(2)}. ${data.description}${materials}${tags} Difficulty level: ${data.difficulty_level}. Seasonal relevance: ${data.seasonal_relevance}.`;
    }

    formatCategoryResponse(category, data) {
        const topMaterials = data.top_materials.map(m => m.item).join(', ');
        const topColors = data.top_colors.map(c => c.item).join(', ');
        
        return `Our ${category} category has ${data.product_count} products with an average price of $${data.avg_price.toFixed(2)} (range: $${data.price_range.min.toFixed(2)} - $${data.price_range.max.toFixed(2)}). Popular materials: ${topMaterials}. Popular colors: ${topColors}. Market share: ${data.market_share.toFixed(1)}%.`;
    }

    formatPricingResponse(patterns) {
        const budgetCount = patterns.price_tiers.budget;
        const midCount = patterns.price_tiers.mid;
        const premiumCount = patterns.price_tiers.premium;
        
        return `Our pricing structure: ${budgetCount} budget items (<$15), ${midCount} mid-range ($15-$30), ${premiumCount} premium (>$30). Most profitable materials tend to be premium options.`;
    }

    formatSalesResponse(insights) {
        const topSellers = Object.entries(insights.top_sellers)
            .sort(([,a], [,b]) => b.quantity - a.quantity)
            .slice(0, 3)
            .map(([name]) => name);
            
        return `Top selling products: ${topSellers.join(', ')}. Revenue is distributed across categories with strong performance in our main product lines.`;
    }

    formatBusinessResponse(metrics) {
        return `Business overview: ${metrics.total_products} products across ${metrics.total_categories} categories. Average product price: $${metrics.avg_product_price.toFixed(2)}. Total inventory value: $${metrics.total_inventory_value.toFixed(2)}. Most profitable category: ${metrics.most_profitable_category}.`;
    }

    // Load data files

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

    loadOrders() {
        try {
            if (fs.existsSync(this.ordersPath)) {
                return JSON.parse(fs.readFileSync(this.ordersPath, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading orders:', error);
        }
        return [];
    }

    loadIdeas() {
        try {
            if (fs.existsSync(this.ideasPath)) {
                return JSON.parse(fs.readFileSync(this.ideasPath, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading ideas:', error);
        }
        return [];
    }

    // Get knowledge base status
    getKnowledgeStatus() {
        try {
            if (!fs.existsSync(this.knowledgePath)) {
                return { isReady: false, reason: 'Knowledge base not built yet' };
            }
            
            const knowledge = JSON.parse(fs.readFileSync(this.knowledgePath, 'utf8'));
            
            return {
                isReady: true,
                lastUpdated: knowledge.last_updated,
                totalProducts: Object.keys(knowledge.products).length,
                totalCategories: Object.keys(knowledge.categories).length,
                version: knowledge.version
            };
        } catch (error) {
            return { isReady: false, error: error.message };
        }
    }
}

module.exports = ProductKnowledgeBase;