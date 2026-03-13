const router = require('express').Router();
const pool = require('../db/index.cjs');
const { authMiddleware, requireRole } = require('../middleware/auth.cjs');

// ============================
// GET /api/audit
// Get all audit logs
// ============================
router.get('/', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { from, to, category, eventType, actorId } = req.query;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let i = 1;

    if (from) {
      query += ` AND created_at >= $${i++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND created_at <= $${i++}`;
      params.push(to);
    }
    if (category) {
      query += ` AND category = $${i++}`;
      params.push(category);
    }
    if (eventType) {
      query += ` AND event_type = $${i++}`;
      params.push(eventType);
    }
    if (actorId) {
      query += ` AND actor_id = $${i++}`;
      params.push(actorId);
    }

    query += ' ORDER BY created_at DESC LIMIT 500';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/audit
// Create an audit log entry
// ============================
router.post('/', authMiddleware, async (req, res) => {
  const {
    eventType, category, targetType,
    targetId, status, description, metadata
  } = req.body;

  if (!eventType || !category) {
    return res.status(400).json({ error: 'eventType and category are required' });
  }

  try {
    const actor = req.user;
    const ipAddress = req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress || 'N/A';
    const userAgent = req.headers['user-agent'] || 'N/A';

    const result = await pool.query(
      `INSERT INTO audit_logs (
        event_type, category,
        actor_id, actor_name, actor_username,
        actor_role, actor_email,
        target_type, target_id,
        status, description,
        ip_address, user_agent, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        eventType, category,
        actor.id, actor.name, actor.username,
        actor.role, actor.email,
        targetType || null, targetId || null,
        status || 'SUCCESS', description || null,
        ipAddress, userAgent,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create audit log error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// GET /api/audit/export
// Export audit logs as CSV
// ============================
router.get('/export', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let i = 1;

    if (from) {
      query += ` AND created_at >= $${i++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND created_at <= $${i++}`;
      params.push(to);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    // Build CSV
    const headers = [
      'ID', 'Event Type', 'Category', 'Actor Name',
      'Actor Username', 'Actor Role', 'Target Type',
      'Target ID', 'Status', 'Description', 'IP Address',
      'Created At'
    ];

    const rows = result.rows.map(row => [
      row.id,
      row.event_type,
      row.category,
      row.actor_name,
      row.actor_username,
      row.actor_role,
      row.target_type,
      row.target_id,
      row.status,
      row.description,
      row.ip_address,
      row.created_at
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(val => `"${val ?? ''}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition',
      `attachment; filename="audit-logs-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export audit logs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;