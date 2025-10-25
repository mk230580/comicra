import express from 'express';
import { supabase } from '../index';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

router.use(authenticateAdmin);

// Get all subscriptions with user info
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, plan = '', status = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('profiles')
      .select('id, email, name, plan, credits, is_active, created_at, updated_at', { count: 'exact' });

    if (plan) {
      query = query.eq('plan', plan);
    }

    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      subscriptions: data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Get subscription analytics
router.get('/analytics', async (req, res) => {
  try {
    // Get plan distribution
    const { data: planStats } = await supabase
      .from('profiles')
      .select('plan')
      .then(result => {
        const stats = {
          free: 0,
          pro: 0,
          premium: 0,
        };
        result.data?.forEach(user => {
          if (user.plan in stats) {
            stats[user.plan as keyof typeof stats]++;
          }
        });
        return { data: stats };
      });

    // Get active vs inactive users
    const { data: statusStats } = await supabase
      .from('profiles')
      .select('is_active')
      .then(result => {
        const stats = { active: 0, inactive: 0 };
        result.data?.forEach(user => {
          if (user.is_active) stats.active++;
          else stats.inactive++;
        });
        return { data: stats };
      });

    res.json({
      planDistribution: planStats,
      userStatus: statusStats,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Update subscription plan
router.patch('/:userId/plan', async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan, credits } = req.body;

    const updates: any = {};
    if (plan) updates.plan = plan;
    if (typeof credits === 'number') updates.credits = credits;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log admin action
    await supabase.from('admin_actions').insert({
      admin_id: req.user?.id,
      action_type: 'subscription_change',
      target_user_id: userId,
      details: updates,
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

export default router;
