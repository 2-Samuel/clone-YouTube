const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/verifyToken');

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }
    if (name.length < 3 || name.length > 32) {
      return res.status(400).json({ message: 'Username must be 3-32 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }

    db.reload();
    if (db.data.users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ message: 'Username already taken' });
    }
    if (db.data.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = {
      _id: uuidv4(),
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      img: '',
      role: 'user',
      status: 'active',
      subscribers: [],
      subscribedChannels: [],
      createdAt: new Date().toISOString(),
    };
    db.data.users.push(user);
    db.save();
    res.status(200).json({ message: 'User has been created!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');

    db.reload();
    const user = db.data.users.find(
      (u) =>
        (name && u.name.toLowerCase() === name.toLowerCase()) ||
        (email && u.email.toLowerCase() === email.toLowerCase())
    );
    if (!user) return res.status(404).json({ message: 'User not found!' });
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'This account has been suspended.' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Wrong credentials!' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    const { password: _pw, ...others } = user;
    res.status(200).json({ token, user: others });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
