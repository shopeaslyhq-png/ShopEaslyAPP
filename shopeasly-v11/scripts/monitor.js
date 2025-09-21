#!/usr/bin/env node

/**
 * 📊 AI Performance Monitor
 * 
 * This script monitors AI performance and provides detailed analytics:
 * - Response quality metrics
 * - Usage patterns analysis
 * - Performance trend tracking
 * - Health checks and alerts
 */

const fs = require('fs');
const path = require('path');

class AIPerformanceMonitor {
    constructor() {
        this.dataPath = path.join(__dirname, '..', 'data');
        this.metricsPath = path.join(this.dataPath, 'performance_metrics.json');
        this.reportPath = path.join(this.dataPath, 'performance_report.json');
    }

    // Analyze AI performance from logs and history
    async analyzePerformance() {
        console.log('📊 Analyzing AI performance...');
        
        const metrics = {
            timestamp: new Date().toISOString(),
            conversation_metrics: await this.analyzeConversations(),
            response_metrics: await this.analyzeResponses(),
            usage_patterns: await this.analyzeUsagePatterns(),
            system_health: await this.checkSystemHealth(),
            trends: await this.calculateTrends(),
            alerts: []
        };

        // Generate alerts based on metrics
        metrics.alerts = this.generateAlerts(metrics);

        // Calculate overall score
        metrics.overall_score = this.calculateOverallScore(metrics);

        // Save metrics
        this.saveMetrics(metrics);

        return metrics;
    }

    async analyzeConversations() {
        const metrics = {
            total_conversations: 0,
            avg_conversation_length: 0,
            most_common_topics: [],
            user_satisfaction_estimate: 0,
            response_sources: {}
        };

        try {
            const historyPath = path.join(this.dataPath, 'ai_history.json');
            if (!fs.existsSync(historyPath)) {
                return metrics;
            }

            const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            
            // Group by client sessions
            const sessions = {};
            for (const entry of history) {
                if (!sessions[entry.clientId]) {
                    sessions[entry.clientId] = [];
                }
                sessions[entry.clientId].push(entry);
            }

            metrics.total_conversations = Object.keys(sessions).length;
            
            // Calculate average conversation length
            const conversationLengths = Object.values(sessions).map(session => session.length);
            metrics.avg_conversation_length = conversationLengths.length > 0 
                ? conversationLengths.reduce((sum, len) => sum + len, 0) / conversationLengths.length
                : 0;

            // Analyze topics
            const topics = {};
            for (const entry of history) {
                if (entry.role === 'user') {
                    const words = entry.text.toLowerCase().split(/\s+/);
                    words.forEach(word => {
                        if (word.length > 3) {
                            topics[word] = (topics[word] || 0) + 1;
                        }
                    });
                }
            }
            
            metrics.most_common_topics = Object.entries(topics)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([topic, count]) => ({ topic, count }));

            // Estimate satisfaction based on conversation patterns
            metrics.user_satisfaction_estimate = this.estimateUserSatisfaction(history);

            // Analyze response sources
            for (const entry of history) {
                if (entry.role === 'assistant') {
                    const source = entry.source || 'unknown';
                    metrics.response_sources[source] = (metrics.response_sources[source] || 0) + 1;
                }
            }

        } catch (error) {
            console.log('⚠️ Error analyzing conversations:', error.message);
        }

