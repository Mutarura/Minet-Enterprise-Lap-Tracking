const router = require('express').Router();
const pool = require('../db/index.cjs');
const { authMiddleware } = require('../middleware/auth.cjs');

// ============================
// GET /api/visitors
// Get all visitors
// ============================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM visitors ORDER BY check_in_time DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get visitors error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// GET /api/visitors/active
// Get currently checked in visitors
// ============================
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM visitors 
       WHERE status = 'IN' 
       ORDER BY check_in_time DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get active visitors error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// GET /api/visitors/today
// Get today's visitors
// ============================
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM visitors
       WHERE check_in_time >= CURRENT_DATE
       AND check_in_time < CURRENT_DATE + INTERVAL '1 day'
       ORDER BY check_in_time DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get today visitors error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/visitors
// Register a new visitor check in
// ============================
router.post('/', authMiddleware, async (req, res) => {
  const {
    type, name, phone, identifier,
    destination, reason,
    deviceType, deviceMakeModel,
    deviceSerial, deviceColor
  } = req.body;

  if (!name || !reason) {
    return res.status(400).json({ error: 'name and reason are required' });
  }

  try {
    const visitorId = `VIS-${Date.now().toString().slice(-6)}`;
    const handledBy = req.user.name || req.user.username;

    const result = await pool.query(
      `INSERT INTO visitors (
        visitor_id, type, name, phone, identifier,
        destination, reason, status, check_in_time,
        device_type, device_make_model, device_serial,
        device_color, handled_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'IN',NOW(),$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        visitorId, type || 'QUICK', name, phone || null,
        identifier || null, destination || null, reason,
        deviceType || null, deviceMakeModel || null,
        deviceSerial || null, deviceColor || null, handledBy
      ]
    );

    const io = req.app.get('io');
    io.emit('visitors:updated', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add visitor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// PUT /api/visitors/:id/checkout
// Check out a visitor
// ============================
router.put('/:id/checkout', authMiddleware, async (req, res) => {
  try {
    const handledBy = req.user.name || req.user.username;

    const result = await pool.query(
      `UPDATE visitors SET
        status = 'OUT',
        check_out_time = NOW(),
        handled_by = $1,
        updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [handledBy, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    const io = req.app.get('io');
    io.emit('visitors:updated', result.rows[0]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Checkout visitor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;