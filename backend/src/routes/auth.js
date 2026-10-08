const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Expense = require('../models/Expense');
const authenticate = require('../middleware/auth');

const router = express.Router();

function issueToken(user) {
  return jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
    subject: user._id.toString(),
    expiresIn: '7d'
  });
}

function publicUser(user) {
  return { id: user._id, email: user.email };
}

router.post('/register', async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Password must be at least 10 characters and no more than 72 bytes.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash });
    return res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Please check your email and password.' });
    }
    console.error('Registration failed:', error.message);
    return res.status(500).json({ message: 'Could not create your account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return res.status(400).json({ message: 'Enter your email and password.' });
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Password must be no more than 72 bytes.' });
  }

  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    const valid = user && await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Email or password is incorrect.' });
    return res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Login failed:', error.message);
    return res.status(500).json({ message: 'Could not sign in. Please try again.' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Your account could not be found. Please sign in again.' });
    return res.json({ user: publicUser(user) });
  } catch {
    return res.status(401).json({ message: 'Your session is invalid. Please sign in again.' });
  }
});

// Legacy records are unowned. Claiming them requires a deliberate server-side
// owner email and one-time migration token; neither value is accepted from a
// user ID supplied by the client.
router.post('/claim-legacy', authenticate, async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const ownerEmail = (process.env.LEGACY_EXPENSES_OWNER_EMAIL || '').trim().toLowerCase();
  const expected = process.env.LEGACY_EXPENSES_CLAIM_TOKEN || '';
  const supplied = typeof body.claimToken === 'string' ? body.claimToken : '';

  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  const tokenMatches = expectedBytes.length > 0 &&
    expectedBytes.length === suppliedBytes.length &&
    crypto.timingSafeEqual(expectedBytes, suppliedBytes);

  if (!ownerEmail || req.user.email !== ownerEmail || !tokenMatches) {
    return res.status(403).json({ message: 'Legacy expense claim is not enabled for this account.' });
  }

  try {
    const result = await Expense.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }] },
      { $set: { userId: req.user.id } }
    );
    return res.json({ claimed: result.modifiedCount });
  } catch (error) {
    console.error('Legacy expense claim failed:', error.message);
    return res.status(500).json({ message: 'Could not claim legacy expenses. No records were intentionally deleted.' });
  }
});

module.exports = router;
