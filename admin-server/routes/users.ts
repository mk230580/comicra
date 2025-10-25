import express from 'express';
import { supabase } from '../index';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// Get all users with pagination and filters
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      plan = '',
      role = '',
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }

    if (plan) {
      query = query.eq('plan', plan);
    }

    if (role) {
      query = query.eq('role', role);
    }

    // Apply sorting
    query = query.order(sortBy as string, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      users: data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating sensitive fields directly
    delete updates.id;
    delete updates.created_at;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log admin action
    await supabase.from('admin_actions').insert({
      admin_id: req.user?.id,
      action_type: 'user_update',
      target_user_id: id,
      details: { updates },
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Adjust user credits
router.post('/:id/credits', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    if (typeof amount !== 'number') {
      return res.status(400).json({ error: 'Amount must be a number' });
    }

    // Get current credits
    const { data: user, error: fetchError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newCredits = (user.credits || 0) + amount;

    if (newCredits < 0) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    // Update credits
    const { data, error } = await supabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log admin action
    await supabase.from('admin_actions').insert({
      admin_id: req.user?.id,
      action_type: 'credit_adjustment',
      target_user_id: id,
      details: { amount, reason, previous: user.credits, new: newCredits },
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to adjust credits' });
  }
});

// Ban/unban user
router.post('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log admin action
    await supabase.from('admin_actions').insert({
      admin_id: req.user?.id,
      action_type: 'user_update',
      target_user_id: id,
      details: { action: is_active ? 'activated' : 'banned' },
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete user from auth (cascades to profiles)
    const { error } = await supabase.auth.admin.deleteUser(id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log admin action
    await supabase.from('admin_actions').insert({
      admin_id: req.user?.id,
      action_type: 'user_delete',
      target_user_id: id,
      details: { deleted_at: new Date().toISOString() },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
