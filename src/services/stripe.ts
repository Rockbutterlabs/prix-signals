import Stripe from 'stripe';
import { db } from './database';

export class StripeService {
  public readonly stripe: Stripe;
  private readonly PREMIUM_PRICE = 9.99; // $9.99 per month

  constructor() {
    this.stripe = new Stripe('sk_test_51Ra0ci2MJ7ZueJrMmxJqI5wcU7sxA5aVLCQH5ubeJrzpOy0g1GMGEDBcILchbKDkQtKq21s9QfGArkZCEivinOR000fQYMWu8m', {
      apiVersion: '2023-10-16'
    });
  }

  async createCheckoutSession(userId: string): Promise<{ url: string }> {
    try {
      // Create a checkout session
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Prix Signals Premium',
                description: 'Get exclusive access to low cap crypto signals'
              },
              unit_amount: Math.round(this.PREMIUM_PRICE * 100), // Convert to cents
              recurring: {
                interval: 'month'
              }
            },
            quantity: 1
          }
        ],
        mode: 'subscription',
        success_url: `${process.env.BOT_WEBHOOK_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.BOT_WEBHOOK_URL}/cancel`,
        client_reference_id: userId,
        metadata: {
          userId
        }
      });

      return { url: session.url! };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.client_reference_id;

          if (!userId) {
            throw new Error('No user ID in session');
          }

          // Update user's premium status
          await db.users.createOrUpdate({
            id: userId,
            username: '', // This will be updated by the bot
            isPremium: true,
            premiumExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            createdAt: new Date().toISOString()
          });

          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const userId = subscription.metadata.userId;

          if (!userId) {
            throw new Error('No user ID in subscription');
          }

          // Update user's premium status
          await db.users.createOrUpdate({
            id: userId,
            username: '', // This will be updated by the bot
            isPremium: false,
            premiumExpiresAt: null,
            createdAt: new Date().toISOString()
          });

          break;
        }
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }
} 