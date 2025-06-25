#!/usr/bin/env node

const { UserManager } = require('../dist/services/userManager');

async function upgradeUser() {
  const telegramId = process.argv[2];

  if (!telegramId) {
    console.log('❌ Usage: node scripts/upgrade-user.js <telegram_id>');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/upgrade-user.js 123456789');
    process.exit(1);
  }

  try {
    const userManager = UserManager.getInstance();
    
    console.log(`⭐ Upgrading user to premium...`);
    console.log(`   • Telegram ID: ${telegramId}`);
    console.log('');

    await userManager.upgradeToPremium(parseInt(telegramId));
    
    console.log('✅ User upgraded to premium successfully!');
    console.log('   • Premium features activated');
    console.log('   • Daily limit increased to 100 signals');
    console.log('   • Premium expires in 30 days');
    console.log('');

    // Show updated stats
    const stats = await userManager.getTestGroupStats();
    console.log('📊 Updated Group Stats:');
    console.log(`   • Total Users: ${stats.totalUsers}/20`);
    console.log(`   • Premium Users: ${stats.premiumUsers}`);

  } catch (error) {
    console.error('❌ Error upgrading user:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  upgradeUser().catch(console.error);
} 