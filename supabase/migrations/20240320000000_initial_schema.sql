-- Create users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  premium_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create signals table
CREATE TABLE signals (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('LOW_CAP', 'PUMP', 'VOLUME', 'LAUNCH')),
  strength DECIMAL NOT NULL,
  confidence DECIMAL NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  sources JSONB NOT NULL,
  analysis JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create user_signals table to track which users received which signals
CREATE TABLE user_signals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_id TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, signal_id)
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_signals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for signals
CREATE POLICY "Users can view signals they received" ON signals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_signals
      WHERE user_signals.signal_id = signals.id
      AND user_signals.user_id = auth.uid()
    )
  );

-- Create RLS policies for user_signals
CREATE POLICY "Users can view their own signal history" ON user_signals
  FOR SELECT USING (user_id = auth.uid());

-- Create indexes
CREATE INDEX idx_signals_token ON signals(token);
CREATE INDEX idx_signals_timestamp ON signals(timestamp);
CREATE INDEX idx_user_signals_user_id ON user_signals(user_id);
CREATE INDEX idx_user_signals_signal_id ON user_signals(signal_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 