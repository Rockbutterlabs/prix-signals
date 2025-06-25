import { EventEmitter } from 'events';
import { UserManager, TestUser } from './userManager';
import { SignalAggregator } from './signal-aggregator';
import { SignalType } from '../types';
import { BotService } from './bot';

export interface SignalDelivery {
  userId: string;
  telegramId: number;
  signalId: string;
  deliveredAt: Date;
  status: 'delivered' | 'failed' | 'rate_limited';
  error?: string;
}

export interface SignalAnalytics {
  totalSignals: number;
  deliveredSignals: number;
  failedSignals: number;
  rateLimitedSignals: number;
  averageDeliveryTime: number;
  userEngagement: {
    userId: string;
    username: string;
    signalsReceived: number;
    lastActivity: Date;
    isPremium: boolean;
  }[];
}

export class SignalDistributor extends EventEmitter {
  private static instance: SignalDistributor;
  private userManager: UserManager;
  private signalAggregator: SignalAggregator;
  private bot: BotService;
  
  private deliveryHistory: SignalDelivery[] = [];
  private lastSignalTime: { [userId: string]: number } = {};
  private isRunning: boolean = false;
  private signalInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.userManager = UserManager.getInstance();
    this.signalAggregator = new SignalAggregator();
    this.bot = new BotService();
  }

  static getInstance(): SignalDistributor {
    if (!SignalDistributor.instance) {
      SignalDistributor.instance = new SignalDistributor();
    }
    return SignalDistributor.instance;
  }

  async startSignalDistribution(intervalMinutes: number = 15): Promise<void> {
    if (this.isRunning) {
      console.log('Signal distribution is already running');
      return;
    }

    console.log(`🚀 Starting signal distribution for 20 traders (${intervalMinutes}min intervals)`);
    this.isRunning = true;

    // Send initial signals
    await this.distributeSignals();

    // Set up periodic distribution
    this.signalInterval = setInterval(async () => {
      await this.distributeSignals();
    }, intervalMinutes * 60 * 1000);

    this.emit('started', { intervalMinutes });
  }

  async stopSignalDistribution(): Promise<void> {
    if (!this.isRunning) {
      console.log('Signal distribution is not running');
      return;
    }

    console.log('🛑 Stopping signal distribution');
    this.isRunning = false;

    if (this.signalInterval) {
      clearInterval(this.signalInterval);
      this.signalInterval = null;
    }

    this.emit('stopped');
  }

  async distributeSignals(): Promise<void> {
    try {
      console.log('📡 Fetching latest signals...');
      const signals = await this.signalAggregator.getLatestSignals();
      
      if (signals.length === 0) {
        console.log('⚠️ No signals available for distribution');
        return;
      }

      console.log(`📊 Found ${signals.length} signals, distributing to traders...`);
      
      const users = await this.userManager.getActiveUsers();
      const deliveryPromises = users.map(user => this.deliverSignalToUser(user, signals[0]));
      
      const results = await Promise.allSettled(deliveryPromises);
      
      let delivered = 0;
      let failed = 0;
      let rateLimited = 0;

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const delivery = result.value;
          this.deliveryHistory.push(delivery);
          
          if (delivery.status === 'delivered') delivered++;
          else if (delivery.status === 'rate_limited') rateLimited++;
          else failed++;
        } else {
          failed++;
        }
      });

      console.log(`✅ Signal distribution complete: ${delivered} delivered, ${failed} failed, ${rateLimited} rate limited`);
      
      this.emit('signalsDistributed', {
        totalUsers: users.length,
        delivered,
        failed,
        rateLimited,
        signalCount: signals.length
      });

    } catch (error) {
      console.error('❌ Error distributing signals:', error);
      this.emit('error', error);
    }
  }

  private async deliverSignalToUser(user: TestUser, signal: SignalType): Promise<SignalDelivery> {
    const now = Date.now();
    const lastSignal = this.lastSignalTime[user.id] || 0;
    const timeSinceLastSignal = now - lastSignal;

    // Check rate limiting
    if (timeSinceLastSignal < 5 * 60 * 1000) { // 5 minutes cooldown
      return {
        userId: user.id,
        telegramId: user.telegramId,
        signalId: signal.id,
        deliveredAt: new Date(),
        status: 'rate_limited',
        error: 'Rate limited - too soon since last signal'
      };
    }

    try {
      // Format signal message
      const message = this.formatSignalMessage(signal, user);
      
      // Send via Telegram bot
      await this.bot.sendMessage(user.telegramId.toString(), message);
      
      // Update tracking
      this.lastSignalTime[user.id] = now;
      await this.userManager.incrementSignalCount(user.telegramId);
      
      return {
        userId: user.id,
        telegramId: user.telegramId,
        signalId: signal.id,
        deliveredAt: new Date(),
        status: 'delivered'
      };

    } catch (error) {
      console.error(`Failed to deliver signal to user ${user.username}:`, error);
      return {
        userId: user.id,
        telegramId: user.telegramId,
        signalId: signal.id,
        deliveredAt: new Date(),
        status: 'failed',
        error: (error as Error).message
      };
    }
  }

  private formatSignalMessage(signal: SignalType, user: TestUser): string {
    const score = signal.score?.total || 0;
    const momentum = signal.score?.momentum || 0;
    const volume = signal.score?.volume || 0;
    const risk = signal.score?.risk || 0;

    return `🚨 **SIGNAL ALERT** 🚨

💰 **Token**: ${signal.symbol}
💵 **Price**: $${signal.price.toFixed(6)}
📈 **24h Change**: ${signal.priceChange > 0 ? '+' : ''}${signal.priceChange.toFixed(2)}%
📊 **Volume**: $${(signal.volume / 1000).toFixed(1)}k
🏪 **Market Cap**: $${(signal.marketCap / 1000000).toFixed(2)}M

🎯 **Signal Score**: ${score.toFixed(1)}/100
⚡ **Momentum**: ${momentum.toFixed(1)}/100
📈 **Volume Score**: ${volume.toFixed(1)}/100
⚠️ **Risk Level**: ${risk.toFixed(1)}/100

🔗 **Links**:
• Chart: ${signal.chartUrl || 'N/A'}
• Bubblemaps: ${signal.bubbleMapUrl || 'N/A'}

⚠️ **Risk Warning**: This is not financial advice. Always do your own research and never invest more than you can afford to lose.

👤 **User**: ${user.username} ${user.isPremium ? '⭐' : ''}
⏰ **Time**: ${new Date().toLocaleString()}`;
  }

  async getAnalytics(): Promise<SignalAnalytics> {
    const users = await this.userManager.getActiveUsers();
    const recentDeliveries = this.deliveryHistory.filter(
      d => d.deliveredAt > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );

    const delivered = recentDeliveries.filter(d => d.status === 'delivered').length;
    const failed = recentDeliveries.filter(d => d.status === 'failed').length;
    const rateLimited = recentDeliveries.filter(d => d.status === 'rate_limited').length;

    const userEngagement = users.map(user => {
      const userDeliveries = recentDeliveries.filter(d => d.userId === user.id);
      return {
        userId: user.id,
        username: user.username,
        signalsReceived: userDeliveries.filter(d => d.status === 'delivered').length,
        lastActivity: user.lastActivity,
        isPremium: user.isPremium
      };
    });

    return {
      totalSignals: recentDeliveries.length,
      deliveredSignals: delivered,
      failedSignals: failed,
      rateLimitedSignals: rateLimited,
      averageDeliveryTime: 0, // TODO: Calculate actual delivery time
      userEngagement
    };
  }

  async getDeliveryHistory(limit: number = 50): Promise<SignalDelivery[]> {
    return this.deliveryHistory
      .sort((a, b) => b.deliveredAt.getTime() - a.deliveredAt.getTime())
      .slice(0, limit);
  }

  isDistributionRunning(): boolean {
    return this.isRunning;
  }
} 