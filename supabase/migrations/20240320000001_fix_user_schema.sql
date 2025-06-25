-- Fix users table schema to match code expectations
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT,
ADD COLUMN IF NOT EXISTS daily_signal_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_signal_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free';

-- Rename columns to match code expectations
ALTER TABLE users RENAME COLUMN is_premium TO "isPremium";
ALTER TABLE users RENAME COLUMN premium_expires_at TO "premiumExpiresAt";
ALTER TABLE users RENAME COLUMN created_at TO "createdAt";
ALTER TABLE users RENAME COLUMN updated_at TO "updatedAt";

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "stripeCustomerId" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'CANCELED', 'PAST_DUE', 'UNPAID')),
  "currentPeriodEnd" TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  signature TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  amount DECIMAL NOT NULL,
  "tokenSymbol" TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions("userId");
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets("userId");
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_address ON transactions("walletAddress");

-- Update trigger for renamed column
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 