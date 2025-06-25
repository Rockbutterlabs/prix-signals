import { Connection, PublicKey } from '@solana/web3.js';
import { withRateLimit } from '../utils/rateLimiter';

interface TokenLogs {
  signature: string;
  err: any;
  logs: string[];
}

export class SolanaService {
  private static instance: SolanaService;
  private connection: Connection;
  private wsConnection: Connection;

  private constructor() {
    if (!process.env.SOLANA_RPC_URL || !process.env.SOLANA_WS_URL) {
      throw new Error('Solana RPC and WebSocket URLs must be set in environment variables');
    }

    this.connection = new Connection(process.env.SOLANA_RPC_URL, {
      commitment: 'confirmed',
      wsEndpoint: process.env.SOLANA_WS_URL,
      confirmTransactionInitialTimeout: 60000,
    });

    this.wsConnection = new Connection(process.env.SOLANA_WS_URL, {
      commitment: 'confirmed',
      wsEndpoint: process.env.SOLANA_WS_URL,
    });

    this.setupWebSocket();
  }

  static getInstance(): SolanaService {
    if (!SolanaService.instance) {
      SolanaService.instance = new SolanaService();
    }
    return SolanaService.instance;
  }

  private setupWebSocket(): void {
    this.wsConnection.onLogs(
      new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), // Token program ID
      (logs: TokenLogs) => {
        if (logs.err) {
          console.error('WebSocket error:', logs.err);
          return;
        }
        this.handleTokenLogs(logs);
      },
      'confirmed'
    );
  }

  private handleTokenLogs(logs: TokenLogs): void {
    try {
      // Process token logs and emit events
      console.log('Received token logs:', logs);
      // TODO: Implement token log processing logic
    } catch (error) {
      console.error('Error processing token logs:', error);
    }
  }

  async getTokenAccountInfo(tokenAddress: string): Promise<any> {
    try {
      return await withRateLimit(async () => {
        const publicKey = new PublicKey(tokenAddress);
        const accountInfo = await this.connection.getAccountInfo(publicKey);
        return accountInfo;
      });
    } catch (error) {
      console.error(`Error fetching token account info for ${tokenAddress}:`, error);
      throw error;
    }
  }

  async getTokenSupply(tokenAddress: string): Promise<number> {
    try {
      return await withRateLimit(async () => {
        const publicKey = new PublicKey(tokenAddress);
        const supply = await this.connection.getTokenSupply(publicKey);
        return Number(supply.value.amount);
      });
    } catch (error) {
      console.error(`Error fetching token supply for ${tokenAddress}:`, error);
      throw error;
    }
  }

  async getTokenLargestAccounts(tokenAddress: string): Promise<any[]> {
    try {
      return await withRateLimit(async () => {
        const publicKey = new PublicKey(tokenAddress);
        const accounts = await this.connection.getTokenLargestAccounts(publicKey);
        return accounts.value;
      });
    } catch (error) {
      console.error(`Error fetching token largest accounts for ${tokenAddress}:`, error);
      throw error;
    }
  }

  async getRecentBlockhash(): Promise<string> {
    try {
      return await withRateLimit(async () => {
        const { blockhash } = await this.connection.getLatestBlockhash();
        return blockhash;
      });
    } catch (error) {
      console.error('Error fetching recent blockhash:', error);
      throw error;
    }
  }

  async getSlot(): Promise<number> {
    try {
      return await withRateLimit(async () => {
        const slot = await this.connection.getSlot();
        return slot;
      });
    } catch (error) {
      console.error('Error fetching slot:', error);
      throw error;
    }
  }

  async getBlockTime(slot: number): Promise<number> {
    try {
      return await withRateLimit(async () => {
        const blockTime = await this.connection.getBlockTime(slot);
        if (blockTime === null) {
          throw new Error(`Block time not found for slot ${slot}`);
        }
        return blockTime;
      });
    } catch (error) {
      console.error(`Error fetching block time for slot ${slot}:`, error);
      throw error;
    }
  }
} 