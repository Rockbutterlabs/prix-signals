export interface User {
  id: string;
  username: string;
  isPremium: boolean;
  premiumExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  tier?: string;
}

export interface Signal {
  id: string;
  token: string;
  type: 'LOW_CAP' | 'PUMP' | 'VOLUME' | 'LAUNCH';
  strength: number;
  confidence: number;
  timestamp: string;
  sources: {
    twitter?: Array<{
      id: string;
      text: string;
      author: string;
      timestamp: string;
      likes: number;
      retweets: number;
    }>;
    telegram?: Array<{
      id: string;
      channel: string;
      message: string;
      timestamp: string;
      views: number;
    }>;
    volume?: {
      pair: string;
      volume24h: number;
      volumeChange24h: number;
      price: number;
      priceChange24h: number;
      marketCap: number;
    };
  };
  analysis: {
    marketCap: number;
    volume24h: number;
    priceChange24h: number;
    socialMentions: number;
    isPremiumOnly: boolean;
  };
}

export interface Database {
  users: {
    createOrUpdate(user: Omit<User, 'updatedAt'>): Promise<User>;
    getById(id: string): Promise<User | null>;
    getAll(): Promise<User[]>;
  };
  signals: {
    getUserSignalsToday(userId: string): Promise<Signal[]>;
  };
  stripe: {
    createCheckoutSession(userId: string): Promise<{ url: string }>;
  };
}

export enum SignalSource {
  TWITTER = 'TWITTER',
  TRADINGVIEW = 'TRADINGVIEW',
  TELEGRAM = 'TELEGRAM',
  API = 'API'
}

export interface SignalType {
  id: string;
  symbol: string;
  price: number;
  priceChange: number;
  volume: number;
  marketCap: number;
  analysis: string;
  riskLevel: string;
  timestamp: string;
  isPremium: boolean;
  socials?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  holders?: number;
  age?: string;
  chartUrl?: string;
  bubbleMapUrl?: string;
  percentBundled?: number;
  buyVolume30m?: number;
  sellVolume30m?: number;
  score?: {
    total: number;
    volume: number;
    momentum: number;
    social: number;
    technical: number;
    risk: number;
  };
  patterns?: string[];
  riskFactors?: string[];
  opportunities?: string[];
  confidence?: number;
}

export interface MarketOverview {
  hotSignals: Array<{
    symbol: string;
    priceChange: number;
  }>;
  volumeLeaders: Array<{
    symbol: string;
    volume: number;
  }>;
  premiumPicks: Array<{
    symbol: string;
    reason: string;
  }>;
}

export interface SignalAggregator {
  getLatestSignals(): Promise<SignalType[]>;
  getMarketOverview(): Promise<MarketOverview>;
  getLowCapSignals(): Promise<SignalType[]>;
}

export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
  PAST_DUE = 'PAST_DUE',
  UNPAID = 'UNPAID'
}

export interface Wallet {
  id: string;
  userId: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransaction {
  id: string;
  signature: string;
  walletAddress: string;
  timestamp: number;
  amount: number;
  tokenSymbol: string;
  type: 'buy' | 'sell';
  createdAt: Date;
} 