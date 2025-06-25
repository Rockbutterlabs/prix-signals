# Prix Signals 🤖

A premium crypto trading signals bot with Solana wallet monitoring and real-time alerts.

## Features

### Freemium Tier
- Daily limit on signals (5 per day)
- Delayed signal alerts (15-30 min delay)
- Public signal sources only
- Simple summary (token name, buy/sell alert, chart link)

### Premium Tier
- Unlimited alerts
- Real-time delivery
- AI-enhanced signal filtering
- Private alpha signals
- Priority Telegram support
- Portfolio/watchlist tracking
- Solana wallet monitoring

## Tech Stack

- **Bot Framework**: TypeScript + grammY
- **Database**: Supabase
- **Authentication**: Telegram ID + Stripe Webhook
- **Hosting**: Railway/Render/Vercel
- **Monetization**: Stripe
- **Blockchain**: Solana Web3.js

## Prerequisites

- Node.js 18+
- Python 3.8+
- Telegram Bot Token
- Supabase Account
- Stripe Account
- Solana RPC URL

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_API_ID=your_telegram_api_id
TELEGRAM_API_HASH=your_telegram_api_hash

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Bot Configuration
FREEMIUM_DAILY_LIMIT=5
SIGNAL_DELAY_MINUTES=15

# Signal Channels (comma-separated)
SIGNAL_CHANNELS=channel1,channel2,channel3
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/prix-signals.git
cd prix-signals
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
pip install telethon python-dotenv requests
```

4. Build the project:
```bash
npm run build
```

5. Start the bot:
```bash
npm start
```

## Development

Run the bot in development mode with hot reload:
```bash
npm run dev
```

Run the signal parser:
```bash
npm run parser
```

## Database Schema

### Users Table
- id: string (primary key)
- telegramId: number (unique)
- username: string
- firstName: string
- lastName: string
- isPremium: boolean
- dailySignalCount: number
- lastSignalDate: timestamp
- createdAt: timestamp
- updatedAt: timestamp

### Signals Table
- id: string (primary key)
- source: enum (TWITTER, TRADINGVIEW, TELEGRAM, API)
- tokenSymbol: string
- tokenName: string
- type: enum (BUY, SELL, HOLD)
- price: number
- targetPrice: number
- stopLoss: number
- chartUrl: string
- analysis: string
- createdAt: timestamp
- isPremium: boolean

### Wallets Table
- id: string (primary key)
- userId: string (foreign key)
- address: string
- createdAt: timestamp
- updatedAt: timestamp

### Transactions Table
- id: string (primary key)
- signature: string
- walletAddress: string
- timestamp: number
- amount: number
- tokenSymbol: string
- type: enum (buy, sell)
- createdAt: timestamp

### Subscriptions Table
- id: string (primary key)
- userId: string (foreign key)
- stripeCustomerId: string
- stripeSubscriptionId: string
- status: enum (ACTIVE, CANCELED, PAST_DUE, UNPAID)
- currentPeriodEnd: timestamp
- createdAt: timestamp
- updatedAt: timestamp

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 