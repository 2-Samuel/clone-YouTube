const express = require('express');
const { verifyToken } = require('../middleware/verifyToken');
const db = require('../db');

const router = express.Router();

router.get('/find/:id', (req, res) => {
  db.reload();
  const user = db.data.users.find((u) => u._id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { password, ...others } = user;
  res.json(others);
});

router.put('/:id/subscribe', verifyToken, (req, res) => {
  if (req.user.id === req.params.id) {
    return res.status(403).json({ message: 'You cannot subscribe to your own channel.' });
  }
  db.reload();
  const user = db.data.users.find((u) => u._id === req.params.id);
  const currentUser = db.data.users.find((u) => u._id === req.user.id);
  if (!user || !currentUser) return res.status(404).json({ message: 'User not found' });

  if (!user.subscribers.includes(req.user.id)) {
    user.subscribers.push(req.user.id);
  }
  if (!currentUser.subscribedChannels.includes(req.params.id)) {
    currentUser.subscribedChannels.push(req.params.id);
  }
  db.save();
  res.json({ message: 'Subscription successful.' });
});

router.put('/:id/unsubscribe', verifyToken, (req, res) => {
  if (req.user.id === req.params.id) {
    return res.status(403).json({ message: 'You cannot unsubscribe from your own channel.' });
  }
  db.reload();
  const user = db.data.users.find((u) => u._id === req.params.id);
  const currentUser = db.data.users.find((u) => u._id === req.user.id);
  if (!user || !currentUser) return res.status(404).json({ message: 'User not found' });

  user.subscribers = user.subscribers.filter((x) => x !== req.user.id);
  currentUser.subscribedChannels = currentUser.subscribedChannels.filter(
    (x) => x !== req.params.id
  );
  db.save();
  res.json({ message: 'Unsubscription successful.' });
});

module.exports = router;
