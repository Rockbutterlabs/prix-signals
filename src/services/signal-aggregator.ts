import { EventEmitter } from 'events';
import axios from 'axios';
import { SignalType, SignalSource } from '../types';

export interface SignalScore {
  total: number;
  volume: number;
  momentum: number;
  social: number;
  technical: number;
  risk: number;
}

export interface SignalAnalysis {
  score: SignalScore;
  patterns: string[];
  riskFactors: string[];
  opportunities: string[];
  confidence: number;
}

export class SignalAggregator extends EventEmitter {
  private readonly DEXSCREENER_API_URL = 'https://api.dexscreener.com/latest/dex';
  private readonly GMGN_API_URL = 'https://gmgn.ai/defi/router/v1/sol';
  private readonly JUPITER_API_URL = 'https://quote-api.jup.ag/v6';

  // Signal thresholds
  private readonly VOLUME_THRESHOLD = 50000; // $50k minimum volume
  private readonly MARKET_CAP_THRESHOLD = 10000000; // $10M max for low cap
  private readonly PRICE_CHANGE_THRESHOLD = 5; // 5% minimum price change
  private readonly HOLDER_THRESHOLD = 100; // Minimum holders

  // Rate limiting for Birdeye API
  private lastBirdeyeRequest = 0;
  private readonly BIRDEYE_RATE_LIMIT = 60000; // 60 seconds between requests

  // Rate limiting for GMGN API
  private lastGMGNRequest = 0;
  private readonly GMGN_RATE_LIMIT = 5000; // 5 seconds between requests

  // Rate limiting for Jupiter API
  private lastJupiterRequest = 0;
  private readonly JUPITER_RATE_LIMIT = 2000; // 2 seconds between requests

  constructor() {
    super();
  }

  async getLatestSignals(): Promise<SignalType[]> {
    try {
      console.log('🔄 Fetching latest signals...');
      
      // Fetch data from multiple sources concurrently
      const [dexScreenerData, birdeyeData, gmgnData, jupiterData] = await Promise.allSettled([
        this.getDexScreenerSignals(),
        this.getBirdeyeSignals(),
        this.getGMGNSignals(),
        this.getJupiterSignals()
      ]);

      // Combine and process signals
      const combinedSignals = this.combineSignals(
        dexScreenerData.status === 'fulfilled' ? dexScreenerData.value : [],
        birdeyeData.status === 'fulfilled' ? birdeyeData.value : [],
        gmgnData.status === 'fulfilled' ? gmgnData.value : [],
        jupiterData.status === 'fulfilled' ? jupiterData.value : []
      );

      // Apply advanced filters
      const filteredSignals = this.applyAdvancedFilters(combinedSignals);

      // Score and rank signals
      const scoredSignals = this.scoreSignals(filteredSignals);
      
      // Sort by score and return top signals
      const sortedSignals = scoredSignals
        .sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0))
        .slice(0, 20); // Return top 20 signals

