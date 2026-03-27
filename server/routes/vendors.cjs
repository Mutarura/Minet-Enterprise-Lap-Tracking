const router = require('express').Router();
const pool = require('../db/index.cjs');
const { authMiddleware, requireRole } = require('../middleware/auth.cjs');

// ============================
// GET /api/vendors
// ============================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM vendors WHERE is_active = TRUE ORDER BY full_name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get vendors error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/vendors
// Register a new vendor
// ============================
router.post('/', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  const { fullName, phone, company, supplies, notes } = req.body;

  if (!fullName) {
    return res.status(400).json({ error: 'fullName is required' });
  }

  try {
    const vendorId = `VEN-${Date.now().toString().slice(-6)}`;
    const createdBy = req.user.name || req.user.username;

    const result = await pool.query(
      `INSERT INTO vendors (vendor_id, full_name, phone, company, supplies, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [vendorId, fullName, phone || null, company || null, supplies || null, notes || null, createdBy]
    );

    const io = req.app.get('io');
    io.emit('vendors:updated', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add vendor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// DELETE /api/vendors/:id
// ============================
router.delete('/:id', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE vendors SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const io = req.app.get('io');
    io.emit('vendors:deleted', { id: req.params.id });

    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    console.error('Delete vendor error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// GET /api/vendors/visits/active
// Get active vendor visits
// ============================
router.get('/visits/active', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vv.*, v.full_name as vendor_full_name, v.company
       FROM vendor_visits vv
       JOIN vendors v ON vv.vendor_id = v.id
       WHERE vv.status = 'IN'
       ORDER BY vv.check_in_time DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get active vendor visits error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// GET /api/vendors/visits/today
// Get today's vendor visits
// ============================
router.get('/visits/today', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vv.*, v.full_name as vendor_full_name, v.company
       FROM vendor_visits vv
       JOIN vendors v ON vv.vendor_id = v.id
       WHERE vv.check_in_time >= CURRENT_DATE
       AND vv.check_in_time < CURRENT_DATE + INTERVAL '1 day'
       ORDER BY vv.check_in_time DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get today vendor visits error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/vendors/:id/checkin
// Check in a vendor visit
// ============================
router.post('/:id/checkin', authMiddleware, async (req, res) => {
  const { purpose, companyName, visitorName, visitorPhone } = req.body;

  if (!purpose || !visitorName) {
    return res.status(400).json({ error: 'purpose and visitorName are required' });
  }

  try {
    // Get vendor details
    const vendor = await pool.query(
      'SELECT * FROM vendors WHERE id = $1',
      [req.params.id]
    );

    if (vendor.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const handledBy = req.user.name || req.user.username;

    const result = await pool.query(
      `INSERT INTO vendor_visits (
        vendor_id, vendor_name, company_name,
        visitor_name, visitor_phone, purpose,
        status, check_in_time, handled_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'IN', NOW(), $7)
      RETURNING *`,
      [
        req.params.id,
        vendor.rows[0].full_name,
        companyName || vendor.rows[0].company,
        visitorName,
        visitorPhone || null,
        purpose,
        handledBy
      ]
    );

    const io = req.app.get('io');
    io.emit('vendorVisits:updated', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Vendor checkin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// PUT /api/vendors/visits/:visitId/checkout
// Check out a vendor visit
// ============================
router.put('/visits/:visitId/checkout', authMiddleware, async (req, res) => {
  try {
    const handledBy = req.user.name || req.user.username;

    const result = await pool.query(
      `UPDATE vendor_visits SET
        status = 'OUT',
        check_out_time = NOW(),
        handled_by = $1,
        updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [handledBy, req.params.visitId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor visit not found' });
    }

    const io = req.app.get('io');
    io.emit('vendorVisits:updated', result.rows[0]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Vendor checkout error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;