const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    limits: {
      videosPerMonth: 2,
      maxScriptLength: 500,
      watermark: true,
      voiceOptions: ['aura-orion-en', 'aura-luna-en'],
      backgroundOptions: ['minecraft-parkour', 'subway-surfers'],
      captionStyles: ['classic-yellow'],
    },
    features: [
      '2 videos per month',
      '2 AI voices',
      '2 backgrounds',
      '1 caption style',
      'Watermark on videos',
      '500 character script limit',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 7.99,
    priceId: process.env.STRIPE_STARTER_PRICE_ID || null,
    limits: {
      videosPerMonth: 15,
      maxScriptLength: 1000,
      watermark: false,
      voiceOptions: 'all',
      backgroundOptions: 'all',
      captionStyles: 'all',
    },
    features: [
      '15 videos per month',
      'All 8 AI voices',
      'All 6 backgrounds',
      'All 5 caption styles',
      'No watermark',
      '1,000 character scripts',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 14.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID || null,
    limits: {
      videosPerMonth: 40,
      maxScriptLength: 2000,
      watermark: false,
      voiceOptions: 'all',
      backgroundOptions: 'all',
      captionStyles: 'all',
    },
    features: [
      '40 videos per month',
      'All 8 AI voices',
      'All 6 backgrounds',
      'All 5 caption styles',
      'No watermark',
      '2,000 character scripts',
      'Priority rendering',
    ],
    popular: true,
  },
  {
    id: 'creator',
    name: 'Creator',
    price: 24.99,
    priceId: process.env.STRIPE_CREATOR_PRICE_ID || null,
    limits: {
      videosPerMonth: -1,
      maxScriptLength: 5000,
      watermark: false,
      voiceOptions: 'all',
      backgroundOptions: 'all',
      captionStyles: 'all',
    },
    features: [
      'Unlimited videos',
      'All 8 AI voices',
      'All 6 backgrounds',
      'All 5 caption styles',
      'No watermark',
      '5,000 character scripts',
      'Priority rendering',
      'Video clip extraction',
      'API access (coming soon)',
    ],
  },
];

function getPlanById(planId) {
  return PLANS.find(p => p.id === planId) || PLANS[0];
}

function getPlanByPriceId(priceId) {
  return PLANS.find(p => p.priceId === priceId) || null;
}

module.exports = { PLANS, getPlanById, getPlanByPriceId };
