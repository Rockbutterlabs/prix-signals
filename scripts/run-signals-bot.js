#!/usr/bin/env node

const { SignalDistributor } = require('../dist/services/signalDistributor');
const { UserManager } = require('../dist/services/userManager');
const { SignalAggregator } = require('../dist/services/signalAggregator');

class SignalsBotManager {
  constructor() {
    this.signalDistributor = SignalDistributor.getInstance();
    this.userManager = UserManager.getInstance();
    this.signalAggregator = new SignalAggregator();
    this.isRunning = false;
  }

  async start() {
    try {
      console.log('🚀 Starting Prix Signals Bot for 20 Traders');
      console.log('=' .repeat(50));

      // Check current user stats
      const stats = await this.userManager.getTestGroupStats();
      console.log(`📊 Current Stats:`);
      console.log(`   • Total Users: ${stats.totalUsers}/20`);
      console.log(`   • Active Users: ${stats.activeUsers}`);
      console.log(`   • Premium Users: ${stats.premiumUsers}`);
      console.log(`   • Available Spots: ${stats.availableSpots}`);
      console.log('');

      if (stats.totalUsers === 0) {
        console.log('⚠️  No users found. Please add test users first.');
        console.log('   Use: npm run add-test-user <telegram_id> <username>');
        return;
      }

      // Test signal generation
      console.log('🔍 Testing signal generation...');
      const signals = await this.signalAggregator.getLatestSignals();
      console.log(`   • Generated ${signals.length} signals`);
      
      if (signals.length === 0) {
        console.log('⚠️  No signals available. Check API connections.');
        return;
      }

      // Start signal distribution
      console.log('📡 Starting signal distribution...');
      await this.signalDistributor.startSignalDistribution(15); // 15-minute intervals
      
      this.isRunning = true;
      console.log('✅ Signals bot is now running!');
      console.log('   • Signal interval: 15 minutes');
      console.log('   • Users: ' + stats.totalUsers);
      console.log('   • Press Ctrl+C to stop');
      console.log('');

      // Set up event listeners
      this.setupEventListeners();

      // Start monitoring
      this.startMonitoring();

    } catch (error) {
      console.error('❌ Error starting signals bot:', error);
      process.exit(1);
    }
  }

  setupEventListeners() {
    this.signalDistributor.on('started', (data) => {
      console.log(`📡 Signal distribution started (${data.intervalMinutes}min intervals)`);
    });

    this.signalDistributor.on('signalsDistributed', (data) => {
      console.log(`📊 Signal distribution complete:`);
      console.log(`   • Users: ${data.totalUsers}`);
      console.log(`   • Delivered: ${data.delivered}`);
      console.log(`   • Failed: ${data.failed}`);
      console.log(`   • Rate Limited: ${data.rateLimited}`);
      console.log(`   • Signals: ${data.signalCount}`);
      console.log('');
    });

    this.signalDistributor.on('error', (error) => {
      console.error('❌ Signal distribution error:', error);
    });

    this.signalDistributor.on('stopped', () => {
      console.log('🛑 Signal distribution stopped');
    });
  }

  async startMonitoring() {
    // Monitor every 5 minutes
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const analytics = await this.signalDistributor.getAnalytics();
        const stats = await this.userManager.getTestGroupStats();

        console.log('📈 Bot Status Update:');
        console.log(`   • Users: ${stats.totalUsers}/20 (${stats.premiumUsers} premium)`);
        console.log(`   • Last 24h: ${analytics.deliveredSignals} signals delivered`);
        console.log(`   • Success Rate: ${analytics.totalSignals > 0 ? ((analytics.deliveredSignals / analytics.totalSignals) * 100).toFixed(1) : 0}%`);
        console.log(`   • Distribution: ${this.signalDistributor.isDistributionRunning() ? '🟢 Running' : '🔴 Stopped'}`);
        console.log('');

      } catch (error) {
        console.error('❌ Error in monitoring:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async stop() {
    if (!this.isRunning) {
      console.log('Bot is not running');
      return;
    }

    console.log('🛑 Stopping signals bot...');
    await this.signalDistributor.stopSignalDistribution();
    this.isRunning = false;
    console.log('✅ Bot stopped');
  }

  async showAnalytics() {
    try {
      const analytics = await this.signalDistributor.getAnalytics();
      const stats = await this.userManager.getTestGroupStats();

      console.log('📊 Bot Analytics:');
      console.log('=' .repeat(40));
      console.log(`Total Users: ${stats.totalUsers}/20`);
      console.log(`Premium Users: ${stats.premiumUsers}`);
      console.log(`Available Spots: ${stats.availableSpots}`);
      console.log('');
      console.log('Last 24 Hours:');
      console.log(`  • Total Signals: ${analytics.totalSignals}`);
      console.log(`  • Delivered: ${analytics.deliveredSignals}`);
      console.log(`  • Failed: ${analytics.failedSignals}`);
      console.log(`  • Rate Limited: ${analytics.rateLimitedSignals}`);
      console.log(`  • Success Rate: ${analytics.totalSignals > 0 ? ((analytics.deliveredSignals / analytics.totalSignals) * 100).toFixed(1) : 0}%`);
      console.log('');

      if (analytics.userEngagement.length > 0) {
        console.log('User Engagement:');
        analytics.userEngagement.forEach(user => {
          const status = user.isPremium ? '⭐' : '👤';
          console.log(`  ${status} ${user.username}: ${user.signalsReceived} signals`);
        });
      }

    } catch (error) {
      console.error('❌ Error getting analytics:', error);
    }
  }

  async showDeliveryHistory(limit = 10) {
    try {
      const history = await this.signalDistributor.getDeliveryHistory(limit);
      
      console.log(`📋 Recent Delivery History (last ${limit}):`);
      console.log('=' .repeat(50));
      
      history.forEach((delivery, index) => {
        const status = delivery.status === 'delivered' ? '✅' : 
                      delivery.status === 'failed' ? '❌' : '⏰';
        const time = delivery.deliveredAt.toLocaleString();
        console.log(`${index + 1}. ${status} User ${delivery.telegramId} - ${delivery.status} (${time})`);
        if (delivery.error) {
          console.log(`   Error: ${delivery.error}`);
        }
      });

    } catch (error) {
      console.error('❌ Error getting delivery history:', error);
    }
  }
}

// CLI Interface
async function main() {
  const manager = new SignalsBotManager();
  const command = process.argv[2];

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await manager.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await manager.stop();
    process.exit(0);
  });

  switch (command) {
    case 'start':
      await manager.start();
      break;
    
    case 'stop':
      await manager.stop();
      break;
    
    case 'analytics':
      await manager.showAnalytics();
      break;
    
    case 'history':
      const limit = parseInt(process.argv[3]) || 10;
      await manager.showDeliveryHistory(limit);
      break;
    
    default:
      console.log('🚀 Prix Signals Bot Manager');
      console.log('=' .repeat(30));
      console.log('Commands:');
      console.log('  start     - Start the signals bot');
      console.log('  stop      - Stop the signals bot');
      console.log('  analytics - Show bot analytics');
      console.log('  history   - Show delivery history');
      console.log('');
      console.log('Examples:');
      console.log('  node scripts/run-signals-bot.js start');
      console.log('  node scripts/run-signals-bot.js analytics');
      console.log('  node scripts/run-signals-bot.js history 20');
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SignalsBotManager }; 