      console.log(`✅ Found ${sortedSignals.length} high-quality signals`);
      return sortedSignals;
    } catch (error) {
      console.error('❌ Error getting latest signals:', error);
      return [];
    }
  }

  async getMarketOverview(): Promise<any> {
    try {
      const signals = await this.getLatestSignals();
      
      return {
        hotSignals: signals
          .filter(s => (s.score?.momentum || 0) > 20)
          .slice(0, 5)
          .map(s => ({
            symbol: s.symbol,
            momentum: s.score?.momentum || 0,
            priceChange: s.priceChange
          })),
        volumeLeaders: signals
          .sort((a, b) => b.volume - a.volume)
          .slice(0, 5)
          .map(s => ({
            symbol: s.symbol,
            volume: s.volume,
            priceChange: s.priceChange
          })),
        premiumPicks: signals
          .filter(s => s.isPremium)
          .slice(0, 5)
          .map(s => ({
            symbol: s.symbol,
            score: s.score?.total || 0,
            marketCap: s.marketCap
          })),
        trending: signals
          .filter(s => Math.abs(s.priceChange) > 10)
          .slice(0, 5)
          .map(s => ({
            symbol: s.symbol,
            momentum: s.score?.momentum || 0,
            priceChange: s.priceChange
          }))
      };
    } catch (error) {
      console.error('Error getting market overview:', error);
      return {
        hotSignals: [],
        volumeLeaders: [],
        premiumPicks: [],
        trending: []
      };
    }
  }

  async getLowCapSignals(): Promise<SignalType[]> {
    try {
      const signals = await this.getLatestSignals();
      return signals.filter(s => s.marketCap < 1000000); // Under $1M market cap
    } catch (error) {
      console.error('Error getting low cap signals:', error);
      return [];
    }
  }

  private async getDexScreenerSignals(): Promise<any[]> {
    try {
      // Use the working DexScreener search endpoint for trending pairs
      const response = await axios.get(`${this.DEXSCREENER_API_URL}/search`, {
        timeout: 10000,
        params: {
          q: 'solana', // Search for Solana pairs
          limit: 50
        }
      });
      return response.data.pairs || [];
    } catch (error) {
      console.error('Error fetching DexScreener data:', error);
      return [];
    }
  }

  private async getBirdeyeSignals(): Promise<any[]> {
    try {
      // Rate limiting: wait if we've made a request too recently
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastBirdeyeRequest;
      
      if (timeSinceLastRequest < this.BIRDEYE_RATE_LIMIT) {
        const waitTime = this.BIRDEYE_RATE_LIMIT - timeSinceLastRequest;
        console.log(`Rate limiting: waiting ${waitTime}ms before next Birdeye request`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Update last request time
      this.lastBirdeyeRequest = Date.now();
      
      // Use the correct Birdeye trending tokens endpoint from official docs
      const response = await axios.get(
        'https://public-api.birdeye.so/defi/token_trending',
        {
          timeout: 10000,
          headers: {
            'X-API-KEY': '1a2462a9ef15425884d6df703705d50e'
          }
        }
      );
      
      // Extract tokens array from the new response structure
      if (response.data.success && response.data.data && response.data.data.tokens) {
        return response.data.data.tokens;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching Birdeye data:', error);
      return [];
    }
  }

  private async getGMGNSignals(): Promise<any[]> {
    try {
      // Rate limiting: wait if we've made a request too recently
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastGMGNRequest;
      
      if (timeSinceLastRequest < this.GMGN_RATE_LIMIT) {
        const waitTime = this.GMGN_RATE_LIMIT - timeSinceLastRequest;
        console.log(`Rate limiting: waiting ${waitTime}ms before next GMGN request`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Update last request time
      this.lastGMGNRequest = Date.now();
      
      // Get swap routes for popular token pairs to identify trending tokens
      const swapRoutes = await this.getSwapRoutes();
      return this.processSwapRoutes(swapRoutes);
    } catch (error) {
      console.error('Error fetching GMGN data:', error);
      return [];
    }
  }

  private async getSwapRoutes(): Promise<any[]> {
    try {
      // Common token addresses for Solana
      const commonTokens = [
        'So11111111111111111111111111111111111111112', // Wrapped SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk
        '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
      ];

      const routes: any[] = [];
      
      // Get swap routes for SOL to other tokens
      for (let i = 1; i < commonTokens.length; i++) {
        try {
          const route = await this.getSwapRoute(
            commonTokens[0], // SOL
            commonTokens[i],
            '1000000000', // 1 SOL in lamports
            '11111111111111111111111111111112', // System program
            '1' // 1% slippage
          );
          
          if (route && route.success) {
            routes.push(route);
          }
        } catch (error) {
          console.log(`Failed to get route for token ${i}:`, (error as Error).message);
        }
      }
      
      return routes;
    } catch (error) {
      console.error('Error getting swap routes:', error);
      return [];
    }
  }

  private async getSwapRoute(
    tokenInAddress: string,
    tokenOutAddress: string,
    inAmount: string,
    fromAddress: string,
    slippage: string
  ): Promise<any> {
    try {
      const url = `${this.GMGN_API_URL}/tx/get_swap_route?token_in_address=${tokenInAddress}&token_out_address=${tokenOutAddress}&in_amount=${inAmount}&from_address=${fromAddress}&slippage=${slippage}`;
      
      const response = await axios.get(url, {
        timeout: 10000
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting swap route:', error);
      return null;
    }
  }

  private processSwapRoutes(routes: any[]): any[] {
    const signals: any[] = [];
    
    for (const route of routes) {
      if (route && route.data) {
        // Extract token information from the route
        const tokenInfo = {
          id: route.data.token_out_address || route.data.out_token,
          symbol: this.getTokenSymbol(route.data.token_out_address),
          price: this.calculatePriceFromRoute(route),
          priceChange: 0, // Not available from swap routes
          volume: route.data.volume_24h || 0,
          marketCap: route.data.market_cap || 0,
          holders: route.data.holders || 0,
          age: 'Unknown',
          source: SignalSource.API,
          rawData: route,
          swapRoute: route.data
        };
        
        signals.push(tokenInfo);
      }
    }
    
    return signals;
  }

  private getTokenSymbol(tokenAddress: string): string {
    // Map common token addresses to symbols
    const tokenSymbols: { [key: string]: string } = {
      'So11111111111111111111111111111111111111112': 'SOL',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
      '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': 'POPCAT'
    };
    
    return tokenSymbols[tokenAddress] || 'UNKNOWN';
  }

  private calculatePriceFromRoute(route: any): number {
    try {
      if (route.data && route.data.out_amount && route.data.in_amount) {
        const inAmount = parseFloat(route.data.in_amount) / 1e9; // Convert from lamports to SOL
        const outAmount = parseFloat(route.data.out_amount) / 1e6; // Convert from smallest unit to token
        return inAmount / outAmount;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  private combineSignals(dexScreenerData: any[], birdeyeData: any[], gmgnData: any[], jupiterData: any[]): any[] {
    const signals: any[] = [];
    const processedTokens = new Set<string>();

    // Process DexScreener data
    for (const pair of dexScreenerData) {
      if (this.isValidSignal(pair) && !processedTokens.has(pair.pairAddress)) {
        signals.push(this.processDexScreenerPair(pair));
        processedTokens.add(pair.pairAddress);
      }
    }

    // Process Birdeye data
    for (const token of birdeyeData) {
      if (this.isValidSignal(token) && !processedTokens.has(token.address)) {
        signals.push(this.processBirdeyeToken(token));
        processedTokens.add(token.address);
      }
    }

    // Process GMGN data
    for (const signal of gmgnData) {
      if (this.isValidSignal(signal) && !processedTokens.has(signal.id)) {
        signals.push(this.processGMGNSignal(signal));
        processedTokens.add(signal.id);
      }
    }

    // Process Jupiter data
    for (const signal of jupiterData) {
      if (this.isValidSignal(signal) && !processedTokens.has(signal.id)) {
        signals.push(this.processJupiterSignal(signal));
        processedTokens.add(signal.id);
      }
    }

    return signals;
  }

  private isValidSignal(data: any): boolean {
    return (
      data.volumeUsd >= this.VOLUME_THRESHOLD &&
      data.marketCap <= this.MARKET_CAP_THRESHOLD &&
      Math.abs(data.priceChange24h) >= this.PRICE_CHANGE_THRESHOLD &&
      data.holders >= this.HOLDER_THRESHOLD
    );
  }

  private processDexScreenerPair(pair: any): any {
    return {
      id: pair.pairAddress,
      symbol: pair.baseToken.symbol,
      price: parseFloat(pair.priceUsd),
      priceChange: parseFloat(pair.priceChange24h),
      volume: parseFloat(pair.volumeUsd),
      marketCap: parseFloat(pair.marketCap),
      holders: pair.holders || 0,
      age: pair.age || 'Unknown',
      source: SignalSource.API,
      rawData: pair
    };
  }

  private processBirdeyeToken(token: any): any {
    return {
      id: token.address,
      symbol: token.symbol,
      price: parseFloat(token.price),
      priceChange: parseFloat(token.priceChange24h),
      volume: parseFloat(token.volume24h),
      marketCap: parseFloat(token.marketCap),
      holders: token.holders || 0,
      age: token.age || 'Unknown',
      source: SignalSource.API,
      rawData: token
    };
  }

  private processGMGNSignal(signal: any): any {
    return {
      id: signal.id,
      symbol: signal.symbol,
      price: parseFloat(signal.price),
      priceChange: parseFloat(signal.priceChange24h),
      volume: parseFloat(signal.volume24h),
      marketCap: parseFloat(signal.marketCap),
      holders: signal.holders || 0,
      age: signal.age || 'Unknown',
      source: SignalSource.API,
      rawData: signal
    };
  }

  private processJupiterSignal(signal: any): any {
    return {
      id: signal.id,
      symbol: signal.symbol,
      price: parseFloat(signal.price),
      priceChange: parseFloat(signal.priceChange24h),
      volume: parseFloat(signal.volume24h),
      marketCap: parseFloat(signal.marketCap),
      holders: signal.holders || 0,
      age: signal.age || 'Unknown',
      source: SignalSource.API,
      rawData: signal
    };
  }

  private applyAdvancedFilters(signals: any[]): any[] {
    return signals.filter(signal => {
      // Volume spike detection
      const volumeSpike = signal.volume > signal.marketCap * 0.1; // Volume > 10% of market cap
      
      // Price momentum
      const strongMomentum = Math.abs(signal.priceChange) > 15;
      
      // Market cap validation
      const validMarketCap = signal.marketCap > 10000 && signal.marketCap < 10000000;
      
      // Holder distribution
      const goodHolderDistribution = signal.holders > 200;
      
      return volumeSpike || strongMomentum || (validMarketCap && goodHolderDistribution);
    });
  }

  private scoreSignals(signals: any[]): SignalType[] {
    return signals.map(signal => {
      const analysis = this.analyzeSignal(signal);
      const score = analysis.score;
      
      return {
        id: signal.id,
        symbol: signal.symbol,
        price: signal.price,
        priceChange: signal.priceChange,
        volume: signal.volume,
        marketCap: signal.marketCap,
        analysis: analysis.patterns.join('. '),
        riskLevel: this.getRiskLevel(score.risk),
        timestamp: new Date().toISOString(),
        isPremium: score.total > 75 || signal.marketCap < 500000,
        socials: this.extractSocials(signal),
        holders: signal.holders,
        age: signal.age,
        chartUrl: this.generateChartUrl(signal),
        bubbleMapUrl: this.generateBubbleMapUrl(signal),
        percentBundled: signal.percentBundled,
        buyVolume30m: signal.buyVolume30m,
        sellVolume30m: signal.sellVolume30m,
        score: score,
        patterns: analysis.patterns,
        riskFactors: analysis.riskFactors,
        opportunities: analysis.opportunities,
        confidence: analysis.confidence
      };
    });
  }

  private analyzeSignal(signal: any): SignalAnalysis {
    const score: SignalScore = {
      total: 0,
      volume: 0,
      momentum: 0,
      social: 0,
      technical: 0,
      risk: 0
    };

    const patterns: string[] = [];
    const riskFactors: string[] = [];
    const opportunities: string[] = [];

    // Volume Analysis (0-25 points)
    const volumeToMarketCap = signal.volume / signal.marketCap;
    if (volumeToMarketCap > 0.5) {
      score.volume = 25;
      patterns.push('Extremely high volume relative to market cap');
      opportunities.push('Strong trading activity indicates high interest');
    } else if (volumeToMarketCap > 0.2) {
      score.volume = 20;
      patterns.push('High volume relative to market cap');
    } else if (volumeToMarketCap > 0.1) {
      score.volume = 15;
      patterns.push('Moderate volume activity');
    } else {
      score.volume = 5;
      riskFactors.push('Low volume may indicate low liquidity');
    }

    // Momentum Analysis (0-25 points)
    const absPriceChange = Math.abs(signal.priceChange);
    if (absPriceChange > 50) {
      score.momentum = 25;
      patterns.push('Extreme price movement detected');
      if (signal.priceChange > 0) {
        opportunities.push('Strong upward momentum');
      } else {
        riskFactors.push('Sharp decline - potential reversal opportunity');
      }
    } else if (absPriceChange > 25) {
      score.momentum = 20;
      patterns.push('Strong price momentum');
    } else if (absPriceChange > 10) {
      score.momentum = 15;
      patterns.push('Moderate price movement');
    } else {
      score.momentum = 5;
    }

    // Technical Analysis (0-20 points)
    if (signal.holders > 1000) {
      score.technical = 20;
      patterns.push('Large holder base indicates community interest');
    } else if (signal.holders > 500) {
      score.technical = 15;
      patterns.push('Good holder distribution');
    } else if (signal.holders > 200) {
      score.technical = 10;
    } else {
      score.technical = 5;
      riskFactors.push('Low holder count may indicate concentration risk');
    }

    // Market Cap Analysis (0-15 points)
    if (signal.marketCap < 100000) {
      score.technical += 15;
      patterns.push('Ultra low market cap - high growth potential');
      opportunities.push('Early stage token with room for growth');
    } else if (signal.marketCap < 500000) {
      score.technical += 12;
      patterns.push('Low market cap opportunity');
    } else if (signal.marketCap < 1000000) {
      score.technical += 8;
    }

    // Risk Assessment (0-15 points)
    if (signal.marketCap < 50000) {
      score.risk = 15;
      riskFactors.push('Very low market cap - extremely high risk');
    } else if (signal.marketCap < 200000) {
      score.risk = 10;
      riskFactors.push('Low market cap - high risk, high reward');
    } else if (signal.marketCap < 1000000) {
      score.risk = 5;
    } else {
      score.risk = 0;
    }

    // Calculate total score
    score.total = score.volume + score.momentum + score.technical - score.risk;
    score.total = Math.max(0, Math.min(100, score.total)); // Clamp between 0-100

    // Calculate confidence based on data quality
    const confidence = Math.min(95, 50 + (score.total * 0.45));

    return {
      score,
      patterns,
      riskFactors,
      opportunities,
      confidence
    };
  }

  private getRiskLevel(riskScore: number): string {
    if (riskScore > 10) return 'Very High';
    if (riskScore > 7) return 'High';
    if (riskScore > 4) return 'Medium';
    return 'Low';
  }

  private extractSocials(signal: any): any {
    return {
      twitter: signal.rawData?.baseToken?.twitter || signal.rawData?.twitter,
      telegram: signal.rawData?.baseToken?.telegram || signal.rawData?.telegram,
      website: signal.rawData?.baseToken?.website || signal.rawData?.website
    };
  }

  private generateChartUrl(signal: any): string {
    return `https://dexscreener.com/solana/${signal.id}`;
  }

  private generateBubbleMapUrl(signal: any): string {
    return `https://bubblemaps.io/solana/${signal.id}`;
  }

  private async getJupiterSignals(): Promise<any[]> {
    try {
      // Rate limiting: wait if we've made a request too recently
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastJupiterRequest;
      
      if (timeSinceLastRequest < this.JUPITER_RATE_LIMIT) {
        const waitTime = this.JUPITER_RATE_LIMIT - timeSinceLastRequest;
        console.log(`Rate limiting: waiting ${waitTime}ms before next Jupiter request`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Update last request time
      this.lastJupiterRequest = Date.now();
      
      // Get Jupiter quotes for popular token pairs
      const quotes = await this.getJupiterQuotes();
      return this.processJupiterQuotes(quotes);
    } catch (error) {
      console.error('Error fetching Jupiter data:', error);
      return [];
    }
  }

  private async getJupiterQuotes(): Promise<any[]> {
    try {
      // Common token addresses for Solana
      const commonTokens = [
        'So11111111111111111111111111111111111111112', // Wrapped SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk
        '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
      ];

      const quotes: any[] = [];
      
      // Get quotes for SOL to other tokens
      for (let i = 1; i < commonTokens.length; i++) {
        try {
          const quote = await this.getJupiterQuote(
            commonTokens[0], // SOL
            commonTokens[i],
            '1000000000', // 1 SOL in lamports
            '50' // 0.5% slippage
          );
          
          if (quote && quote.inputMint && quote.outputMint) {
            quotes.push(quote);
          }
        } catch (error) {
          console.log(`Failed to get Jupiter quote for token ${i}:`, (error as Error).message);
        }
      }
      
      return quotes;
    } catch (error) {
      console.error('Error getting Jupiter quotes:', error);
      return [];
    }
  }

  private async getJupiterQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: string
  ): Promise<any> {
    try {
      const url = `${this.JUPITER_API_URL}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
      
      const response = await axios.get(url, {
        timeout: 10000
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting Jupiter quote:', error);
      return null;
    }
  }

  private processJupiterQuotes(quotes: any[]): any[] {
    const signals: any[] = [];
    
    for (const quote of quotes) {
      if (quote && quote.outputMint) {
        // Extract token information from the quote
        const tokenInfo = {
          id: quote.outputMint,
          symbol: this.getTokenSymbol(quote.outputMint),
          price: this.calculatePriceFromJupiterQuote(quote),
          priceChange: 0, // Not available from quotes
          volume: quote.swapUsdValue ? parseFloat(quote.swapUsdValue) * 1000 : 0, // Estimate volume
          marketCap: 0, // Not available from quotes
          holders: 0, // Not available from quotes
          age: 'Unknown',
          source: SignalSource.API,
          rawData: quote,
          jupiterQuote: quote,
          priceImpact: quote.priceImpactPct ? parseFloat(quote.priceImpactPct) : 0,
          routePlan: quote.routePlan || []
        };
        
        signals.push(tokenInfo);
      }
    }
    
    return signals;
  }

  private calculatePriceFromJupiterQuote(quote: any): number {
    try {
      if (quote.inAmount && quote.outAmount) {
        const inAmount = parseFloat(quote.inAmount) / 1e9; // Convert from lamports to SOL
        const outAmount = parseFloat(quote.outAmount) / 1e6; // Convert from smallest unit to token
        return inAmount / outAmount;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }
} 