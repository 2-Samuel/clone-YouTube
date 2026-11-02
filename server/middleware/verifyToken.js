const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey';

function readToken(req) {
  return (
    req.headers.token ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
    ''
  );
}

const verifyToken = (req, res, next) => {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'You are not authenticated!' });

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ message: 'Token is not valid!' });
    req.user = payload;
    next();
  });
};

const verifyAdmin = (req, res, next) => {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'You are not authenticated!' });

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ message: 'Token is not valid!' });

    db.reload();
    const user = db.data.users.find((u) => u._id === payload.id);
    if (!user) return res.status(403).json({ message: 'Account not found' });
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Account suspended' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Administrator access required' });
    }

    req.user = { id: user._id, name: user.name, role: user.role };
    req.adminUser = user;
    next();
  });
};

module.exports = { verifyToken, verifyAdmin, JWT_SECRET, readToken };
