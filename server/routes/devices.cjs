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
        eventType, 'DEVICE_MANAGEMENT',
        actor.id || 'unknown', actor.name || 'Unknown', actor.username || 'unknown',
        actor.role || 'unknown', actor.email || '',
        'DEVICE', targetId, 'SUCCESS', description, req.ip || '',
        JSON.stringify(metadata)
      ]
    );
  } catch (err) {
    console.error('Audit log write error:', err.message);
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
    const device = result.rows[0];
    // Flag retrieved devices so security dashboard knows to block actions
    if (device.status === 'retrieved') {
      device.retrieved = true;
    }
    res.json(device);
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

  if (!serialNumber || !type) {
    return res.status(400).json({ error: 'Device serialNumber and type are required' });
  }

  if (type === 'BYOD' && (!make || !model || !assignedTo)) {
    return res.status(400).json({ error: 'For BYOD devices; make, model, and assignedTo are required' });
  }

  try {
    if (assignedTo) {
      const existing = await pool.query(
        'SELECT * FROM devices WHERE assigned_to = $1 AND type = $2 AND status = $3',
        [assignedTo, type, 'ACTIVE']
      );
      if (type === 'COMPANY' && existing.rows.length >= 2) {
        return res.status(409).json({ error: 'This employee has reached the maximum allowed COMPANY devices (2).' });
      }
      if (type === 'BYOD' && existing.rows.length >= 2) {
        return res.status(409).json({ error: 'This employee has reached the maximum allowed BYOD devices (2).' });
      }
    }

    const result = await pool.query(
      `INSERT INTO devices (serial_number, type, make, model, color, assigned_to, is_leased)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [serialNumber, type, make || null, model || null, color || null, assignedTo || null, isLeased || false]
    );

    await writeAuditLog(req, 'DEVICE_REGISTERED', serialNumber,
      `${type} device ${serialNumber} registered${assignedTo ? ` and assigned to ${assignedTo}` : ''}`,
      { serialNumber, type, make, model, assignedTo, isLeased }
    );

    const io = req.app.get('io');
    io.emit('devices:updated', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Serial number already exists' });
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
    const currentResult = await pool.query('SELECT * FROM devices WHERE serial_number = $1', [serialNumber]);
    if (currentResult.rows.length === 0) return res.status(404).json({ error: 'Device not found' });
    const current = currentResult.rows[0];

    if (assignedTo) {
      const deviceType = type || current.type;
      const existing = await pool.query(
        'SELECT * FROM devices WHERE assigned_to = $1 AND type = $2 AND serial_number != $3 AND status = $4',
        [assignedTo, deviceType, serialNumber, 'ACTIVE']
      );
      if (deviceType === 'COMPANY' && existing.rows.length >= 2) {
        return res.status(409).json({ error: 'This employee has reached the maximum allowed COMPANY devices (2).' });
      }
      if (deviceType === 'BYOD' && existing.rows.length >= 2) {
        return res.status(409).json({ error: 'This employee has reached the maximum allowed BYOD devices (2).' });
      }
    }

    const newAssignedTo = Object.prototype.hasOwnProperty.call(req.body, 'assignedTo')
      ? assignedTo
      : current.assigned_to;

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
       WHERE serial_number = $8 RETURNING *`,
      [make, model, color, type, newAssignedTo, qrCodeUrl, isLeased, serialNumber]
    );

    const isUnassigning = current.assigned_to && newAssignedTo === null;
    const isAssigning   = !current.assigned_to && newAssignedTo;
    const isReassigning = current.assigned_to && newAssignedTo && current.assigned_to !== newAssignedTo;

    if (isUnassigning) {
      await writeAuditLog(req, 'DEVICE_UNASSIGNED', serialNumber,
        `Device ${serialNumber} unassigned from ${current.assigned_to}`,
        { serialNumber, previousAssignee: current.assigned_to }
      );
    } else if (isAssigning) {
      await writeAuditLog(req, 'DEVICE_ASSIGNED', serialNumber,
        `Device ${serialNumber} assigned to ${newAssignedTo}`,
        { serialNumber, assignedTo: newAssignedTo }
      );
    } else if (isReassigning) {
      await writeAuditLog(req, 'DEVICE_REASSIGNED', serialNumber,
        `Device ${serialNumber} reassigned from ${current.assigned_to} to ${newAssignedTo}`,
        { serialNumber, previousAssignee: current.assigned_to, newAssignee: newAssignedTo }
      );
    } else if (!qrCodeUrl) {
      await writeAuditLog(req, 'DEVICE_UPDATED', serialNumber,
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
// POST /api/devices/:serialNumber/retrieve
// Guard marks a device as retrieved
// ============================
router.post('/:serialNumber/retrieve', authMiddleware, async (req, res) => {
  const { locationNote } = req.body;
  const serialNumber = req.params.serialNumber;

  try {
    const currentResult = await pool.query('SELECT * FROM devices WHERE serial_number = $1', [serialNumber]);
    if (currentResult.rows.length === 0) return res.status(404).json({ error: 'Device not found' });

    const current = currentResult.rows[0];

    if (current.status === 'retrieved') {
      return res.status(409).json({ error: 'Device is already marked as retrieved.' });
    }

    // Save current last_action into previous_action, set status to retrieved
    await pool.query(
      `UPDATE devices SET
        status          = 'retrieved',
        previous_action = last_action,
        retrieved_at    = NOW(),
        updated_at      = NOW()
       WHERE serial_number = $1`,
      [serialNumber]
    );

    // Write to activity_logs so it shows in Security Activities tab
    await pool.query(
      `INSERT INTO activity_logs (emp_id, serial_number, action, timestamp, employee_name)
       VALUES ($1, $2, 'RETRIEVED', NOW(), $3)`,
      [current.assigned_to || 'UNASSIGNED', serialNumber, current.assigned_employee_name || 'Unknown']
    );

    // Write to audit_logs
    await writeAuditLog(req, 'DEVICE_RETRIEVED', serialNumber,
      `Device ${serialNumber} marked as retrieved by ${req.user.name}${locationNote ? ` — Location: ${locationNote}` : ''}`,
      { serialNumber, locationNote, guardName: req.user.name, previousAction: current.last_action }
    );

    // Create device_alert
    const alertResult = await pool.query(
      `INSERT INTO device_alerts (device_serial, alert_type, message, created_by)
       VALUES ($1, 'RETRIEVED', $2, $3)
       RETURNING *`,
      [
        serialNumber,
        `Device ${serialNumber} was found and retrieved by security${locationNote ? ` at: ${locationNote}` : ''}. Please contact IT to unlock.`,
        req.user.name
      ]
    );

    const io = req.app.get('io');
    io.emit('device_retrieved', {
      alert: alertResult.rows[0],
      serialNumber,
      guardName: req.user.name,
      locationNote: locationNote || null,
      timestamp: new Date().toISOString()
    });

    // Also emit devices:updated so admin device list refreshes
    const updatedDevice = await pool.query(
      `SELECT d.*, e.name as assigned_employee_name FROM devices d LEFT JOIN employees e ON d.assigned_to = e.emp_id WHERE d.serial_number = $1`,
      [serialNumber]
    );
    io.emit('devices:updated', updatedDevice.rows[0]);

    res.json({ message: 'Device marked as retrieved', alertId: alertResult.rows[0].id });
  } catch (err) {
    console.error('Retrieve device error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/devices/:serialNumber/unlock
// Superadmin unlocks a retrieved device
// ============================
router.post('/:serialNumber/unlock', authMiddleware, requireRole('superadmin'), async (req, res) => {
  const serialNumber = req.params.serialNumber;

  try {
    const currentResult = await pool.query('SELECT * FROM devices WHERE serial_number = $1', [serialNumber]);
    if (currentResult.rows.length === 0) return res.status(404).json({ error: 'Device not found' });

    const current = currentResult.rows[0];

    if (current.status !== 'retrieved') {
      return res.status(409).json({ error: 'Device is not in retrieved status.' });
    }

    // Restore previous state
    await pool.query(
      `UPDATE devices SET
        status          = 'ACTIVE',
        last_action     = previous_action,
        previous_action = NULL,
        retrieved_at    = NULL,
        updated_at      = NOW()
       WHERE serial_number = $1`,
      [serialNumber]
    );

    // Resolve the device alert
    await pool.query(
      `UPDATE device_alerts SET
        is_resolved = true,
        resolved_at = NOW(),
        resolved_by = $1
       WHERE device_serial = $2 AND is_resolved = false`,
      [req.user.name, serialNumber]
    );

    // Audit log
    await writeAuditLog(req, 'DEVICE_UNLOCKED', serialNumber,
      `Device ${serialNumber} unlocked and restored to active status by ${req.user.name}`,
      { serialNumber }
    );

    const io = req.app.get('io');
    io.emit('device_unlocked', { serialNumber });

    const updatedDevice = await pool.query(
      `SELECT d.*, e.name as assigned_employee_name FROM devices d LEFT JOIN employees e ON d.assigned_to = e.emp_id WHERE d.serial_number = $1`,
      [serialNumber]
    );
    io.emit('devices:updated', updatedDevice.rows[0]);

    res.json({ message: 'Device unlocked successfully' });
  } catch (err) {
    console.error('Unlock device error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// DELETE /api/devices/:serialNumber (retire)
// ============================
router.delete('/:serialNumber', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM devices WHERE serial_number = $1 RETURNING *', [req.params.serialNumber]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Device not found' });

    await writeAuditLog(req, 'DEVICE_RETIRED', req.params.serialNumber,
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
