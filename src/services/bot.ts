import { Telegraf, Markup, Context } from 'telegraf';
import { db } from './database';
import { SignalType } from '../types';
import { SignalAggregator } from './signal-aggregator';
import { StripeService } from './stripe';
import { createInvoice, getInvoiceStatus } from './cryptobot';
import { UserManager } from './userManager';

// Tier definitions
const TIERS = [
  { key: 'starter', name: 'Starter', sol: 0.5, usd: 73, features: 'Delayed alerts • 1 wallet' },
  { key: 'pro', name: 'Pro', sol: 1, usd: 146, features: 'Instant alerts • 3 wallets • VIP group' },
  { key: 'elite', name: 'Elite Racer', sol: 3, usd: 438, features: 'Real-time alerts • Unlimited wallets • Whale watch • Strategy signals' }
];

// Admin user IDs
const ADMIN_IDS = ['1413387381'];

export class BotService {
  private signalAggregator: SignalAggregator;
  private bot: Telegraf;
  private userManager: UserManager;

  constructor() {
    this.signalAggregator = new SignalAggregator();
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
    this.userManager = UserManager.getInstance();
    this.setupCommands();
  }

  private setupCommands() {
    // Welcome message with interactive buttons
    this.bot.command('start', async (ctx) => {
      if (!ctx.from) return;
      
      const welcomeMessage = 
        '🚀 Welcome to <b>Prix Signals</b>!\n\n' +
        'Your premium crypto signal companion for low cap gems.\n\n' +
        '🎯 <b>What we offer:</b>\n' +
        '• Real-time low cap signals\n' +
        '• Volume and whale alerts\n' +
        '• Premium community access\n' +
        '• Advanced wallet monitoring\n\n' +
        '💎 <b>Premium Features:</b>\n' +
        '• Unlimited signals\n' +
        '• Priority delivery\n' +
        '• Advanced analytics\n' +
        '• Exclusive community\n\n' +
        'Use the buttons below to get started:';

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 View Signals', 'view_signals'),
          Markup.button.callback('💎 Go Premium', 'go_premium')
        ],
        [
          Markup.button.callback('📈 Market Overview', 'market_overview'),
          Markup.button.callback('❓ Help', 'help')
        ]
      ]);

