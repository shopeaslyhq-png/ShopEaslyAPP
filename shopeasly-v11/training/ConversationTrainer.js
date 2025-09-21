const fs = require('fs');
const path = require('path');

class ConversationTrainer {
    constructor() {
        this.trainingDataPath = path.join(__dirname, '..', 'data', 'training_conversations.json');
        this.modelDataPath = path.join(__dirname, '..', 'data', 'learned_responses.json');
        this.historyPath = path.join(__dirname, '..', 'data', 'ai_history.json');
        this.logsPath = path.join(__dirname, '..', 'data', 'ai_logs.ndjson');
        this.metricsPath = path.join(__dirname, '..', 'data', 'training_metrics.json');
    }

    // Log successful interactions for training
    logSuccessfulInteraction(userInput, aiResponse, context = {}) {
        const trainingEntry = {
            timestamp: new Date().toISOString(),
            input: userInput.trim().toLowerCase(),
            response: aiResponse,
            context,
            success: true,
            category: this.categorizeInput(userInput),
            confidence: this.calculateResponseConfidence(aiResponse)
        };

        this.appendToTrainingData(trainingEntry);
        console.log(`📚 Logged successful interaction: ${trainingEntry.category}`);
    }

    // Categorize user inputs for better training
    categorizeInput(input) {
        const inputLower = input.toLowerCase();
        
        const categories = {
            inventory: /(inventory|stock|add|remove|how many|quantity|count|products|items)/i,
            orders: /(order|purchase|buy|sell|customer|shipping|fulfillment)/i,
            design: /(design|image|mockup|generate|create|art|graphics|logo)/i,
            pricing: /(price|cost|how much|expensive|cheap|pricing|money)/i,
            materials: /(material|fabric|cotton|polyester|vinyl|ceramic|paper)/i,
            categories: /(category|type|kind|apparel|drinkware|stickers|prints)/i,
            help: /(help|what|how|why|explain|tell me|show me)/i,
            business: /(profit|sales|analytics|report|business|revenue)/i
        };

        for (const [category, pattern] of Object.entries(categories)) {
            if (pattern.test(inputLower)) return category;
        }
        return 'general';
    }

    // Calculate confidence score for responses
    calculateResponseConfidence(response) {
        const indicators = {
            high: /successfully|completed|found|here are|i've added|created/i,
            medium: /try|might|could|possibly|perhaps/i,
            low: /sorry|error|can't|unable|don't know|not sure/i
        };

        if (indicators.high.test(response)) return 'high';
        if (indicators.low.test(response)) return 'low';
        if (indicators.medium.test(response)) return 'medium';
        return 'medium'; // default
    }

    // Learn from existing conversation history
    async learnFromHistory() {
        console.log('🧠 Analyzing conversation history...');
        
        try {
            if (!fs.existsSync(this.historyPath)) {
                console.log('❌ No conversation history found');
                return null;
            }

            const history = JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
            console.log(`📊 Found ${history.length} conversation entries`);

            const patterns = this.extractPatterns(history);
            const insights = this.generateInsights(patterns);
            
            // Save learned patterns
            this.saveLearnedPatterns({ patterns, insights });
            
            // Update metrics
            this.updateTrainingMetrics(patterns, insights);
            
            console.log('✅ Learning complete!');
            console.log(`📈 Learned ${Object.keys(patterns.commonQuestions).length} common questions`);
            console.log(`🎯 Identified ${Object.keys(patterns.successfulResponses).length} successful response patterns`);
            
            return { patterns, insights };
            
        } catch (error) {
            console.error('❌ Error learning from history:', error);
            return null;
        }
    }

