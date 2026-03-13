const router = require('express').Router();
const pool = require('../db/index.cjs');
const { authMiddleware, requireRole } = require('../middleware/auth.cjs');

// ============================
// GET /api/logs
// Get all activity logs (check in/out records)
// ============================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { from, to, empId, serialNumber } = req.query;

    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    const params = [];
    let i = 1;

    if (from) {
      query += ` AND timestamp >= $${i++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND timestamp <= $${i++}`;
      params.push(to);
    }
    if (empId) {
      query += ` AND emp_id = $${i++}`;
      params.push(empId);
    }
    if (serialNumber) {
      query += ` AND serial_number = $${i++}`;
      params.push(serialNumber);
    }

    query += ' ORDER BY timestamp DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// GET /api/logs/today
// Get today's activity logs
// ============================
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM activity_logs 
       WHERE timestamp >= CURRENT_DATE 
       AND timestamp < CURRENT_DATE + INTERVAL '1 day'
       ORDER BY timestamp DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get today logs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/logs
// Record a check in or check out
// ============================
router.post('/', authMiddleware, async (req, res) => {
  const { empId, employeeName, serialNumber, action, syncedFromOffline } = req.body;

  if (!empId || !employeeName || !serialNumber || !action) {
    return res.status(400).json({ 
      error: 'empId, employeeName, serialNumber and action are required' 
    });
  }

  if (!['CHECK_IN', 'CHECK_OUT'].includes(action)) {
    return res.status(400).json({ error: 'action must be CHECK_IN or CHECK_OUT' });
  }

  try {
    // Check for double actions — prevent two consecutive CHECK_INs or CHECK_OUTs
    const lastLog = await pool.query(
      `SELECT action FROM activity_logs 
       WHERE serial_number = $1 
       ORDER BY timestamp DESC LIMIT 1`,
      [serialNumber]
    );

    if (lastLog.rows.length > 0 && lastLog.rows[0].action === action) {
      return res.status(409).json({ 
        error: `Device is already ${action === 'CHECK_IN' ? 'checked in' : 'checked out'}` 
      });
    }

    // Create the log entry
    const now = new Date();
    const result = await pool.query(
      `INSERT INTO activity_logs 
        (emp_id, employee_name, serial_number, action, timestamp, logstamp, readable_logstamp, synced_from_offline)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
       RETURNING *`,
      [
        empId,
        employeeName,
        serialNumber,
        action,
        now,
        now.toLocaleString(),
        syncedFromOffline || false
      ]
    );

    // Update device last action
    await pool.query(
      `UPDATE devices SET 
        last_action = $1, 
        last_action_at = NOW(),
        updated_at = NOW()
       WHERE serial_number = $2`,
      [action, serialNumber]
    );

    // Emit real time update to all connected clients
    const io = req.app.get('io');
    io.emit('logs:new', result.rows[0]);
    io.emit('devices:updated', { serialNumber, lastAction: action });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add log error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/logs/sync
// Sync offline queued scans
// ============================
router.post('/sync', authMiddleware, async (req, res) => {
  const { scans } = req.body;

  if (!scans || !Array.isArray(scans)) {
    return res.status(400).json({ error: 'scans array is required' });
  }

  const results = [];
  const errors = [];

  for (const scan of scans) {
    try {
      const { empId, employeeName, serialNumber, action, createdAt } = scan;

      // Check for duplicate — skip if already synced
      const duplicate = await pool.query(
        `SELECT id FROM activity_logs 
         WHERE serial_number = $1 
         AND emp_id = $2 
         AND action = $3
         AND ABS(EXTRACT(EPOCH FROM (timestamp - $4::timestamptz))) < 30`,
        [serialNumber, empId, action, new Date(createdAt)]
      );

      if (duplicate.rows.length > 0) {
        results.push({ id: scan.id, status: 'skipped', reason: 'duplicate' });
        continue;
      }

      const timestamp = new Date(createdAt);
      const result = await pool.query(
        `INSERT INTO activity_logs
          (emp_id, employee_name, serial_number, action, timestamp, logstamp, readable_logstamp, synced_from_offline)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, TRUE)
         RETURNING *`,
        [empId, employeeName, serialNumber, action, timestamp, timestamp.toLocaleString()]
      );

      // Update device last action
      await pool.query(
        `UPDATE devices SET 
          last_action = $1,
          last_action_at = NOW(),
          updated_at = NOW()
         WHERE serial_number = $2`,
        [action, serialNumber]
      );

      const io = req.app.get('io');
      io.emit('logs:new', result.rows[0]);

      results.push({ id: scan.id, status: 'synced', log: result.rows[0] });
    } catch (err) {
      console.error('Sync scan error:', err);
      errors.push({ id: scan.id, error: err.message });
    }
  }

  res.json({ results, errors });
});

module.exports = router;