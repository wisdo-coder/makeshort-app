const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { PLANS, getPlanByPriceId } = require('../config/plans');

const router = express.Router();

module.exports = function createStripeRoutes() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  let stripe = null;
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }

  router.get('/plans', (_req, res) => {
    const publicPlans = PLANS.map(({ priceId, ...rest }) => rest);
    res.json({ plans: publicPlans });
  });

  router.get('/usage', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    try {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('plan_id, status, current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      const planId = (subData && subData.length > 0) ? subData[0].plan_id : 'free';

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { count } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfMonth);

      const plan = PLANS.find(p => p.id === planId) || PLANS[0];

      res.json({
        planId,
        planName: plan.name,
        videosUsed: count || 0,
        videosLimit: plan.limits.videosPerMonth,
        periodEnd: subData?.[0]?.current_period_end || null,
      });
    } catch (err) {
      console.error('Usage fetch error:', err.message);
      res.status(500).json({ error: 'Failed to fetch usage' });
    }
  });

  router.post('/create-checkout', async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' });
    }

    const { planId, userId, email } = req.body;
    if (!planId || !userId) {
      return res.status(400).json({ error: 'Missing planId or userId' });
    }

    const plan = PLANS.find(p => p.id === planId);
    if (!plan || !plan.priceId) {
      return res.status(400).json({ error: 'Invalid plan or plan not available for purchase' });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: plan.priceId, quantity: 1 }],
        success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}?checkout=success`,
        cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}?checkout=cancelled`,
        client_reference_id: userId,
        customer_email: email || undefined,
        metadata: { userId, planId },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
      console.error('Stripe checkout error:', err.message);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  router.post('/customer-portal', async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured.' });
    }

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    try {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!subData || subData.length === 0 || !subData[0].stripe_customer_id) {
        return res.status(404).json({ error: 'No subscription found' });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: subData[0].stripe_customer_id,
        return_url: process.env.CLIENT_URL || 'http://localhost:5173',
      });

      res.json({ url: portalSession.url });
    } catch (err) {
      console.error('Portal error:', err.message);
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  });

  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) return res.status(503).send('Stripe not configured');

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        event = JSON.parse(req.body);
      }
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const planId = session.metadata?.planId;

        if (userId && planId) {
          await supabase.from('subscriptions').upsert({
            user_id: userId,
            plan_id: planId,
            status: 'active',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            current_period_end: null,
          }, { onConflict: 'user_id' });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const plan = getPlanByPriceId(priceId);

        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status === 'active' ? 'active' : 'cancelled',
            plan_id: plan ? plan.id : undefined,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled', plan_id: 'free' })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  });

  return router;
};
