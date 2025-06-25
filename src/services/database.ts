import { createClient } from '@supabase/supabase-js';
import { Database, User, Signal, Subscription, WalletTransaction } from '../types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'set' : 'not set');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export const db = {
  users: {
    async createOrUpdate(user: Omit<User, 'updatedAt'>): Promise<User> {
      const { data, error } = await supabase
        .from('users')
        .upsert({
          ...user,
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getById(id: string): Promise<User | null> {
      const { data, error } = await supabase
        .from('users')
        .select()
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },

    async getAll(): Promise<User[]> {
      const { data, error } = await supabase
        .from('users')
        .select();

      if (error) throw error;
      return data;
    },

    async getByTelegramId(telegramId: number) {
      const { data, error } = await supabase
        .from('users')
        .select()
        .eq('telegramId', telegramId)
        .single();

      if (error) throw error;
      return data;
    },

    async updateDailySignalCount(userId: string, count: number) {
      const { data, error } = await supabase
        .from('users')
        .update({ dailySignalCount: count, lastSignalDate: new Date() })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  signals: {
    async create(signal: Omit<Signal, 'id' | 'createdAt'>) {
      const { data, error } = await supabase
        .from('signals')
        .insert([signal])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getLatest(limit: number = 10) {
      const { data, error } = await supabase
        .from('signals')
        .select()
        .order('createdAt', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },

    async getUserSignalsToday(userId: string): Promise<Signal[]> {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('signals')
        .select()
        .eq('userId', userId)
        .gte('timestamp', today.toISOString());

      if (error) throw error;
      return data;
    }
  },

  subscriptions: {
    async create(subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert([subscription])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getByUserId(userId: string) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select()
        .eq('userId', userId)
        .single();

      if (error) throw error;
      return data;
    },

    async updateStatus(subscriptionId: string, status: string) {
      const { data, error } = await supabase
        .from('subscriptions')
        .update({ status })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  wallets: {
    async addWallet(userId: string, address: string) {
      const { data, error } = await supabase
        .from('wallets')
        .insert([{ userId, address }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getUsersByWallet(address: string) {
      const { data, error } = await supabase
        .from('wallets')
        .select(`
          userId,
          users (
            telegramId,
            isPremium
          )
        `)
        .eq('address', address);

      if (error) throw error;
      return data.map((item: any) => ({
        telegramId: item.users.telegramId,
        isPremium: item.users.isPremium
      }));
    },

    async removeWallet(userId: string, address: string) {
      const { error } = await supabase
        .from('wallets')
        .delete()
        .eq('userId', userId)
        .eq('address', address);

      if (error) throw error;
    }
  },

  transactions: {
    async create(transaction: Omit<WalletTransaction, 'id'>) {
      const { data, error } = await supabase
        .from('transactions')
        .insert([transaction])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getLatestByWallet(address: string, limit: number = 10) {
      const { data, error } = await supabase
        .from('transactions')
        .select()
        .eq('walletAddress', address)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    }
  },

  stripe: {
    async createCheckoutSession(userId: string): Promise<{ url: string }> {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { userId }
      });

      if (error) throw error;
      return data;
    }
  }
}; 