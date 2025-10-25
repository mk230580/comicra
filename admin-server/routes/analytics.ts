import express from 'express';
import { supabase } from '../index';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

router.use(authenticateAdmin);

// Get dashboard overview stats
router.get('/overview', async (req, res) => {
  try {
    // Total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Active users
    const { count: activeUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Users by plan
    const { data: planData } = await supabase
      .from('profiles')
      .select('plan');

    const planStats = {
      free: 0,
      pro: 0,
      premium: 0,
    };

    planData?.forEach(user => {
      if (user.plan in planStats) {
        planStats[user.plan as keyof typeof planStats]++;
      }
    });

    // New users this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: newUsersThisMonth } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString());

    res.json({
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      inactiveUsers: (totalUsers || 0) - (activeUsers || 0),
      newUsersThisMonth: newUsersThisMonth || 0,
      planDistribution: planStats,
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get user growth data
router.get('/user-growth', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const { data, error } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Group by date
    const growthByDate: { [key: string]: number } = {};

    data?.forEach(user => {
      const date = new Date(user.created_at).toISOString().split('T')[0];
      growthByDate[date] = (growthByDate[date] || 0) + 1;
    });

    res.json(growthByDate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user growth data' });
  }
});

// Get recent activity
router.get('/recent-activity', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const { data, error } = await supabase
      .from('admin_actions')
      .select('*, profiles!admin_id(email, name)')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

export default router;
