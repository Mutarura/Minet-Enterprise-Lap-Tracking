const router = require('express').Router();
const pool = require('../db/index.cjs');
const { authMiddleware, requireRole } = require('../middleware/auth.cjs');

// ============================
// GET /api/employees
// ============================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM employees ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// GET /api/employees/:empId
// ============================
router.get('/:empId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM employees WHERE emp_id = $1',
      [req.params.empId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get employee error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/employees
// ============================
router.post('/', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  const { empId, name, department, photoUrl } = req.body;

  if (!empId || !name) {
    return res.status(400).json({ error: 'empId and name are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO employees (emp_id, name, department, photo_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [empId, name, department || null, photoUrl || null]
    );

    // Notify all connected clients in real time
    const io = req.app.get('io');
    io.emit('employees:updated', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Employee ID already exists' });
    }
    console.error('Add employee error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// PUT /api/employees/:empId
// ============================
router.put('/:empId', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  const { name, department, photoUrl } = req.body;

  try {
    const result = await pool.query(
      `UPDATE employees SET
        name = COALESCE($1, name),
        department = COALESCE($2, department),
        photo_url = COALESCE($3, photo_url),
        updated_at = NOW()
       WHERE emp_id = $4
       RETURNING *`,
      [name, department, photoUrl, req.params.empId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const io = req.app.get('io');
    io.emit('employees:updated', result.rows[0]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update employee error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// DELETE /api/employees/:empId
// ============================
router.delete('/:empId', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    // Unassign devices first
    await pool.query(
      'UPDATE devices SET assigned_to = NULL, updated_at = NOW() WHERE assigned_to = $1',
      [req.params.empId]
    );

    const result = await pool.query(
      'DELETE FROM employees WHERE emp_id = $1 RETURNING *',
      [req.params.empId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const io = req.app.get('io');
    io.emit('employees:deleted', { empId: req.params.empId });

    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    console.error('Delete employee error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;