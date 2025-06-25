import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { BotService } from './services/bot';
import stripeWebhook from './webhooks/stripe';

const app = express();

// Parse JSON bodies for all routes except Stripe webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Mount Stripe webhook routes
app.use('/', stripeWebhook);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Start the server
const port = Number(process.env.PORT) || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});

// Start the bot
const botService = new BotService();
botService.start().then(() => {
  console.log('Bot started successfully');
}).catch((error) => {
  console.error('Error starting bot:', error);
});

// Enable graceful stop
process.once('SIGINT', () => {
  botService.stop();
  process.exit(0);
});

process.once('SIGTERM', () => {
  botService.stop();
  process.exit(0);
}); 