const router = require('express').Router();
const pool = require('../db/index.cjs');
const { authMiddleware, requireRole } = require('../middleware/auth.cjs');

// ============================
// GET /api/devices
// ============================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, e.name as assigned_employee_name 
       FROM devices d
       LEFT JOIN employees e ON d.assigned_to = e.emp_id
       ORDER BY d.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get devices error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// GET /api/devices/:serialNumber
// ============================
router.get('/:serialNumber', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, e.name as assigned_employee_name
       FROM devices d
       LEFT JOIN employees e ON d.assigned_to = e.emp_id
       WHERE d.serial_number = $1`,
      [req.params.serialNumber]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get device error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/devices
// ============================
router.post('/', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  const { serialNumber, type, make, model, color, assignedTo } = req.body;

  if (!serialNumber || !type || !assignedTo) {
    return res.status(400).json({ error: 'serialNumber, type and assignedTo are required' });
  }

  try {
    // Enforce device limits per employee
    const existing = await pool.query(
      'SELECT * FROM devices WHERE assigned_to = $1 AND type = $2 AND status = $3',
      [assignedTo, type, 'ACTIVE']
    );

    if (type === 'COMPANY' && existing.rows.length >= 1) {
      return res.status(409).json({ 
        error: `This employee already has a COMPANY device (${existing.rows[0].serial_number}). Only one per type is permitted.` 
      });
    }

    if (type === 'BYOD' && existing.rows.length >= 2) {
      return res.status(409).json({ 
        error: 'This employee has reached the maximum allowed BYOD devices (2).' 
      });
    }

    const result = await pool.query(
      `INSERT INTO devices (serial_number, type, make, model, color, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [serialNumber, type, make || null, model || null, color || null, assignedTo]
    );

    const io = req.app.get('io');
    io.emit('devices:updated', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Serial number already exists' });
    }
    console.error('Add device error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// PUT /api/devices/:serialNumber
// ============================
router.put('/:serialNumber', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  const { make, model, color, type, assignedTo, qrCodeUrl } = req.body;

  try {
    // If reassigning, check limits
    if (assignedTo) {
      const currentDevice = await pool.query(
        'SELECT * FROM devices WHERE serial_number = $1',
        [req.params.serialNumber]
      );

      const deviceType = type || currentDevice.rows[0]?.type;

      const existing = await pool.query(
        'SELECT * FROM devices WHERE assigned_to = $1 AND type = $2 AND serial_number != $3 AND status = $4',
        [assignedTo, deviceType, req.params.serialNumber, 'ACTIVE']
      );

      if (deviceType === 'COMPANY' && existing.rows.length >= 1) {
        return res.status(409).json({ 
          error: `This employee already has a COMPANY device (${existing.rows[0].serial_number}).` 
        });
      }

      if (deviceType === 'BYOD' && existing.rows.length >= 2) {
        return res.status(409).json({ 
          error: 'This employee has reached the maximum allowed BYOD devices (2).' 
        });
      }
    }

    const result = await pool.query(
      `UPDATE devices SET
        make = COALESCE($1, make),
        model = COALESCE($2, model),
        color = COALESCE($3, color),
        type = COALESCE($4, type),
        assigned_to = COALESCE($5, assigned_to),
        qr_code_url = COALESCE($6, qr_code_url),
        updated_at = NOW()
       WHERE serial_number = $7
       RETURNING *`,
      [make, model, color, type, assignedTo, qrCodeUrl, req.params.serialNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const io = req.app.get('io');
    io.emit('devices:updated', result.rows[0]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update device error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// DELETE /api/devices/:serialNumber (retire)
// ============================
router.delete('/:serialNumber', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM devices WHERE serial_number = $1 RETURNING *',
      [req.params.serialNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const io = req.app.get('io');
    io.emit('devices:deleted', { serialNumber: req.params.serialNumber });

    res.json({ message: 'Device retired successfully' });
  } catch (err) {
    console.error('Retire device error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;