#!/usr/bin/env node

const { UserManager } = require('../dist/services/userManager');

async function listUsers() {
  try {
    const userManager = UserManager.getInstance();
    const users = await userManager.getActiveUsers();
    const stats = await userManager.getTestGroupStats();

    console.log('👥 Prix Signals Test Group Users');
    console.log('=' .repeat(50));
    console.log(`Total Users: ${stats.totalUsers}/20`);
    console.log(`Premium Users: ${stats.premiumUsers}`);
    console.log(`Available Spots: ${stats.availableSpots}`);
    console.log('');

    if (users.length === 0) {
      console.log('No users found. Add users with: npm run user:add <telegram_id> <username>');
      return;
    }

    console.log('📋 User List:');
    users.forEach((user, index) => {
      const status = user.isPremium ? '⭐' : '👤';
      const joined = user.joinedAt.toLocaleDateString();
      const lastActivity = user.lastActivity.toLocaleDateString();
      
      console.log(`${index + 1}. ${status} ${user.username}`);
      console.log(`   • ID: ${user.id}`);
      console.log(`   • Telegram: ${user.telegramId}`);
      console.log(`   • Premium: ${user.isPremium ? 'Yes' : 'No'}`);
      console.log(`   • Daily Limit: ${user.maxDailySignals} signals`);
      console.log(`   • Joined: ${joined}`);
      console.log(`   • Last Activity: ${lastActivity}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error listing users:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  listUsers().catch(console.error);
} 