    // Extract patterns from conversation history
    extractPatterns(history) {
        const patterns = {
            commonQuestions: {},
            successfulResponses: {},
            userIntents: {},
            responseTypes: {},
            conversationFlow: []
        };

        let currentConversation = [];
        
        for (let i = 0; i < history.length; i++) {
            const entry = history[i];
            
            if (entry.role === 'user') {
                const question = this.normalizeText(entry.text);
                const category = this.categorizeInput(entry.text);
                
                // Track common questions
                patterns.commonQuestions[question] = (patterns.commonQuestions[question] || 0) + 1;
                
                // Track user intents
                if (!patterns.userIntents[category]) {
                    patterns.userIntents[category] = [];
                }
                patterns.userIntents[category].push(question);
                
                currentConversation.push({ type: 'user', text: question, category });
                
                // Look for AI response
                if (i + 1 < history.length && history[i + 1].role === 'assistant') {
                    const aiResponse = history[i + 1].text;
                    const confidence = this.calculateResponseConfidence(aiResponse);
                    
                    // Only learn from high-confidence responses
                    if (confidence === 'high') {
                        if (!patterns.successfulResponses[question]) {
                            patterns.successfulResponses[question] = [];
                        }
                        patterns.successfulResponses[question].push({
                            response: aiResponse,
                            confidence,
                            category,
                            timestamp: entry.timestamp || new Date().toISOString()
                        });
                    }
                    
                    currentConversation.push({ type: 'assistant', text: aiResponse, confidence });
                    
                    // Save conversation flow
                    if (currentConversation.length >= 2) {
                        patterns.conversationFlow.push([...currentConversation]);
                        currentConversation = [];
                    }
                }
            }
        }

        return patterns;
    }

    // Generate insights from patterns
    generateInsights(patterns) {
        const insights = {
            topQuestions: [],
            categoryDistribution: {},
            responseEffectiveness: {},
            improvementAreas: [],
            learningMetrics: {}
        };

        // Top questions
        insights.topQuestions = Object.entries(patterns.commonQuestions)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([question, count]) => ({ question, count }));

        // Category distribution
        for (const [category, questions] of Object.entries(patterns.userIntents)) {
            insights.categoryDistribution[category] = questions.length;
        }

        // Response effectiveness
        for (const [question, responses] of Object.entries(patterns.successfulResponses)) {
            const highConfidence = responses.filter(r => r.confidence === 'high').length;
            const total = responses.length;
            insights.responseEffectiveness[question] = {
                successRate: total > 0 ? (highConfidence / total) * 100 : 0,
                totalResponses: total
            };
        }

        // Improvement areas
        const lowSuccessQuestions = Object.entries(insights.responseEffectiveness)
            .filter(([, data]) => data.successRate < 50 && data.totalResponses >= 2)
            .map(([question]) => question);
        
        insights.improvementAreas = lowSuccessQuestions.slice(0, 5);

        // Learning metrics
        insights.learningMetrics = {
            totalConversations: patterns.conversationFlow.length,
            learnedPatterns: Object.keys(patterns.successfulResponses).length,
            coverageByCategory: Object.keys(insights.categoryDistribution).length,
            lastUpdated: new Date().toISOString()
        };

