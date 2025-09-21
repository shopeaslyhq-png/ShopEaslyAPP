#!/usr/bin/env node

/**
 * 🧠 ShopEasly AI Training Script
 * 
 * This script performs comprehensive AI training including:
 * - Conversation pattern learning from chat history
 * - Product knowledge base building from inventory
 * - Performance metrics calculation
 * - Training recommendations
 */

const ConversationTrainer = require('../training/ConversationTrainer');
const ProductKnowledgeBase = require('../training/ProductKnowledgeBase');
const fs = require('fs');
const path = require('path');

class AITrainingController {
    constructor() {
        this.conversationTrainer = new ConversationTrainer();
        this.productKnowledge = new ProductKnowledgeBase();
        this.reportPath = path.join(__dirname, '..', 'data', 'training_report.json');
    }

    async runFullTraining() {
        console.log('🚀 Starting comprehensive AI training...');
        console.log('=' * 50);
        
        const startTime = Date.now();
        const report = {
            training_started: new Date().toISOString(),
            phases: {},
            summary: {},
            recommendations: [],
            next_training: this.calculateNextTrainingDate()
        };

        try {
            // Phase 1: Conversation Learning
            console.log('\n📚 Phase 1: Conversation Pattern Learning');
            const conversationResults = await this.runConversationTraining();
            report.phases.conversation_learning = conversationResults;

            // Phase 2: Product Knowledge Building
            console.log('\n🏪 Phase 2: Product Knowledge Base Building');
            const knowledgeResults = await this.runKnowledgeBuilding();
            report.phases.knowledge_building = knowledgeResults;

            // Phase 3: Performance Analysis
            console.log('\n📊 Phase 3: Performance Analysis');
            const performanceResults = await this.analyzePerformance();
            report.phases.performance_analysis = performanceResults;

            // Phase 4: Generate Recommendations
            console.log('\n💡 Phase 4: Training Recommendations');
            const recommendations = await this.generateRecommendations(report.phases);
            report.recommendations = recommendations;

            // Calculate Summary
            report.summary = this.calculateSummary(report.phases);
            
            const endTime = Date.now();
            report.training_completed = new Date().toISOString();
            report.duration_ms = endTime - startTime;
            report.duration_human = this.formatDuration(endTime - startTime);

            // Save report
            fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2));

            // Display results
            this.displayResults(report);

            console.log('\n✅ AI training completed successfully!');
            console.log(`📊 Full report saved to: ${this.reportPath}`);

