import { withRateLimit } from '../utils/rateLimiter';
import { db } from './database';

interface TokenData {
  address: string;
  symbol: string;
  name: string;
  marketCap: number;
  price: number;
  volume24h: number;
  priceChange24h: number;
}

export class SignalAggregator {
  private static instance: SignalAggregator;
  private readonly MAX_MARKET_CAP = 1000000; // $1M max market cap
  private readonly MIN_VOLUME = 10000; // $10K min 24h volume

  private constructor() {}

  static getInstance(): SignalAggregator {
    if (!SignalAggregator.instance) {
      SignalAggregator.instance = new SignalAggregator();
    }
    return SignalAggregator.instance;
  }

  async fetchTokenData(address: string): Promise<TokenData | null> {
    try {
      return await withRateLimit(async () => {
        const response = await fetch(
          `${process.env.DEXSCREENER_API_URL}/tokens/${address}`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch token data: ${response.statusText}`);
        }

        const data = await response.json();
        return this.parseTokenData(data);
      }, true); // High priority for token data
    } catch (error) {
      console.error(`Error fetching token data for ${address}:`, error);
      return null;
    }
  }

  private parseTokenData(data: any): TokenData | null {
    try {
      const token = data.pairs?.[0];
      if (!token) return null;

      return {
        address: token.baseToken.address,
        symbol: token.baseToken.symbol,
        name: token.baseToken.name,
        marketCap: token.fdv || 0,
        price: token.priceUsd || 0,
        volume24h: token.volume24h || 0,
        priceChange24h: token.priceChange24h || 0,
      };
    } catch (error) {
      console.error('Error parsing token data:', error);
      return null;
    }
  }

  async processSignal(signal: any): Promise<void> {
    try {
      const tokenData = await this.fetchTokenData(signal.tokenAddress);
      
      if (!tokenData) {
        console.log(`Skipping signal for ${signal.tokenAddress}: No token data available`);
        return;
      }

      // Apply filters
      if (
        tokenData.marketCap > this.MAX_MARKET_CAP ||
        tokenData.volume24h < this.MIN_VOLUME
      ) {
        console.log(
          `Skipping signal for ${tokenData.symbol}: Market cap or volume too high/low`
        );
        return;
      }

      // Store signal in database
      await db.signals.create({
        token: tokenData.symbol,
        type: 'LOW_CAP',
        strength: this.calculateSignalStrength(tokenData),
        confidence: this.calculateConfidence(tokenData),
        timestamp: new Date().toISOString(),
        sources: {
          volume: {
            pair: signal.tokenAddress,
            volume24h: tokenData.volume24h,
            volumeChange24h: 0, // TODO: Calculate from historical data
            price: tokenData.price,
            priceChange24h: tokenData.priceChange24h,
            marketCap: tokenData.marketCap
          }
        },
        analysis: {
          marketCap: tokenData.marketCap,
          volume24h: tokenData.volume24h,
          priceChange24h: tokenData.priceChange24h,
          socialMentions: 0, // TODO: Calculate from social data
          isPremiumOnly: tokenData.marketCap < 500000
        }
      });

      // Notify users based on their tier
      await this.notifyUsers(signal, tokenData);
    } catch (error) {
      console.error('Error processing signal:', error);
    }
  }

  private calculateSignalStrength(tokenData: TokenData): number {
    // Calculate signal strength based on volume, price change, and market cap
    const volumeScore = Math.min(tokenData.volume24h / 100000, 1) * 0.4;
    const priceChangeScore = Math.min(Math.abs(tokenData.priceChange24h) / 100, 1) * 0.4;
    const marketCapScore = Math.max(1 - (tokenData.marketCap / 1000000), 0) * 0.2;
    
    return Math.round((volumeScore + priceChangeScore + marketCapScore) * 100);
  }

  private calculateConfidence(tokenData: TokenData): number {
    // Calculate confidence based on volume consistency and market cap
    const volumeConfidence = Math.min(tokenData.volume24h / 50000, 1) * 0.6;
    const marketCapConfidence = Math.max(1 - (tokenData.marketCap / 1000000), 0) * 0.4;
    
    return Math.round((volumeConfidence + marketCapConfidence) * 100);
  }

  private async notifyUsers(signal: any, tokenData: TokenData): Promise<void> {
    try {
      const users = await db.users.getAll();
      
      for (const user of users) {
        if (!user.isPremium) {
          // Free users get delayed notifications
          await this.queueDelayedNotification(user, signal, tokenData);
        } else {
          // Premium users get immediate notifications
          await this.sendImmediateNotification(user, signal, tokenData);
        }
      }
    } catch (error) {
      console.error('Error notifying users:', error);
    }
  }

  private async queueDelayedNotification(
    user: any,
    _signal: any,
    tokenData: TokenData
  ): Promise<void> {
    // Implementation will be added in the notification service
    console.log(`Queueing delayed notification for user ${user.id} about ${tokenData.symbol}`);
  }

  private async sendImmediateNotification(
    user: any,
    _signal: any,
    tokenData: TokenData
  ): Promise<void> {
    // Implementation will be added in the notification service
    console.log(`Sending immediate notification to user ${user.id} about ${tokenData.symbol}`);
  }
} 