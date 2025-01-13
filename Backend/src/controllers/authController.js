const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { hashPassword, comparePassword } = require('../utils/hashPassword');
const sendEmail = require('../utils/emailSender');

require('dotenv').config();

// Signup
exports.signup = async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
      [email, hashedPassword]
    );
    res.status(201).json({ message: 'User registered', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error registering user' });
  }
};

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];
    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

    const resetToken = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await pool.query('UPDATE users SET reset_token = $1 WHERE email = $2', [resetToken, email]);

    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
    await sendEmail(email, 'Password Reset', `Reset your password using this link: ${resetLink}`);

    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Error sending email' });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hashedPassword = await hashPassword(newPassword);

    await pool.query('UPDATE users SET password = $1, reset_token = NULL WHERE id = $2', [
      hashedPassword,
      decoded.id,
    ]);

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Invalid or expired token' });
  }
};
