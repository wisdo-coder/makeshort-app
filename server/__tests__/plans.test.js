const { PLANS, getPlanById, getPlanByPriceId } = require('../config/plans');

describe('plans config', () => {
  test('has 4 plans', () => {
    expect(PLANS).toHaveLength(4);
  });

  test('plan IDs are unique', () => {
    const ids = PLANS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('free plan exists with correct limits', () => {
    const free = getPlanById('free');
    expect(free).toBeDefined();
    expect(free.price).toBe(0);
    expect(free.limits.videosPerMonth).toBe(2);
    expect(free.limits.watermark).toBe(true);
  });

  test('pro plan is marked as popular', () => {
    const pro = getPlanById('pro');
    expect(pro.popular).toBe(true);
  });

  test('creator plan has unlimited videos', () => {
    const creator = getPlanById('creator');
    expect(creator.limits.videosPerMonth).toBe(-1);
  });

  test('getPlanById returns free for unknown ID', () => {
    const plan = getPlanById('nonexistent');
    expect(plan.id).toBe('free');
  });

  test('getPlanByPriceId returns null for unknown price', () => {
    const plan = getPlanByPriceId('price_unknown');
    expect(plan).toBeNull();
  });

  test('all paid plans have "all" voice/background access', () => {
    const paidPlans = PLANS.filter(p => p.price > 0);
    paidPlans.forEach(plan => {
      expect(plan.limits.voiceOptions).toBe('all');
      expect(plan.limits.backgroundOptions).toBe('all');
    });
  });

  test('all plans have features array', () => {
    PLANS.forEach(plan => {
      expect(Array.isArray(plan.features)).toBe(true);
      expect(plan.features.length).toBeGreaterThan(0);
    });
  });
});