            return report;

        } catch (error) {
            console.error('\n❌ Training failed:', error);
            report.error = error.message;
            report.training_completed = new Date().toISOString();
            fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2));
            throw error;
        }
    }

    async runConversationTraining() {
        const results = {
            phase: 'conversation_learning',
            started: new Date().toISOString(),
            status: 'running'
        };

        try {
            console.log('  🔄 Analyzing conversation history...');
            const learningResults = await this.conversationTrainer.learnFromHistory();
            
            if (learningResults) {
                const { patterns, insights } = learningResults;
                
                results.patterns_learned = Object.keys(patterns.successfulResponses).length;
                results.common_questions = Object.keys(patterns.commonQuestions).length;
                results.category_coverage = Object.keys(insights.categoryDistribution).length;
                results.top_questions = insights.topQuestions.slice(0, 5);
                results.improvement_areas = insights.improvementAreas.slice(0, 3);
                results.learning_metrics = insights.learningMetrics;
                
                console.log(`  ✅ Learned ${results.patterns_learned} response patterns`);
                console.log(`  📈 Identified ${results.common_questions} common questions`);
                console.log(`  🎯 Coverage across ${results.category_coverage} categories`);
            } else {
                results.patterns_learned = 0;
                results.common_questions = 0;
                console.log('  ⚠️ No conversation history found');
            }

            results.status = 'completed';
            results.completed = new Date().toISOString();

        } catch (error) {
            results.status = 'failed';
            results.error = error.message;
            console.log(`  ❌ Conversation training failed: ${error.message}`);
        }

        return results;
    }

    async runKnowledgeBuilding() {
        const results = {
            phase: 'knowledge_building',
            started: new Date().toISOString(),
            status: 'running'
        };

        try {
            console.log('  🔄 Building product knowledge base...');
            const knowledge = await this.productKnowledge.buildKnowledgeBase();
            
            if (knowledge) {
                results.total_products = Object.keys(knowledge.products).length;
                results.total_categories = Object.keys(knowledge.categories).length;
                results.business_metrics = knowledge.business_metrics;
                results.pricing_insights = {
                    avg_price: knowledge.business_metrics.avg_product_price,
                    total_value: knowledge.business_metrics.total_inventory_value,
                    price_tiers: knowledge.pricing_patterns.price_tiers
                };
                
                console.log(`  ✅ Analyzed ${results.total_products} products`);
                console.log(`  📦 Organized ${results.total_categories} categories`);
                console.log(`  💰 Total inventory value: $${results.pricing_insights.total_value.toFixed(2)}`);
            } else {
                results.total_products = 0;
                results.total_categories = 0;
                console.log('  ⚠️ No inventory data found');
            }

            results.status = 'completed';
            results.completed = new Date().toISOString();

        } catch (error) {
            results.status = 'failed';
            results.error = error.message;
            console.log(`  ❌ Knowledge building failed: ${error.message}`);
        }

        return results;
    }

    async analyzePerformance() {
        const results = {
            phase: 'performance_analysis',
            started: new Date().toISOString(),
            status: 'running'
        };

        try {
            console.log('  🔄 Analyzing AI performance metrics...');
            
            // Get training status from both systems
            const conversationStatus = this.conversationTrainer.getTrainingStatus();
            const knowledgeStatus = this.productKnowledge.getKnowledgeStatus();
            
            results.conversation_trainer = conversationStatus;
            results.knowledge_base = knowledgeStatus;
            
            // Calculate overall readiness score
            let readinessScore = 0;
            if (conversationStatus.isReady) readinessScore += 50;
            if (knowledgeStatus.isReady) readinessScore += 50;
            
            results.overall_readiness = readinessScore;
            results.readiness_status = readinessScore >= 75 ? 'excellent' : 
                                     readinessScore >= 50 ? 'good' : 
                                     readinessScore >= 25 ? 'basic' : 'needs_work';

            // Analyze data quality
            const dataQuality = await this.assessDataQuality();
            results.data_quality = dataQuality;

            console.log(`  📊 Overall readiness: ${readinessScore}% (${results.readiness_status})`);
            console.log(`  🎯 Data quality score: ${dataQuality.overall_score}%`);

            results.status = 'completed';
            results.completed = new Date().toISOString();

        } catch (error) {
            results.status = 'failed';
            results.error = error.message;
            console.log(`  ❌ Performance analysis failed: ${error.message}`);
        }

        return results;
    }

    async assessDataQuality() {
        const quality = {
            conversation_history: 0,
            inventory_data: 0,
            order_data: 0,
            overall_score: 0
        };

        try {
            // Check conversation history
            const historyPath = path.join(__dirname, '..', 'data', 'ai_history.json');
            if (fs.existsSync(historyPath)) {
                const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                if (history.length > 100) quality.conversation_history = 100;
                else if (history.length > 50) quality.conversation_history = 75;
                else if (history.length > 10) quality.conversation_history = 50;
                else quality.conversation_history = 25;
            }

            // Check inventory data
            const inventoryPath = path.join(__dirname, '..', 'data', 'inventory.json');
            if (fs.existsSync(inventoryPath)) {
                const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
                if (inventory.length > 50) quality.inventory_data = 100;
                else if (inventory.length > 20) quality.inventory_data = 75;
                else if (inventory.length > 5) quality.inventory_data = 50;
                else quality.inventory_data = 25;
            }

            // Check order data
            const ordersPath = path.join(__dirname, '..', 'data', 'orders.json');
            if (fs.existsSync(ordersPath)) {
                const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
                if (orders.length > 20) quality.order_data = 100;
                else if (orders.length > 10) quality.order_data = 75;
                else if (orders.length > 3) quality.order_data = 50;
                else quality.order_data = 25;
            }

            quality.overall_score = Math.round(
                (quality.conversation_history + quality.inventory_data + quality.order_data) / 3
            );

        } catch (error) {
            console.log('⚠️ Data quality assessment error:', error.message);
        }

        return quality;
    }

    async generateRecommendations(phases) {
        const recommendations = [];

        // Conversation learning recommendations
        if (phases.conversation_learning && phases.conversation_learning.status === 'completed') {
            const conv = phases.conversation_learning;
            
            if (conv.patterns_learned < 10) {
                recommendations.push({
                    type: 'conversation',
                    priority: 'high',
                    title: 'Increase conversation data',
                    description: 'You have very few learned patterns. Use the AI more frequently to build better responses.',
                    action: 'Have more conversations with the AI assistant'
                });
            }

            if (conv.improvement_areas && conv.improvement_areas.length > 0) {
                recommendations.push({
                    type: 'conversation',
                    priority: 'medium',
                    title: 'Focus on improvement areas',
                    description: `Work on these question types: ${conv.improvement_areas.join(', ')}`,
                    action: 'Practice asking questions in these categories'
                });
            }
        }

        // Knowledge base recommendations
        if (phases.knowledge_building && phases.knowledge_building.status === 'completed') {
            const kb = phases.knowledge_building;
            
            if (kb.total_products < 20) {
                recommendations.push({
                    type: 'inventory',
                    priority: 'high',
                    title: 'Expand product catalog',
                    description: 'Your inventory is small. Add more products for better AI recommendations.',
                    action: 'Add more products to your inventory'
                });
            }

            if (kb.total_categories < 5) {
                recommendations.push({
                    type: 'inventory',
                    priority: 'medium',
                    title: 'Diversify product categories',
                    description: 'Add products in different categories for broader AI knowledge.',
                    action: 'Expand into new product categories'
                });
            }
        }

        // Performance recommendations
        if (phases.performance_analysis && phases.performance_analysis.status === 'completed') {
            const perf = phases.performance_analysis;
            
            if (perf.overall_readiness < 50) {
                recommendations.push({
                    type: 'system',
                    priority: 'high',
                    title: 'Improve AI readiness',
                    description: 'Your AI system needs more training data and usage.',
                    action: 'Use the AI system more frequently and add more business data'
                });
            }

            if (perf.data_quality.overall_score < 60) {
                recommendations.push({
                    type: 'data',
                    priority: 'high',
                    title: 'Improve data quality',
                    description: 'Add more conversation history, inventory items, and order data.',
                    action: 'Use the system more and add comprehensive business data'
                });
            }
        }

        return recommendations;
    }

    calculateSummary(phases) {
        const summary = {
            phases_completed: 0,
            phases_failed: 0,
            total_patterns: 0,
            total_products: 0,
            readiness_level: 'unknown'
        };

        for (const [phaseName, phase] of Object.entries(phases)) {
            if (phase.status === 'completed') {
                summary.phases_completed++;
                
                if (phase.patterns_learned) summary.total_patterns += phase.patterns_learned;
                if (phase.total_products) summary.total_products += phase.total_products;
            } else if (phase.status === 'failed') {
                summary.phases_failed++;
            }
        }

        // Determine readiness level
        if (summary.phases_completed === 3 && summary.total_patterns > 10 && summary.total_products > 20) {
            summary.readiness_level = 'excellent';
        } else if (summary.phases_completed >= 2 && summary.total_patterns > 5) {
            summary.readiness_level = 'good';
        } else if (summary.phases_completed >= 1) {
            summary.readiness_level = 'basic';
        } else {
            summary.readiness_level = 'needs_work';
        }

        return summary;
    }

    calculateNextTrainingDate() {
        // Recommend training every 3 days for active systems
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 3);
        return nextDate.toISOString();
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    displayResults(report) {
        console.log('\n' + '='.repeat(60));
        console.log('🎉 AI TRAINING REPORT');
        console.log('='.repeat(60));
        
        console.log(`\n📊 SUMMARY:`);
        console.log(`  • Duration: ${report.duration_human}`);
        console.log(`  • Phases completed: ${report.summary.phases_completed}/3`);
        console.log(`  • Patterns learned: ${report.summary.total_patterns}`);
        console.log(`  • Products analyzed: ${report.summary.total_products}`);
        console.log(`  • Readiness level: ${report.summary.readiness_level.toUpperCase()}`);

        if (report.recommendations.length > 0) {
            console.log(`\n💡 TOP RECOMMENDATIONS:`);
            report.recommendations.slice(0, 3).forEach((rec, i) => {
                console.log(`  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
                console.log(`     ${rec.description}`);
            });
        }

        console.log(`\n🔄 NEXT TRAINING: ${new Date(report.next_training).toLocaleDateString()}`);
    }

    // Quick training status check
    async getQuickStatus() {
        const conversationStatus = this.conversationTrainer.getTrainingStatus();
        const knowledgeStatus = this.productKnowledge.getKnowledgeStatus();
        
        return {
            conversation_ready: conversationStatus.isReady,
            knowledge_ready: knowledgeStatus.isReady,
            last_conversation_training: conversationStatus.lastTraining,
            last_knowledge_update: knowledgeStatus.lastUpdated,
            total_patterns: conversationStatus.totalPatterns || 0,
            total_products: knowledgeStatus.totalProducts || 0
        };
    }
}

// CLI execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'full';

    const trainer = new AITrainingController();

    try {
        switch (command) {
            case 'full':
            case 'train':
                await trainer.runFullTraining();
                break;
                
            case 'status':
                const status = await trainer.getQuickStatus();
                console.log('🤖 AI Training Status:');
                console.log(JSON.stringify(status, null, 2));
                break;
                
            case 'conversation':
                const convResults = await trainer.runConversationTraining();
                console.log('📚 Conversation Training Results:');
                console.log(JSON.stringify(convResults, null, 2));
                break;
                
            case 'knowledge':
                const kbResults = await trainer.runKnowledgeBuilding();
                console.log('🏪 Knowledge Building Results:');
                console.log(JSON.stringify(kbResults, null, 2));
                break;
                
            default:
                console.log('Usage: node train-ai.js [command]');
                console.log('Commands:');
                console.log('  full       - Run complete training (default)');
                console.log('  status     - Quick status check');
                console.log('  conversation - Train conversation patterns only');
                console.log('  knowledge  - Build knowledge base only');
                process.exit(1);
        }
    } catch (error) {
        console.error('❌ Training error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = AITrainingController;