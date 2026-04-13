const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../db/index.cjs');
const { authMiddleware, requireRole } = require('../middleware/auth.cjs');
const nodemailer = require('nodemailer');

// ============================
// EMAIL TRANSPORTER
// ============================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const generateToken = () => crypto.randomBytes(32).toString('hex');

const sendAccountCreatedEmail = async (email, name, username, token) => {
  const url = `${process.env.APP_URL}/activate?token=${token}`;
  await transporter.sendMail({
    from: `"Minet LAP Tracker" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Minet LAP Tracker — Set Your Password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
        <h2 style="color:#e21a22;">Minet LAP Tracker</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your account has been created. Your login username is:</p>
        <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #e21a22;">
          <p style="margin:0;font-size:1.1rem;"><strong>Username:</strong> ${username}</p>
        </div>
        <p>Click the button below to set your password and activate your account:</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${url}" style="background:#e21a22;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:1rem;display:inline-block;">
            Set My Password
          </a>
        </div>
        <p style="color:#64748b;font-size:0.9rem;">Or copy this link:<br/>
          <a href="${url}" style="color:#1a56db;word-break:break-all;">${url}</a>
        </p>
        <div style="background:#fff7ed;border:1px solid #fed7aa;padding:12px 16px;border-radius:6px;margin:24px 0;">
          <p style="margin:0;font-size:0.85rem;color:#9a3412;">
            This link expires in <strong>24 hours</strong> and can only be used once.
          </p>
        </div>
      </div>`
  });
};

const sendPasswordResetEmail = async (email, name, username, token) => {
  const url = `${process.env.APP_URL}/activate?token=${token}`;
  await transporter.sendMail({
    from: `"Minet LAP Tracker" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Minet LAP Tracker — Password Reset',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
        <h2 style="color:#e21a22;">Minet LAP Tracker</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>A password reset has been requested for your account (<strong>${username}</strong>).</p>
        <p>Click the button below to set a new password:</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${url}" style="background:#e21a22;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:1rem;display:inline-block;">
            Reset My Password
          </a>
        </div>
        <p style="color:#64748b;font-size:0.9rem;">Or copy this link:<br/>
          <a href="${url}" style="color:#1a56db;word-break:break-all;">${url}</a>
        </p>
        <div style="background:#fff7ed;border:1px solid #fed7aa;padding:12px 16px;border-radius:6px;margin:24px 0;">
          <p style="margin:0;font-size:0.85rem;color:#9a3412;">
            This link expires in <strong>24 hours</strong> and can only be used once.
          </p>
        </div>
      </div>`
  });
};

// ============================
// GET /api/users
// ============================
router.get('/', authMiddleware, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, name, role, emp_id,
              is_active, must_set_password, last_login,
              last_password_change, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/users
// Create a new system user
// ============================
router.post('/', authMiddleware, requireRole('superadmin'), async (req, res) => {
  const { name, email, role, empId } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ error: 'name, email and role are required' });
  }

  try {
    // Generate username: lastName + firstLetterOfFirstName
    const parts = name.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
    let baseUsername = (lastName + (firstName ? firstName[0] : ''))
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();

    // Ensure username is unique
    let username = baseUsername;
    let counter = 1;
    while (true) {
      const existing = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      if (existing.rows.length === 0) break;
      username = baseUsername + counter++;
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) +
      Math.random().toString(36).toUpperCase().slice(-4) + '!';

    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const createdBy = req.user.name || req.user.username;

    const result = await pool.query(
      `INSERT INTO users (
        username, email, name, role, emp_id,
        password_hash, must_set_password,
        is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE, $7)
      RETURNING id, username, email, name, role, emp_id, 
                is_active, must_set_password, created_at`,
      [username, email, name, role, empId || null, passwordHash, createdBy]
    );

    // Send credentials email
    try {
      await sendPasswordEmail(email, name, username, tempPassword);
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      // Don't fail the request if email fails
    }

    const io = req.app.get('io');
    io.emit('users:updated', result.rows[0]);

    res.status(201).json({
      ...result.rows[0],
      tempPassword // Return temp password in response for admin to share manually if email fails
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// PUT /api/users/:id
// Update a user
// ============================
router.put('/:id', authMiddleware, requireRole('superadmin'), async (req, res) => {
  const { name, email, role, empId, isActive } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        emp_id = COALESCE($4, emp_id),
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
       WHERE id = $6
       RETURNING id, username, email, name, role,
                 emp_id, is_active, must_set_password`,
      [name, email, role, empId, isActive, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const io = req.app.get('io');
    io.emit('users:updated', result.rows[0]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// DELETE /api/users/:id
// ============================
router.delete('/:id', authMiddleware, requireRole('superadmin'), async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const io = req.app.get('io');
    io.emit('users:deleted', { id: req.params.id });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================
// POST /api/users/:id/reset-password
// Superadmin resets a user's password
// ============================
router.post('/:id/reset-password', authMiddleware, requireRole('superadmin'), async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.params.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Generate new temp password
    const tempPassword = Math.random().toString(36).slice(-8) +
      Math.random().toString(36).toUpperCase().slice(-4) + '!';

    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await pool.query(
      `UPDATE users SET
        password_hash = $1,
        must_set_password = TRUE,
        password_reset_required = TRUE,
        updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, req.params.id]
    );

    // Send new credentials email
    try {
      await sendPasswordEmail(user.email, user.name, user.username, tempPassword);
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
    }

    res.json({
      message: 'Password reset successfully',
      tempPassword // Return for manual sharing if email fails
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;