#!/usr/bin/env node

const { UserManager } = require('../dist/services/userManager');

async function addTestUser() {
  const telegramId = process.argv[2];
  const username = process.argv[3] || `user_${telegramId}`;
  const firstName = process.argv[4] || username;

  if (!telegramId) {
    console.log('❌ Usage: node scripts/add-test-user.js <telegram_id> [username] [first_name]');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/add-test-user.js 123456789 trader1');
    console.log('  node scripts/add-test-user.js 987654321 whale_trader John');
    process.exit(1);
  }

  try {
    const userManager = UserManager.getInstance();
    
    console.log(`👤 Adding test user...`);
    console.log(`   • Telegram ID: ${telegramId}`);
    console.log(`   • Username: ${username}`);
    console.log(`   • First Name: ${firstName}`);
    console.log('');

    const user = await userManager.addTestUser(parseInt(telegramId), username, firstName);
    
    console.log('✅ User added successfully!');
    console.log(`   • ID: ${user.id}`);
    console.log(`   • Username: ${user.username}`);
    console.log(`   • Premium: ${user.isPremium ? 'Yes' : 'No'}`);
    console.log(`   • Daily Limit: ${user.maxDailySignals} signals`);
    console.log('');

    // Show updated stats
    const stats = await userManager.getTestGroupStats();
    console.log('📊 Updated Group Stats:');
    console.log(`   • Total Users: ${stats.totalUsers}/20`);
    console.log(`   • Available Spots: ${stats.availableSpots}`);
    console.log(`   • Premium Users: ${stats.premiumUsers}`);

  } catch (error) {
    console.error('❌ Error adding test user:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  addTestUser().catch(console.error);
} 