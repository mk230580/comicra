import express from 'express';
import { supabase } from '../index';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

router.use(authenticateAdmin);

// Get flagged/reported content (placeholder for future implementation)
router.get('/flagged', async (req, res) => {
  try {
    // Placeholder - implement when content moderation is added
    res.json({
      items: [],
      message: 'Content moderation not yet implemented',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch flagged content' });
  }
});

// Get user projects for review
router.get('/projects', async (req, res) => {
  try {
    const { page = 1, limit = 20, userId = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Placeholder query - adjust based on your actual projects table schema
    let query = supabase
      .from('projects')
      .select('*, profiles!user_id(email, name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error, count } = await query;

    if (error) {
      // Table might not exist yet
      return res.json({
        projects: [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
          totalPages: 0,
        },
        message: 'Projects table not yet created',
      });
    }

    res.json({
      projects: data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Delete project (content moderation)
router.delete('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log admin action
    await supabase.from('admin_actions').insert({
      admin_id: req.user?.id,
      action_type: 'content_moderation',
      details: { project_id: id, action: 'deleted', reason },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
