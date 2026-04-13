const router = require('express').Router();
const pool = require('../db/index.cjs');
const { authMiddleware, requireRole } = require('../middleware/auth.cjs');

// ============================
// AUDIT HELPER
// ============================
const writeAuditLog = async (req, eventType, targetId, description, metadata = {}) => {
  try {
    const actor = req.user || {};
    await pool.query(
      `INSERT INTO audit_logs 
        (event_type, category, actor_id, actor_name, actor_username, actor_role, actor_email,
         target_type, target_id, status, description, ip_address, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        eventType,
        'DEVICE_MANAGEMENT',
        actor.id || 'unknown',
        actor.name || 'Unknown',
        actor.username || 'unknown',
        actor.role || 'unknown',
        actor.email || '',
        'DEVICE',
        targetId,
        'SUCCESS',
        description,
        req.ip || '',
        JSON.stringify(metadata)
      ]
    );
  } catch (err) {
    console.error('Audit log write error:', err.message);
    // Non-fatal — don't fail the request if audit log fails
  }
};

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
  const { serialNumber, type, make, model, color, assignedTo, isLeased } = req.body;

  // Basic validation: serialNumber and type are always required
  if (!serialNumber || !type) {
    return res.status(400).json({ error: 'Device serialNumber and type are required [v2]' });
  }

  // Strict validation for BYOD: requires all details including assignment
  if (type === 'BYOD' && (!make || !model || !assignedTo)) {
    return res.status(400).json({ error: 'For BYOD devices; make, model, and assignedTo are required [v2]' });
  }

  try {
    // If assigning, check limits
    if (assignedTo) {
      const existing = await pool.query(
        'SELECT * FROM devices WHERE assigned_to = $1 AND type = $2 AND status = $3',
        [assignedTo, type, 'ACTIVE']
      );

      if (type === 'COMPANY' && existing.rows.length >= 2) {
        return res.status(409).json({
          error: `This employee has reached the maximum allowed COMPANY devices (2).`
        });
      }

      if (type === 'BYOD' && existing.rows.length >= 2) {
        return res.status(409).json({
          error: 'This employee has reached the maximum allowed BYOD devices (2).'
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO devices (serial_number, type, make, model, color, assigned_to, is_leased)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [serialNumber, type, make || null, model || null, color || null, assignedTo || null, isLeased || false]
    );

    await writeAuditLog(
      req,
      'DEVICE_REGISTERED',
      serialNumber,
      `${type} device ${serialNumber} registered${assignedTo ? ` and assigned to ${assignedTo}` : ''}`,
      { serialNumber, type, make, model, assignedTo, isLeased }
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
  const { make, model, color, type, assignedTo, qrCodeUrl, isLeased } = req.body;
  const serialNumber = req.params.serialNumber;

  try {
    // Fetch current device state before update
    const currentResult = await pool.query(
      'SELECT * FROM devices WHERE serial_number = $1',
      [serialNumber]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const current = currentResult.rows[0];

    // If reassigning to someone, check limits
    if (assignedTo) {
      const deviceType = type || current.type;
      const existing = await pool.query(
        'SELECT * FROM devices WHERE assigned_to = $1 AND type = $2 AND serial_number != $3 AND status = $4',
        [assignedTo, deviceType, serialNumber, 'ACTIVE']
      );

      if (deviceType === 'COMPANY' && existing.rows.length >= 2) {
        return res.status(409).json({
          error: `This employee has reached the maximum allowed COMPANY devices (2).`
        });
      }

      if (deviceType === 'BYOD' && existing.rows.length >= 2) {
        return res.status(409).json({
          error: 'This employee has reached the maximum allowed BYOD devices (2).'
        });
      }
    }

    // KEY FIX: assignedTo uses a special case so null (unassign) is respected
    // COALESCE($5, assigned_to) would ignore null — we need explicit null support
    const newAssignedTo = Object.prototype.hasOwnProperty.call(req.body, 'assignedTo')
      ? assignedTo   // use whatever was sent, including null
      : current.assigned_to; // field not sent at all — keep current

    const result = await pool.query(
      `UPDATE devices SET
        make        = COALESCE($1, make),
        model       = COALESCE($2, model),
        color       = COALESCE($3, color),
        type        = COALESCE($4, type),
        assigned_to = $5,
        qr_code_url = COALESCE($6, qr_code_url),
        is_leased   = COALESCE($7, is_leased),
        updated_at  = NOW()
       WHERE serial_number = $8
       RETURNING *`,
      [make, model, color, type, newAssignedTo, qrCodeUrl, isLeased, serialNumber]
    );

    // Determine what changed and write appropriate audit log
    const isUnassigning = current.assigned_to && newAssignedTo === null;
    const isAssigning   = !current.assigned_to && newAssignedTo;
    const isReassigning = current.assigned_to && newAssignedTo && current.assigned_to !== newAssignedTo;

    if (isUnassigning) {
      await writeAuditLog(
        req,
        'DEVICE_UNASSIGNED',
        serialNumber,
        `Device ${serialNumber} unassigned from ${current.assigned_to}`,
        { serialNumber, previousAssignee: current.assigned_to }
      );
    } else if (isAssigning) {
      await writeAuditLog(
        req,
        'DEVICE_ASSIGNED',
        serialNumber,
        `Device ${serialNumber} assigned to ${newAssignedTo}`,
        { serialNumber, assignedTo: newAssignedTo }
      );
    } else if (isReassigning) {
      await writeAuditLog(
        req,
        'DEVICE_REASSIGNED',
        serialNumber,
        `Device ${serialNumber} reassigned from ${current.assigned_to} to ${newAssignedTo}`,
        { serialNumber, previousAssignee: current.assigned_to, newAssignee: newAssignedTo }
      );
    } else if (!qrCodeUrl) {
      // Regular detail update (make/model/color) — skip logging QR updates
      await writeAuditLog(
        req,
        'DEVICE_UPDATED',
        serialNumber,
        `Device ${serialNumber} details updated`,
        { serialNumber, changes: { make, model, color, type, isLeased } }
      );
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

    await writeAuditLog(
      req,
      'DEVICE_RETIRED',
      req.params.serialNumber,
      `Device ${req.params.serialNumber} permanently retired`,
      { serialNumber: req.params.serialNumber }
    );

    const io = req.app.get('io');
    io.emit('devices:deleted', { serialNumber: req.params.serialNumber });

    res.json({ message: 'Device retired successfully' });
  } catch (err) {
    console.error('Retire device error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;