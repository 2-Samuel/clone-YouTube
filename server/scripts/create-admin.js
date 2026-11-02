/*
 * Create or promote an administrator.
 *
 * Usage:
 *   node scripts/create-admin.js <username> <email> <password>
 *   node scripts/create-admin.js --promote <username>
 *
 * You may also supply ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD env vars.
 * No administrator password is stored in source code.
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

process.chdir(path.join(__dirname, '..'));
const db = require('../db');

function fail(msg) {
  console.error('Error: ' + msg);
  process.exit(1);
}

db.reload();
const args = process.argv.slice(2);

if (args[0] === '--promote') {
  const name = args[1];
  if (!name) fail('Usage: node scripts/create-admin.js --promote <username>');
  const user = db.data.users.find((u) => u.name.toLowerCase() === name.toLowerCase());
  if (!user) fail('User not found: ' + name);
  user.role = 'admin';
  user.status = 'active';
  db.save();
  console.log('Promoted "' + user.name + '" to administrator.');
  process.exit(0);
}

const name = (args[0] || process.env.ADMIN_NAME || '').trim();
const email = (args[1] || process.env.ADMIN_EMAIL || '').trim();
const password = args[2] || process.env.ADMIN_PASSWORD || '';

if (!name || !email || !password) {
  console.log('Usage: node scripts/create-admin.js <username> <email> <password>');
  console.log('   or: node scripts/create-admin.js --promote <username>');
  process.exit(1);
}
if (name.length < 3 || name.length > 32) fail('Username must be 3-32 characters');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address');
if (password.length < 8) fail('Admin password must be at least 8 characters');

if (db.data.users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
  fail('Username already exists. Use --promote to grant administrator access.');
}
if (db.data.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
  fail('Email already registered.');
}

const user = {
  _id: uuidv4(),
  name,
  email,
  password: bcrypt.hashSync(password, 10),
  img: '',
  role: 'admin',
  status: 'active',
  subscribers: [],
  subscribedChannels: [],
  createdAt: new Date().toISOString(),
};

db.data.users.push(user);
db.save();
console.log('Administrator "' + name + '" created.');
