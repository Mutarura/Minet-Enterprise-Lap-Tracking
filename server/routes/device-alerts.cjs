const router = require('express').Router();
const pool = require('../db/index.cjs');
const { authMiddleware, requireRole } = require('../middleware/auth.cjs');

// ============================
// GET /api/alerts
// Returns all unresolved device_alerts with per-user read status
// ============================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT 
         da.*,
         CASE WHEN ar.id IS NOT NULL THEN true ELSE false END as is_read
       FROM device_alerts da
       LEFT JOIN alert_reads ar ON ar.alert_id = da.id AND ar.user_id = $1
       WHERE da.is_resolved = false
       ORDER BY da.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get alerts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/alerts/:id/read
// Mark an alert as read for the current user
// ============================
router.post('/:id/read', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO alert_reads (alert_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (alert_id, user_id) DO NOTHING`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/alerts/:id/resolve
// Superadmin resolves an alert manually (without unlocking)
// ============================
router.post('/:id/resolve', authMiddleware, requireRole('superadmin'), async (req, res) => {
  try {
    await pool.query(
      `UPDATE device_alerts SET is_resolved = true, resolved_at = NOW(), resolved_by = $1 WHERE id = $2`,
      [req.user.name, req.params.id]
    );
    res.json({ message: 'Alert resolved' });
  } catch (err) {
    console.error('Resolve alert error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