      await ctx.replyWithHTML(welcomeMessage, keyboard);
    });

    // Signals command with interactive filters
    this.bot.command('signals', async (ctx) => {
      if (!ctx.from) return;
      
      const signals = await this.signalAggregator.getLatestSignals();
      
      if (signals.length === 0) {
        await ctx.reply(
          '🔍 No signals available at the moment.\n' +
          'Check back soon for new opportunities!'
        );
        return;
      }

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('🆕 Latest', 'filter_latest'),
          Markup.button.callback('🔥 Hot', 'filter_hot')
        ],
        [
          Markup.button.callback('💎 Premium Only', 'filter_premium'),
          Markup.button.callback('📊 All Signals', 'filter_all')
        ]
      ]);

      await ctx.reply(
        '📊 <b>Available Signals</b>\n\n' +
        'Select a filter to view signals:',
        { parse_mode: 'HTML', ...keyboard }
      );
    });

    // Premium command with payment options
    this.bot.command('premium', async (ctx) => {
      if (!ctx.from) return;
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('💳 Pay with Card', 'pay_card'),
          Markup.button.callback('🪙 Pay with SOL', 'pay_sol')
        ]
      ]);
      await ctx.reply(
        'Upgrade to <b>Prix Signals Premium</b>\n\nChoose your payment method:',
        { parse_mode: 'HTML', ...keyboard }
      );
    });

    // Handle payment method selection
    this.bot.action('pay_sol', async (ctx) => {
      await ctx.answerCbQuery();
      // Generate CryptoBot invoice for SOL (fixed $20)
      const amountUSD = 20;
      // CryptoBot expects asset as 'SOL', amount in SOL (convert from USD if needed)
      // For simplicity, let user pay $20 worth of SOL (CryptoBot will handle conversion)
      const invoice = await createInvoice({
        asset: 'SOL',
        amount: amountUSD,
        description: 'Prix Signals Premium Subscription',
        allow_comments: false,
        allow_anonymous: false
      });
      await ctx.reply(
        '🪙 <b>Pay with SOL</b>\n\nClick the button below to pay for your premium subscription:',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Pay with CryptoBot', url: invoice.pay_url }
              ]
            ]
          }
        }
      );
      // Optionally: Start polling for payment confirmation and upgrade user on success
    });

    // Help command with categorized information
    this.bot.command('help', async (ctx) => {
      const helpMessage = 
        '📚 <b>Prix Signals Help</b>\n\n' +
        'Here\'s how to use the bot:\n\n' +
        '🔹 <b>Basic Commands</b>\n' +
        '/start - Start the bot\n' +
        '/signals - View available signals\n' +
        '/premium - Manage premium subscription\n' +
        '/help - Show this help message\n\n' +
        '🔹 <b>Signal Types</b>\n' +
        '• Low Cap Gems\n' +
        '• Volume Alerts\n' +
        '• Whale Movements\n' +
        '• Launch Alerts\n\n' +
        '🔹 <b>Premium Features</b>\n' +
        '• Unlimited signals\n' +
        '• Priority delivery\n' +
        '• Advanced analytics\n' +
        '• Exclusive community\n\n' +
        'Need more help? Contact @support';

      await ctx.replyWithHTML(helpMessage);
    });

    // Handle callback queries
    this.bot.on('callback_query', async (ctx) => {
      const callbackQuery = ctx.callbackQuery;
      if (!callbackQuery || !('data' in callbackQuery)) return;
      
      const action = callbackQuery.data;

      switch (action) {
        case 'view_signals':
          await ctx.answerCbQuery();
          await this.handleViewSignals(ctx);
          break;

        case 'go_premium':
          await ctx.answerCbQuery();
          await this.handleGoPremium(ctx);
          break;

        case 'market_overview':
          await ctx.answerCbQuery();
          await this.handleMarketOverview(ctx);
          break;

        case 'help':
          await ctx.answerCbQuery();
          await this.handleHelp(ctx);
          break;

        case 'filter_latest':
        case 'filter_hot':
        case 'filter_premium':
        case 'filter_all':
          await ctx.answerCbQuery();
          await this.handleSignalFilter(ctx, action);
          break;

        case 'subscribe_premium':
          await ctx.answerCbQuery();
          await this.handleSubscribePremium(ctx);
          break;
      }
    });

    // Helper: Poll for payment confirmation
    async function pollForPayment(invoiceId: number, userId: string, tierKey: string, ctx: any) {
      let attempts = 0;
      const maxAttempts = 30; // e.g., poll for up to 5 minutes
      const delay = 10000; // 10 seconds
      while (attempts < maxAttempts) {
        const invoice = await getInvoiceStatus(invoiceId);
        if (invoice && invoice.status === 'paid') {
          // Update user in Supabase
          const expires = new Date();
          expires.setMonth(expires.getMonth() + 1); // 1 month premium
          await db.users.createOrUpdate({
            id: userId,
            isPremium: true,
            premiumExpiresAt: expires.toISOString(),
            tier: tierKey,
            username: ctx.from.username || '',
            createdAt: new Date().toISOString()
          });
          await ctx.reply(`✅ Payment received! You are now a <b>${tierKey.toUpperCase()}</b> member.`, { parse_mode: 'HTML' });
          return;
        }
        await new Promise(res => setTimeout(res, delay));
        attempts++;
      }
      await ctx.reply('❌ Payment not detected in time. Please try again or contact support.');
    }

    // /renew command
    this.bot.command('renew', async (ctx) => {
      if (!ctx.from) return;
      const user = await db.users.getById(ctx.from.id.toString());
      const tierKey = (user?.tier as string | undefined);
      if (!tierKey) {
        await ctx.reply('You do not have an active subscription. Use /tier to upgrade.');
        return;
      }
      const tier = TIERS.find((t: { key: string }) => t.key === tierKey);
      if (!tier) {
        await ctx.reply('Unknown tier. Please contact support.');
        return;
      }
      const invoice = await createInvoice({
        asset: 'SOL',
        amount: tier.sol,
        description: `Prix Signals ${tier.name} Renewal`,
        allow_comments: false,
        allow_anonymous: false
      });
      await ctx.reply(
        `🔁 <b>Renew ${tier.name}</b>\n\nClick below to renew your plan (${tier.sol} SOL):`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Renew with CryptoBot', url: invoice.pay_url }]
            ]
          }
        }
      );
      pollForPayment(invoice.invoice_id, ctx.from.id.toString(), tierKey, ctx);
    });

    // Example admin command: /stats
    this.bot.command('stats', async (ctx) => {
      if (!ADMIN_IDS.includes(ctx.from?.id.toString() || '')) return;
      const users = await db.users.getAll();
      const total = users.length;
      const premium = users.filter(u => u.isPremium).length;
      await ctx.reply(
        `📊 <b>Bot Stats</b>\n\n` +
        `👥 Total users: <b>${total}</b>\n` +
        `💎 Premium users: <b>${premium}</b>\n`,
        { parse_mode: 'HTML' }
      );
    });

    // Start command - adds user to test group
    this.bot.command('start', async (ctx) => {
      try {
        const telegramId = ctx.from?.id;
        const username = ctx.from?.username;
        const firstName = ctx.from?.first_name;
        const lastName = ctx.from?.last_name;

        if (!telegramId) {
          await ctx.reply('❌ Unable to identify your Telegram ID.');
          return;
        }

        const user = await this.userManager.addTestUser(telegramId, username, firstName, lastName);
        
        const welcomeMessage = `
🎉 Welcome to the Premium Signals Test Group!

👤 **User Info:**
• Username: @${user.username}
• Status: ${user.isPremium ? 'Premium' : 'Free'}
• Daily Limit: ${user.maxDailySignals} signals

📊 **Test Group Stats:**
• Total Users: ${(await this.userManager.getTestGroupStats()).totalUsers}/10
• Available Spots: ${(await this.userManager.getTestGroupStats()).availableSpots}

🔧 **Available Commands:**
/start - Join the test group
/status - Check your status
/stats - View test group statistics
/upgrade - Upgrade to premium
/help - Show all commands

🚀 You'll receive crypto signals automatically!
        `;

        await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error in start command:', error);
        if (error instanceof Error && error.message.includes('full')) {
          await ctx.reply('❌ Test group is currently full. Please try again later.');
        } else {
          await ctx.reply('❌ An error occurred. Please try again.');
        }
      }
    });

    // Status command
    this.bot.command('status', async (ctx) => {
      try {
        const telegramId = ctx.from?.id;
        if (!telegramId) {
          await ctx.reply('❌ Unable to identify your Telegram ID.');
          return;
        }

        const user = await this.userManager.getUserByTelegramId(telegramId);
        if (!user) {
          await ctx.reply('❌ You are not registered. Use /start to join the test group.');
          return;
        }

        const statusMessage = `
👤 **Your Status:**

• Username: @${user.username}
• Member Since: ${user.joinedAt.toLocaleDateString()}
• Status: ${user.isActive ? 'Active' : 'Inactive'}
• Tier: ${user.isPremium ? 'Premium' : 'Free'}
• Daily Signal Limit: ${user.maxDailySignals}
• Signals Received Today: ${user.dailySignalCount}

${user.isPremium ? '🌟 You have premium access!' : '💡 Upgrade to premium for more signals!'}
        `;

        await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error in status command:', error);
        await ctx.reply('❌ An error occurred. Please try again.');
      }
    });

    // Stats command
    this.bot.command('stats', async (ctx) => {
      try {
        const stats = await this.userManager.getTestGroupStats();
        
        const statsMessage = `
📊 **Test Group Statistics:**

• Total Users: ${stats.totalUsers}/10
• Active Users: ${stats.activeUsers}
• Premium Users: ${stats.premiumUsers}
• Available Spots: ${stats.availableSpots}

${stats.availableSpots > 0 ? '✅ Spots available!' : '❌ Group is full'}
        `;

        await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error in stats command:', error);
        await ctx.reply('❌ An error occurred. Please try again.');
      }
    });

    // Upgrade command
    this.bot.command('upgrade', async (ctx) => {
      try {
        const telegramId = ctx.from?.id;
        if (!telegramId) {
          await ctx.reply('❌ Unable to identify your Telegram ID.');
          return;
        }

        const user = await this.userManager.getUserByTelegramId(telegramId);
        if (!user) {
          await ctx.reply('❌ You are not registered. Use /start to join the test group.');
          return;
        }

        if (user.isPremium) {
          await ctx.reply('🌟 You are already a premium user!');
          return;
        }

        // For testing, we'll upgrade them directly
        await this.userManager.upgradeToPremium(telegramId);
        
        const upgradeMessage = `
🎉 **Upgraded to Premium!**

• Daily Signal Limit: ${this.userManager['PREMIUM_DAILY_LIMIT']}
• Priority Access: ✅
• Premium Features: ✅

You now have access to all premium features!
        `;

        await ctx.reply(upgradeMessage, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error in upgrade command:', error);
        await ctx.reply('❌ An error occurred. Please try again.');
      }
    });

    // Help command
    this.bot.command('help', async (ctx) => {
      const helpMessage = `
🤖 **Premium Signals Bot - Test Group**

**Available Commands:**

/start - Join the test group
/status - Check your status and limits
/stats - View test group statistics
/upgrade - Upgrade to premium (test mode)
/help - Show this help message

**Features:**
• Real-time crypto signals
• Low-cap coin alerts
• Premium user benefits
• Daily signal limits

**Test Group Info:**
• Limited to 10 users
• Free tier: 3 signals/day
• Premium tier: 50 signals/day

For support, contact the admin.
      `;

      await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });

    // Handle unknown commands
    this.bot.on('text', async (ctx) => {
      if (!ctx.message.text.startsWith('/')) {
        await ctx.reply('Use /help to see available commands.');
      }
    });
  }

  private async handleViewSignals(ctx: Context) {
    const signals = await this.signalAggregator.getLatestSignals();
    
    if (signals.length === 0) {
      await ctx.reply(
        '🔍 No signals available at the moment.\n' +
        'Check back soon for new opportunities!'
      );
      return;
    }

    for (const signal of signals.slice(0, 5)) {
      const message = this.formatSignalMessage(signal);
      await ctx.replyWithHTML(message);
    }
  }

  private async handleGoPremium(ctx: Context) {
    if (!ctx.from) return;
    
    const user = await db.users.getById(ctx.from.id.toString());

    if (user?.isPremium) {
      await ctx.reply(
        '💎 You are already a premium user!\n' +
        'Enjoy your exclusive features.'
      );
      return;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💎 Subscribe Now', 'subscribe_premium')]
    ]);

    await ctx.reply(
      '💎 <b>Upgrade to Premium</b>\n\n' +
      'Get unlimited access to:\n' +
      '• All low cap signals\n' +
      '• Priority delivery\n' +
      '• Advanced analytics\n' +
      '• Exclusive community\n' +
      '• Wallet monitoring\n\n' +
      'Only $9.99/month',
      { parse_mode: 'HTML', ...keyboard }
    );
  }

  private async handleMarketOverview(ctx: Context) {
    const overview = await this.signalAggregator.getMarketOverview();
    
    await ctx.replyWithHTML(
      '📈 <b>Market Overview</b>\n\n' +
      '🔥 <b>Hot Signals</b>\n' +
      overview.hotSignals.map((signal: { symbol: string; priceChange: number }) => `• ${signal.symbol}: ${signal.priceChange}%`).join('\n') + '\n\n' +
      '📊 <b>Volume Leaders</b>\n' +
      overview.volumeLeaders.map((signal: { symbol: string; volume: number }) => `• ${signal.symbol}: $${signal.volume}`).join('\n') + '\n\n' +
      '💎 <b>Premium Picks</b>\n' +
      overview.premiumPicks.map((signal: { symbol: string; reason: string }) => `• ${signal.symbol}: ${signal.reason}`).join('\n')
    );
  }

  private async handleHelp(ctx: Context) {
    const helpMessage = 
      '📚 <b>Prix Signals Help</b>\n\n' +
      'Here\'s how to use the bot:\n\n' +
      '🔹 <b>Basic Commands</b>\n' +
      '/start - Start the bot\n' +
      '/signals - View available signals\n' +
      '/premium - Manage premium subscription\n' +
      '/help - Show this help message\n\n' +
      '🔹 <b>Signal Types</b>\n' +
      '• Low Cap Gems\n' +
      '• Volume Alerts\n' +
      '• Whale Movements\n' +
      '• Launch Alerts\n\n' +
      '🔹 <b>Premium Features</b>\n' +
      '• Unlimited signals\n' +
      '• Priority delivery\n' +
      '• Advanced analytics\n' +
      '• Exclusive community\n\n' +
      'Need more help? Contact @support';

    await ctx.replyWithHTML(helpMessage);
  }

  private async handleSignalFilter(ctx: Context, filter: string) {
    const signals = await this.signalAggregator.getLatestSignals();
    let filteredSignals = signals;

    switch (filter) {
      case 'filter_latest':
        filteredSignals = signals.slice(0, 5);
        break;
      case 'filter_hot':
        filteredSignals = signals.filter(s => s.priceChange > 10);
        break;
      case 'filter_premium':
        filteredSignals = signals.filter(s => s.isPremium);
        break;
      case 'filter_all':
        filteredSignals = signals;
        break;
    }

    if (filteredSignals.length === 0) {
      await ctx.reply(
        '🔍 No signals match your filter.\n' +
        'Try a different filter or check back later!'
      );
      return;
    }

    for (const signal of filteredSignals) {
      const message = this.formatSignalMessage(signal);
      await ctx.replyWithHTML(message);
    }
  }

  private async handleSubscribePremium(ctx: Context) {
    if (!ctx.from) return;
    
    const user = await db.users.getById(ctx.from.id.toString());

    if (user?.isPremium) {
      await ctx.reply(
        '💎 You are already a premium user!\n' +
        'Enjoy your exclusive features.'
      );
      return;
    }

    const stripeService = new StripeService();
    const { url } = await stripeService.createCheckoutSession(ctx.from.id.toString());

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('💎 Subscribe Now', url)]
    ]);

    await ctx.reply(
      '💎 <b>Upgrade to Premium</b>\n\n' +
      'Click the button below to subscribe:',
      { parse_mode: 'HTML', ...keyboard }
    );
  }

  private formatSignalMessage(signal: SignalType): string {
    const emoji = signal.isPremium ? '💎' : '📊';
    const premiumTag = signal.isPremium ? ' [PREMIUM]' : '';
    
    // Fact-based, sectioned message for premium users
    if (signal.isPremium) {
      let message = `${emoji} <b>${signal.symbol}${premiumTag}</b>\n`;
      message += '\n<b>Analyze</b>\n';
      if (signal.age) message += `├ Age: ${signal.age}\n`;
      message += `├ MCap: $${signal.marketCap.toLocaleString()}\n`;
      message += `├ Volume: $${signal.volume.toLocaleString()}\n`;
      message += `├ Price: $${signal.price}\n`;
      message += `├ Change: ${signal.priceChange}%\n`;
      if (signal.holders !== undefined) message += `├ Holders: ${signal.holders}\n`;
      message += `├ Risk: ${signal.riskLevel}\n`;
      if (signal.buyVolume30m !== undefined) message += `├ <span style=\"color:green\">Buy Vol (30m): $${signal.buyVolume30m.toLocaleString()}</span>\n`;
      if (signal.sellVolume30m !== undefined) message += `├ <span style=\"color:red\">Sell Vol (30m): $${signal.sellVolume30m.toLocaleString()}</span>\n`;
      message += `└ Time: ${new Date(signal.timestamp).toLocaleString()}\n`;
      
      // Socials section
      if (signal.socials && (signal.socials.twitter || signal.socials.telegram || signal.socials.website || signal.chartUrl || signal.bubbleMapUrl || signal.percentBundled !== undefined)) {
        message += '\n<b>Socials</b>\n';
        if (signal.socials.twitter) message += `• <a href="${signal.socials.twitter}">Twitter</a>\n`;
        if (signal.socials.telegram) message += `• <a href="${signal.socials.telegram}">Telegram</a>\n`;
        if (signal.socials.website) message += `• <a href="${signal.socials.website}">Website</a>\n`;
        if (signal.chartUrl) message += `• <a href="${signal.chartUrl}">Chart</a>\n`;
        if (signal.bubbleMapUrl) message += `• <a href="${signal.bubbleMapUrl}">Bubble Maps</a>\n`;
        if (signal.percentBundled !== undefined) message += `• Bundled: ${signal.percentBundled}%\n`;
      }
      
      return message;
    }
    // For free users, keep a simple summary
    return `${emoji} <b>${signal.symbol}</b>\n\n` +
      `💰 Price: $${signal.price}\n` +
      `📈 Change: ${signal.priceChange}%\n` +
      `📊 Volume: $${signal.volume}\n` +
      `💎 Market Cap: $${signal.marketCap}\n` +
      `⏰ <b>Time:</b> ${new Date(signal.timestamp).toLocaleString()}`;
  }

  async start() {
    console.log('Starting Telegram bot...');
    try {
      await this.bot.launch();
      console.log('Telegram bot is running!');
    } catch (error) {
      console.error('Error starting Telegram bot:', error);
      throw error;
    }
  }

  async stop() {
    console.log('Stopping Telegram bot...');
    await this.bot.stop();
    console.log('Telegram bot stopped.');
  }

  // Public method to send messages to users
  async sendMessage(userId: string, message: string) {
    await this.bot.telegram.sendMessage(userId, message);
  }
} 