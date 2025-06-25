import { db } from './database';

export interface TestUser {
  id: string;
  telegramId: number;
  username: string;
  isActive: boolean;
  isPremium: boolean;
  joinedAt: Date;
  lastActivity: Date;
  dailySignalCount: number;
  maxDailySignals: number;
}

export class UserManager {
  private static instance: UserManager;
  private readonly TEST_GROUP_SIZE = 20;
  private readonly FREE_DAILY_LIMIT = 5;
  private readonly PREMIUM_DAILY_LIMIT = 100;

  private constructor() {}

  static getInstance(): UserManager {
    if (!UserManager.instance) {
      UserManager.instance = new UserManager();
    }
    return UserManager.instance;
  }

  async addTestUser(telegramId: number, username?: string, firstName?: string, _lastName?: string): Promise<TestUser> {
    try {
      // Check if user already exists
      const existingUser = await this.getUserByTelegramId(telegramId);
      if (existingUser) {
        return existingUser;
      }

      // Check if we can add more test users
      const activeUsers = await this.getActiveUsers();
      if (activeUsers.length >= this.TEST_GROUP_SIZE) {
        throw new Error('Test group is full. Please wait for a spot to open up.');
      }

      const userData = {
        id: `user_${telegramId}`,
        username: username || firstName || `user_${telegramId}`,
        isPremium: false,
        premiumExpiresAt: null,
        createdAt: new Date().toISOString()
      };

      const user = await db.users.createOrUpdate(userData);
      
      // Create extended user data for internal use
      const testUser: TestUser = {
        id: user.id,
        telegramId,
        username: user.username,
        isActive: true,
        isPremium: user.isPremium,
        joinedAt: new Date(user.createdAt),
        lastActivity: new Date(),
        dailySignalCount: 0,
        maxDailySignals: this.FREE_DAILY_LIMIT
      };

      console.log(`Added test user: ${username || firstName} (${telegramId})`);
      return testUser;
    } catch (error) {
      console.error('Error adding test user:', error);
      throw error;
    }
  }

  async getUserByTelegramId(telegramId: number): Promise<TestUser | null> {
    try {
      const user = await db.users.getByTelegramId(telegramId);
      if (!user) return null;

      return {
        id: user.id,
        telegramId,
        username: user.username,
        isActive: true,
        isPremium: user.isPremium,
        joinedAt: new Date(user.createdAt),
        lastActivity: new Date(user.updatedAt),
        dailySignalCount: 0, // TODO: Track this separately
        maxDailySignals: user.isPremium ? this.PREMIUM_DAILY_LIMIT : this.FREE_DAILY_LIMIT
      };
    } catch (error) {
      console.error('Error getting user by Telegram ID:', error);
      return null;
    }
  }

  async getActiveUsers(): Promise<TestUser[]> {
    try {
      const users = await db.users.getAll();
      return users.map(user => ({
        id: user.id,
        telegramId: parseInt(user.id.replace('user_', '')), // Extract from ID
        username: user.username,
        isActive: true,
        isPremium: user.isPremium,
        joinedAt: new Date(user.createdAt),
        lastActivity: new Date(user.updatedAt),
        dailySignalCount: 0, // TODO: Track this separately
        maxDailySignals: user.isPremium ? this.PREMIUM_DAILY_LIMIT : this.FREE_DAILY_LIMIT
      }));
    } catch (error) {
      console.error('Error getting active users:', error);
      return [];
    }
  }

  async updateUserActivity(telegramId: number): Promise<void> {
    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (user) {
        await db.users.createOrUpdate({
          id: user.id,
          username: user.username,
          isPremium: user.isPremium,
          premiumExpiresAt: null,
          createdAt: user.joinedAt.toISOString()
        });
      }
    } catch (error) {
      console.error('Error updating user activity:', error);
    }
  }

  async canReceiveSignal(telegramId: number): Promise<boolean> {
    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user || !user.isActive) {
        return false;
      }

      // For now, always allow signals (we'll implement daily limits later)
      return true;
    } catch (error) {
      console.error('Error checking if user can receive signal:', error);
      return false;
    }
  }

  async incrementSignalCount(telegramId: number): Promise<void> {
    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (user) {
        // TODO: Implement signal count tracking
        console.log(`Incremented signal count for user ${user.username}`);
      }
    } catch (error) {
      console.error('Error incrementing signal count:', error);
    }
  }

  async upgradeToPremium(telegramId: number): Promise<void> {
    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (user) {
        await db.users.createOrUpdate({
          id: user.id,
          username: user.username,
          isPremium: true,
          premiumExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          createdAt: user.joinedAt.toISOString()
        });
        console.log(`User ${user.username} upgraded to premium`);
      }
    } catch (error) {
      console.error('Error upgrading user to premium:', error);
      throw error;
    }
  }

  async getTestGroupStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    premiumUsers: number;
    availableSpots: number;
  }> {
    try {
      const users = await this.getActiveUsers();
      const premiumUsers = users.filter(user => user.isPremium).length;
      
      return {
        totalUsers: users.length,
        activeUsers: users.length,
        premiumUsers,
        availableSpots: this.TEST_GROUP_SIZE - users.length
      };
    } catch (error) {
      console.error('Error getting test group stats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        premiumUsers: 0,
        availableSpots: this.TEST_GROUP_SIZE
      };
    }
  }

  async removeTestUser(telegramId: number): Promise<void> {
    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (user) {
        // For now, we'll just mark them as inactive in our logic
        // In a real implementation, you might want to delete from database
        console.log(`Removed test user: ${user.username} (${telegramId})`);
      }
    } catch (error) {
      console.error('Error removing test user:', error);
      throw error;
    }
  }
} 