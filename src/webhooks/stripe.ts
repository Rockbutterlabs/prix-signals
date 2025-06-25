import express, { Request, Response } from 'express';
import { StripeService } from '../services/stripe';
import { BotService } from '../services/bot';

const router = express.Router();
const stripeService = new StripeService();
const botService = new BotService();

// Handle Stripe webhook events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    res.status(400).send('No signature');
    return;
  }

  try {
    const event = stripeService.stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    await stripeService.handleWebhook(event);
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
});

// Handle successful payment
router.get('/success', async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.query.session_id as string;
  
  try {
    const session = await stripeService.stripe.checkout.sessions.retrieve(sessionId);
    const userId = session.client_reference_id;

    if (!userId) {
      throw new Error('No user ID in session');
    }

    // Send success message to user
    await botService.sendMessage(userId, 
      '🎉 Thank you for subscribing to Prix Signals Premium!\n\n' +
      'You now have access to:\n' +
      '• Unlimited low cap signals\n' +
      '• Priority signal delivery\n' +
      '• Advanced wallet monitoring\n' +
      '• Premium community access\n\n' +
      'Use /premium to manage your subscription.'
    );

    res.send('Payment successful! You can close this window.');
  } catch (err) {
    console.error('Success handler error:', err);
    res.status(400).send('Error processing payment');
  }
});

// Handle cancelled payment
router.get('/cancel', (_req: Request, res: Response): void => {
  res.send('Payment cancelled. You can try again later.');
});

export default router; 