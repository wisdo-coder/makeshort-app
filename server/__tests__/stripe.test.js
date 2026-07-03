const { PLANS } = require('../config/plans');

describe('stripe routes config', () => {
  test('paid plans have priceId field (null until configured)', () => {
    const paidPlans = PLANS.filter(p => p.price > 0);
    expect(paidPlans.length).toBe(3);
    paidPlans.forEach(plan => {
      expect(plan).toHaveProperty('priceId');
    });
  });

  test('free plan has null priceId', () => {
    const free = PLANS.find(p => p.id === 'free');
    expect(free.priceId).toBeNull();
  });

  test('prices are in ascending order', () => {
    for (let i = 1; i < PLANS.length; i++) {
      expect(PLANS[i].price).toBeGreaterThan(PLANS[i - 1].price);
    }
  });

  test('starter price is $7.99', () => {
    const starter = PLANS.find(p => p.id === 'starter');
    expect(starter.price).toBe(7.99);
  });

  test('pro price is $14.99', () => {
    const pro = PLANS.find(p => p.id === 'pro');
    expect(pro.price).toBe(14.99);
  });

  test('creator price is $24.99', () => {
    const creator = PLANS.find(p => p.id === 'creator');
    expect(creator.price).toBe(24.99);
  });
});
