from telethon import TelegramClient, events
import re
import os
import json
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Telegram API credentials
API_ID = os.getenv('TELEGRAM_API_ID')
API_HASH = os.getenv('TELEGRAM_API_HASH')
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')
DEXSCREENER_API_URL = 'https://api.dexscreener.com/latest'

# Initialize Telegram client
client = TelegramClient('parser', API_ID, API_HASH)

# Signal patterns for low cap coins
SIGNAL_PATTERNS = [
    # Pump patterns
    r'(?i)(?:pump|moon|gem|launch)\s+(\w+)(?:\s+@\s+)?(\d*\.?\d*)',
    r'(?i)(?:buy|long)\s+(\w+)(?:\s+@\s+)?(\d*\.?\d*)',
    r'(?i)(?:sell|short)\s+(\w+)(?:\s+@\s+)?(\d*\.?\d*)',
    # Volume patterns
    r'(?i)(?:volume|vol)\s+(\w+)(?:\s+@\s+)?(\d*\.?\d*)',
    # Launch patterns
    r'(?i)(?:launch|fair|presale)\s+(\w+)(?:\s+@\s+)?(\d*\.?\d*)',
    # Whale patterns
    r'(?i)(?:whale|whales)\s+(?:buying|accumulating)\s+(\w+)',
]

# Keywords that indicate low market cap
LOW_CAP_KEYWORDS = [
    'lowcap', 'microcap', 'smallcap', 'gem', 'hidden gem',
    'undervalued', 'early', 'presale', 'fair launch', 'stealth'
]

def is_low_cap_message(text: str) -> bool:
    """Check if message is likely about a low market cap coin."""
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in LOW_CAP_KEYWORDS)

def get_token_info(symbol: str) -> dict:
    """Get token information from DexScreener."""
    try:
        response = requests.get(f'{DEXSCREENER_API_URL}/tokens/{symbol}')
        data = response.json()
        
        if 'pairs' in data and data['pairs']:
            pair = data['pairs'][0]
            return {
                'marketCap': pair.get('liquidity', {}).get('usd', 0),
                'volume24h': pair.get('volume', {}).get('h24', 0),
                'price': pair.get('priceUsd', 0),
                'priceChange24h': pair.get('priceChange', {}).get('h24', 0)
            }
    except Exception as e:
        print(f"Error fetching token info for {symbol}: {e}")
    
    return {
        'marketCap': 0,
        'volume24h': 0,
        'price': 0,
        'priceChange24h': 0
    }

def parse_signal(text: str) -> dict:
    """Parse signal from message text."""
    if not is_low_cap_message(text):
        return None

    for pattern in SIGNAL_PATTERNS:
        match = re.search(pattern, text)
        if match:
            token = match.group(1).upper()
            price = float(match.group(2)) if match.group(2) else None
            
            # Get token info from DexScreener
            token_info = get_token_info(token)
            
            # Only process if market cap is below $1M
            if token_info['marketCap'] > 1000000:
                return None
            
            # Determine signal type
            if 'buy' in pattern.lower() or 'long' in pattern.lower():
                signal_type = 'BUY'
            elif 'sell' in pattern.lower() or 'short' in pattern.lower():
                signal_type = 'SELL'
            else:
                signal_type = 'HOLD'

            return {
                'tokenSymbol': token,
                'tokenName': token,
                'type': signal_type,
                'price': price or token_info['price'],
                'source': 'TELEGRAM',
                'isPremium': True,
                'analysis': (
                    f"Market Cap: ${token_info['marketCap']:,.2f} | "
                    f"24h Volume: ${token_info['volume24h']:,.2f} | "
                    f"Price Change: {token_info['priceChange24h']:.2f}%"
                ),
                'createdAt': datetime.utcnow().isoformat()
            }
    return None

async def save_signal(signal: dict):
    """Save signal to Supabase."""
    headers = {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json'
    }
    
    response = requests.post(
        f'{SUPABASE_URL}/rest/v1/signals',
        headers=headers,
        json=signal
    )
    
    if response.status_code != 201:
        print(f"Error saving signal: {response.text}")

@client.on(events.NewMessage(chats=[
    'your_channel_1',
    'your_channel_2',
    # Add more channels here
]))
async def handler(event):
    """Handle new messages from monitored channels."""
    try:
        # Parse signal from message
        signal = parse_signal(event.message.text)
        
        if signal:
            # Save signal to database
            await save_signal(signal)
            print(f"Signal saved: {signal}")
            
    except Exception as e:
        print(f"Error processing message: {e}")

async def main():
    """Main function to start the parser."""
    print("Starting signal parser...")
    await client.start()
    print("Parser is running!")
    await client.run_until_disconnected()

if __name__ == '__main__':
    import asyncio
    asyncio.run(main()) 