        return metrics;
    }

    async analyzeResponses() {
        const metrics = {
            total_responses: 0,
            avg_response_length: 0,
            successful_responses: 0,
            error_responses: 0,
            response_time_avg: 0,
            quality_indicators: {}
        };

        try {
            const logsPath = path.join(this.dataPath, 'ai_logs.ndjson');
            if (!fs.existsSync(logsPath)) {
                return metrics;
            }

            const logLines = fs.readFileSync(logsPath, 'utf8').trim().split('\n');
            const logs = logLines.map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            }).filter(Boolean);

            metrics.total_responses = logs.length;

            // Analyze response quality indicators
            const responseTimes = [];
            let successCount = 0;
            let errorCount = 0;

            for (const log of logs) {
                if (log.type && log.type.includes('error')) {
                    errorCount++;
                } else {
                    successCount++;
                }

                if (log.response_time) {
                    responseTimes.push(log.response_time);
                }
            }

            metrics.successful_responses = successCount;
            metrics.error_responses = errorCount;
            
            if (responseTimes.length > 0) {
                metrics.response_time_avg = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            }

            // Quality indicators
            metrics.quality_indicators = {
                success_rate: metrics.total_responses > 0 ? (successCount / metrics.total_responses) * 100 : 0,
                error_rate: metrics.total_responses > 0 ? (errorCount / metrics.total_responses) * 100 : 0,
                avg_response_time_ms: metrics.response_time_avg
            };

        } catch (error) {
            console.log('⚠️ Error analyzing responses:', error.message);
        }

        return metrics;
    }

    async analyzeUsagePatterns() {
        const patterns = {
            hourly_distribution: {},
            daily_distribution: {},
            peak_usage_hours: [],
            usage_trend: 'stable',
            most_active_users: []
        };

        try {
            const historyPath = path.join(this.dataPath, 'ai_history.json');
            if (!fs.existsSync(historyPath)) {
                return patterns;
            }

            const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

            // Hourly distribution
            const hourlyUsage = {};
            const dailyUsage = {};
            const userActivity = {};

            for (const entry of history) {
                if (entry.ts) {
                    const date = new Date(entry.ts);
                    const hour = date.getHours();
                    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
                    
                    hourlyUsage[hour] = (hourlyUsage[hour] || 0) + 1;
                    dailyUsage[day] = (dailyUsage[day] || 0) + 1;
                    
                    if (entry.clientId) {
                        userActivity[entry.clientId] = (userActivity[entry.clientId] || 0) + 1;
                    }
                }
            }

            patterns.hourly_distribution = hourlyUsage;
            patterns.daily_distribution = dailyUsage;

            // Find peak hours
            patterns.peak_usage_hours = Object.entries(hourlyUsage)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([hour, count]) => ({ hour: parseInt(hour), count }));

            // Most active users
            patterns.most_active_users = Object.entries(userActivity)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([userId, count]) => ({ userId, interactions: count }));

            // Calculate usage trend (simple week-over-week comparison)
            const now = new Date();
            const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

            const thisWeek = history.filter(entry => new Date(entry.ts) > oneWeekAgo).length;
            const lastWeek = history.filter(entry => {
                const date = new Date(entry.ts);
                return date > twoWeeksAgo && date <= oneWeekAgo;
            }).length;

            if (thisWeek > lastWeek * 1.1) {
                patterns.usage_trend = 'increasing';
            } else if (thisWeek < lastWeek * 0.9) {
                patterns.usage_trend = 'decreasing';
            } else {
                patterns.usage_trend = 'stable';
            }

        } catch (error) {
            console.log('⚠️ Error analyzing usage patterns:', error.message);
        }

        return patterns;
    }

    async checkSystemHealth() {
        const health = {
            data_files_status: {},
            training_systems_status: {},
            disk_usage: {},
            last_training_age: null,
            overall_health: 'unknown'
        };

        try {
            // Check data files
            const requiredFiles = [
                'ai_history.json',
                'inventory.json',
                'orders.json',
                'learned_responses.json',
                'product_knowledge.json'
            ];

            for (const file of requiredFiles) {
                const filePath = path.join(this.dataPath, file);
                health.data_files_status[file] = {
                    exists: fs.existsSync(filePath),
                    size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
                    last_modified: fs.existsSync(filePath) ? fs.statSync(filePath).mtime.toISOString() : null
                };
            }

            // Check training metrics
            const trainingMetricsPath = path.join(this.dataPath, 'training_metrics.json');
            if (fs.existsSync(trainingMetricsPath)) {
                const metrics = JSON.parse(fs.readFileSync(trainingMetricsPath, 'utf8'));
                health.last_training_age = this.calculateAge(metrics.lastTraining);
                health.training_systems_status = {
                    last_training: metrics.lastTraining,
                    total_patterns: metrics.totalPatterns,
                    average_confidence: metrics.averageConfidence
                };
            }

            // Calculate overall health
            const filesHealthy = Object.values(health.data_files_status).filter(f => f.exists).length;
            const totalFiles = requiredFiles.length;
            const healthPercent = (filesHealthy / totalFiles) * 100;

            if (healthPercent >= 80) health.overall_health = 'excellent';
            else if (healthPercent >= 60) health.overall_health = 'good';
            else if (healthPercent >= 40) health.overall_health = 'fair';
            else health.overall_health = 'poor';

        } catch (error) {
            console.log('⚠️ Error checking system health:', error.message);
        }

        return health;
    }

    async calculateTrends() {
        const trends = {
            conversation_growth: 0,
            response_quality_trend: 'stable',
            user_engagement_trend: 'stable',
            learning_progress: 0
        };

        try {
            // This would compare metrics over time
            // For now, we'll provide a basic implementation
            
            const historyPath = path.join(this.dataPath, 'ai_history.json');
            if (fs.existsSync(historyPath)) {
                const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                
                // Calculate conversation growth
                const now = new Date();
                const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
                const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);

                const recentConversations = history.filter(entry => new Date(entry.ts) > thirtyDaysAgo).length;
                const olderConversations = history.filter(entry => {
                    const date = new Date(entry.ts);
                    return date > sixtyDaysAgo && date <= thirtyDaysAgo;
                }).length;

                if (olderConversations > 0) {
                    trends.conversation_growth = ((recentConversations - olderConversations) / olderConversations) * 100;
                }
            }

        } catch (error) {
            console.log('⚠️ Error calculating trends:', error.message);
        }

        return trends;
    }

    generateAlerts(metrics) {
        const alerts = [];

        // Low conversation volume
        if (metrics.conversation_metrics.total_conversations < 5) {
            alerts.push({
                level: 'warning',
                type: 'low_usage',
                message: 'Very few conversations detected. AI may not have enough data to learn effectively.',
                suggestion: 'Increase usage of the AI assistant to improve learning.'
            });
        }

        // High error rate
        if (metrics.response_metrics.quality_indicators.error_rate > 10) {
            alerts.push({
                level: 'error',
                type: 'high_error_rate',
                message: `Error rate is ${metrics.response_metrics.quality_indicators.error_rate.toFixed(1)}%`,
                suggestion: 'Check system logs and API configurations.'
            });
        }

        // Poor system health
        if (metrics.system_health.overall_health === 'poor') {
            alerts.push({
                level: 'critical',
                type: 'system_health',
                message: 'System health is poor. Missing critical data files.',
                suggestion: 'Run training scripts and check data file integrity.'
            });
        }

        // Outdated training
        if (metrics.system_health.last_training_age && metrics.system_health.last_training_age > 7) {
            alerts.push({
                level: 'warning',
                type: 'outdated_training',
                message: `Training data is ${metrics.system_health.last_training_age} days old`,
                suggestion: 'Run training script to update AI learning.'
            });
        }

        return alerts;
    }

    calculateOverallScore(metrics) {
        let score = 0;
        let maxScore = 0;

        // Conversation quality (30%)
        maxScore += 30;
        if (metrics.conversation_metrics.total_conversations > 20) score += 30;
        else if (metrics.conversation_metrics.total_conversations > 10) score += 20;
        else if (metrics.conversation_metrics.total_conversations > 5) score += 15;
        else score += 5;

        // Response quality (25%)
        maxScore += 25;
        const successRate = metrics.response_metrics.quality_indicators.success_rate;
        score += (successRate / 100) * 25;

        // System health (25%)
        maxScore += 25;
        switch (metrics.system_health.overall_health) {
            case 'excellent': score += 25; break;
            case 'good': score += 20; break;
            case 'fair': score += 15; break;
            case 'poor': score += 5; break;
        }

        // Usage patterns (20%)
        maxScore += 20;
        if (metrics.usage_patterns.usage_trend === 'increasing') score += 20;
        else if (metrics.usage_patterns.usage_trend === 'stable') score += 15;
        else score += 10;

        return Math.round((score / maxScore) * 100);
    }

    // Helper methods
    estimateUserSatisfaction(history) {
        // Simple heuristic based on conversation patterns
        let satisfactionScore = 70; // baseline

        const userMessages = history.filter(entry => entry.role === 'user');
        const assistantMessages = history.filter(entry => entry.role === 'assistant');

        // Positive indicators
        const thankYouMessages = userMessages.filter(msg => 
            /thank|thanks|great|good|perfect|awesome|excellent/.test(msg.text.toLowerCase())
        ).length;

        // Negative indicators  
        const negativeMessages = userMessages.filter(msg =>
            /wrong|bad|error|fix|problem|not working|doesn't work/.test(msg.text.toLowerCase())
        ).length;

        // Adjust score
        satisfactionScore += (thankYouMessages * 5);
        satisfactionScore -= (negativeMessages * 10);

        // Response ratio (good if AI responds to most user messages)
        const responseRatio = assistantMessages.length / Math.max(userMessages.length, 1);
        if (responseRatio > 0.9) satisfactionScore += 10;
        else if (responseRatio < 0.7) satisfactionScore -= 15;

        return Math.max(0, Math.min(100, satisfactionScore));
    }

    calculateAge(dateString) {
        if (!dateString) return null;
        const date = new Date(dateString);
        const now = new Date();
        return Math.floor((now - date) / (1000 * 60 * 60 * 24)); // days
    }

    saveMetrics(metrics) {
        try {
            // Save current metrics
            fs.writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2));

            // Append to historical report
            let historicalReports = [];
            if (fs.existsSync(this.reportPath)) {
                try {
                    historicalReports = JSON.parse(fs.readFileSync(this.reportPath, 'utf8'));
                } catch (error) {
                    console.log('⚠️ Could not read historical reports, starting fresh');
                }
            }

            // Keep only last 30 reports
            historicalReports.push({
                timestamp: metrics.timestamp,
                overall_score: metrics.overall_score,
                total_conversations: metrics.conversation_metrics.total_conversations,
                success_rate: metrics.response_metrics.quality_indicators.success_rate,
                system_health: metrics.system_health.overall_health
            });

            if (historicalReports.length > 30) {
                historicalReports = historicalReports.slice(-30);
            }

            fs.writeFileSync(this.reportPath, JSON.stringify(historicalReports, null, 2));

            console.log(`📊 Metrics saved to ${this.metricsPath}`);

        } catch (error) {
            console.log('⚠️ Error saving metrics:', error.message);
        }
    }

    // Display performance report
    displayReport(metrics) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 AI PERFORMANCE REPORT');
        console.log('='.repeat(60));
        
        console.log(`\n🎯 OVERALL SCORE: ${metrics.overall_score}/100`);
        
        console.log(`\n💬 CONVERSATIONS:`);
        console.log(`  • Total conversations: ${metrics.conversation_metrics.total_conversations}`);
        console.log(`  • Avg conversation length: ${metrics.conversation_metrics.avg_conversation_length.toFixed(1)} messages`);
        console.log(`  • User satisfaction: ${metrics.conversation_metrics.user_satisfaction_estimate}%`);

        console.log(`\n🤖 RESPONSES:`);
        console.log(`  • Total responses: ${metrics.response_metrics.total_responses}`);
        console.log(`  • Success rate: ${metrics.response_metrics.quality_indicators.success_rate.toFixed(1)}%`);
        console.log(`  • Error rate: ${metrics.response_metrics.quality_indicators.error_rate.toFixed(1)}%`);

        console.log(`\n📈 USAGE PATTERNS:`);
        console.log(`  • Usage trend: ${metrics.usage_patterns.usage_trend}`);
        console.log(`  • Peak hours: ${metrics.usage_patterns.peak_usage_hours.map(h => `${h.hour}:00`).join(', ')}`);

        console.log(`\n🏥 SYSTEM HEALTH: ${metrics.system_health.overall_health.toUpperCase()}`);
        if (metrics.system_health.last_training_age) {
            console.log(`  • Last training: ${metrics.system_health.last_training_age} days ago`);
        }

        if (metrics.alerts.length > 0) {
            console.log(`\n🚨 ALERTS:`);
            metrics.alerts.forEach((alert, i) => {
                const emoji = alert.level === 'critical' ? '🔴' : alert.level === 'error' ? '🟠' : '🟡';
                console.log(`  ${emoji} ${alert.message}`);
                console.log(`     💡 ${alert.suggestion}`);
            });
        }

        console.log(`\n📅 Report generated: ${new Date(metrics.timestamp).toLocaleString()}`);
    }

    // Quick health check
    async quickHealthCheck() {
        const health = await this.checkSystemHealth();
        
        console.log('🏥 AI System Health Check:');
        console.log(`Overall Health: ${health.overall_health.toUpperCase()}`);
        
        const fileStatus = Object.entries(health.data_files_status)
            .map(([file, status]) => `${status.exists ? '✅' : '❌'} ${file}`)
            .join('\n  ');
        
        console.log(`Data Files:\n  ${fileStatus}`);
        
        if (health.last_training_age !== null) {
            console.log(`Last Training: ${health.last_training_age} days ago`);
        }

        return health;
    }
}

// CLI execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'report';

    const monitor = new AIPerformanceMonitor();

    try {
        switch (command) {
            case 'report':
            case 'analyze':
                const metrics = await monitor.analyzePerformance();
                monitor.displayReport(metrics);
                break;
                
            case 'health':
                await monitor.quickHealthCheck();
                break;
                
            case 'metrics':
                const metricsFile = path.join(__dirname, '..', 'data', 'performance_metrics.json');
                if (fs.existsSync(metricsFile)) {
                    const savedMetrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
                    console.log('📊 Latest Performance Metrics:');
                    console.log(JSON.stringify(savedMetrics, null, 2));
                } else {
                    console.log('📊 No performance metrics found. Run "monitor.js report" first.');
                }
                break;
                
            default:
                console.log('Usage: node monitor.js [command]');
                console.log('Commands:');
                console.log('  report     - Generate full performance report (default)');
                console.log('  health     - Quick health check');
                console.log('  metrics    - Show saved metrics');
                process.exit(1);
        }
    } catch (error) {
        console.error('❌ Monitoring error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = AIPerformanceMonitor;