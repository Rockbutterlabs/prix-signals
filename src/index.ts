import dotenv from 'dotenv';
dotenv.config();

import { BotService } from './services/bot';

async function main() {
  try {
    const bot = new BotService();
    await bot.start();

    // Handle graceful shutdown
    process.once('SIGINT', () => bot.stop());
    process.once('SIGTERM', () => bot.stop());
  } catch (error) {
    console.error('Error starting bot:', error);
    process.exit(1);
  }
}

main(); 