        return insights;
    }

    // Generate improved response based on learned patterns
    generateImprovedResponse(userInput, context = {}) {
        try {
            const learnedData = this.loadLearnedPatterns();
            if (!learnedData) return null;

            const { patterns } = learnedData;
            const normalizedInput = this.normalizeText(userInput);
            
            // Check for exact matches first
            if (patterns.successfulResponses[normalizedInput]) {
                const responses = patterns.successfulResponses[normalizedInput];
                const bestResponse = this.selectBestResponse(responses, context);
                console.log('🎯 Using exact learned response');
                return bestResponse;
            }

            // Check for partial matches
            const similarQuestions = this.findSimilarQuestions(normalizedInput, patterns.successfulResponses);
            if (similarQuestions.length > 0) {
                const bestMatch = similarQuestions[0];
                const responses = patterns.successfulResponses[bestMatch.question];
                const bestResponse = this.selectBestResponse(responses, context);
                console.log(`🔍 Using similar learned response (${(bestMatch.similarity * 100).toFixed(1)}% match)`);
                return bestResponse;
            }

            return null;
        } catch (error) {
            console.error('Error generating improved response:', error);
            return null;
        }
    }

    // Find similar questions using multiple similarity metrics
    findSimilarQuestions(input, successfulResponses, threshold = 0.6) {
        const similarities = [];
        
        for (const question of Object.keys(successfulResponses)) {
            const similarity = this.calculateSimilarity(input, question);
            if (similarity >= threshold) {
                similarities.push({ question, similarity });
            }
        }
        
        return similarities.sort((a, b) => b.similarity - a.similarity);
    }

    // Calculate similarity between two text strings
    calculateSimilarity(str1, str2) {
        const words1 = str1.split(' ').filter(w => w.length > 2);
        const words2 = str2.split(' ').filter(w => w.length > 2);
        
        if (words1.length === 0 || words2.length === 0) return 0;
        
        // Exact word matches
        const intersection = words1.filter(word => words2.includes(word));
        const wordSimilarity = intersection.length / Math.max(words1.length, words2.length);
        
        // Character-level similarity (Jaccard index)
        const chars1 = new Set(str1.replace(/\s/g, ''));
        const chars2 = new Set(str2.replace(/\s/g, ''));
        const charIntersection = new Set([...chars1].filter(c => chars2.has(c)));
        const charUnion = new Set([...chars1, ...chars2]);
        const charSimilarity = charIntersection.size / charUnion.size;
        
        // Combined similarity (weighted)
        return (wordSimilarity * 0.7) + (charSimilarity * 0.3);
    }

    // Select best response based on context and confidence
    selectBestResponse(responses, context) {
        if (responses.length === 1) return responses[0].response;
        
        // Sort by confidence and recency
        const sorted = responses.sort((a, b) => {
            if (a.confidence === b.confidence) {
                return new Date(b.timestamp) - new Date(a.timestamp);
            }
            return a.confidence === 'high' ? -1 : 1;
        });
        
        return sorted[0].response;
    }

    // Normalize text for better matching
    normalizeText(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Save training data
    appendToTrainingData(entry) {
        try {
            let data = [];
            if (fs.existsSync(this.trainingDataPath)) {
                const content = fs.readFileSync(this.trainingDataPath, 'utf8');
                if (content.trim()) {
                    data = JSON.parse(content);
                }
            }
            data.push(entry);
            
            // Keep only last 1000 entries to prevent file from growing too large
            if (data.length > 1000) {
                data = data.slice(-1000);
            }
            
            fs.writeFileSync(this.trainingDataPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving training data:', error);
        }
    }

    // Save learned patterns
    saveLearnedPatterns(data) {
        try {
            fs.writeFileSync(this.modelDataPath, JSON.stringify(data, null, 2));
            console.log('💾 Saved learned patterns');
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

    // Update training metrics
    updateTrainingMetrics(patterns, insights) {
        try {
            const metrics = {
                lastTraining: new Date().toISOString(),
                totalPatterns: Object.keys(patterns.successfulResponses).length,
                totalQuestions: Object.keys(patterns.commonQuestions).length,
                categoryBreakdown: insights.categoryDistribution,
                topQuestions: insights.topQuestions,
                improvementAreas: insights.improvementAreas,
                averageConfidence: this.calculateAverageConfidence(patterns.successfulResponses)
            };
            
            fs.writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2));
            console.log('📊 Updated training metrics');
        } catch (error) {
            console.error('Error updating metrics:', error);
        }
    }

    // Calculate average confidence across all responses
    calculateAverageConfidence(successfulResponses) {
        const allResponses = Object.values(successfulResponses).flat();
        if (allResponses.length === 0) return 0;
        
        const confidenceScores = allResponses.map(r => {
            switch (r.confidence) {
                case 'high': return 3;
                case 'medium': return 2;
                case 'low': return 1;
                default: return 2;
            }
        });
        
        const average = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
        return Math.round((average / 3) * 100); // Convert to percentage
    }

    // Get training status and statistics
    getTrainingStatus() {
        try {
            const metrics = fs.existsSync(this.metricsPath) 
                ? JSON.parse(fs.readFileSync(this.metricsPath, 'utf8'))
                : null;
                
            const learnedData = this.loadLearnedPatterns();
            
            return {
                isReady: !!learnedData,
                lastTraining: metrics?.lastTraining,
                totalPatterns: metrics?.totalPatterns || 0,
                averageConfidence: metrics?.averageConfidence || 0,
                topCategories: metrics?.categoryBreakdown || {},
                hasHistoryData: fs.existsSync(this.historyPath)
            };
        } catch (error) {
            console.error('Error getting training status:', error);
            return { isReady: false, error: error.message };
        }
    }
}

module.exports = ConversationTrainer;