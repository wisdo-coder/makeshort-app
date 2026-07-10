const { createClient } = require('@supabase/supabase-js');
const { getPlanById } = require('../config/plans');

function createUsageTracker() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  async function getUserPlan(userId) {
    if (!userId) return 'free';

    const { data } = await supabase
      .from('subscriptions')
      .select('plan_id, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      return data[0].plan_id;
    }
    return 'free';
  }

  async function getMonthlyUsage(userId) {
    if (!userId) return 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth);

    return count || 0;
  }

  async function checkUsageLimit(req, res, next) {
    const userId = req.body.userId;
    if (!userId) {
      return next();
    }

    try {
      const planId = await getUserPlan(userId);
      const plan = getPlanById(planId);
      const usage = await getMonthlyUsage(userId);

      if (plan.limits.videosPerMonth !== -1 && usage >= plan.limits.videosPerMonth) {
        return res.status(403).json({
          error: 'Monthly video limit reached',
          limit: plan.limits.videosPerMonth,
          used: usage,
          planId: planId,
          upgrade: planId === 'free' ? 'Upgrade to Starter for 15 videos/month' : 'Upgrade your plan for more videos',
        });
      }

      req.userPlan = plan;
      req.userUsage = usage;
      next();
    } catch (err) {
      console.error('Usage check error:', err.message);
      next();
    }
  }

  return { getUserPlan, getMonthlyUsage, checkUsageLimit };
}

module.exports = createUsageTracker;
