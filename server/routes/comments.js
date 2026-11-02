const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../middleware/verifyToken');
const db = require('../db');

const router = express.Router();

router.post('/', verifyToken, (req, res) => {
  db.reload();
  const videoId = String(req.body.videoId || '');
  const desc = String(req.body.desc || '').trim();
  if (!videoId || !desc) {
    return res.status(400).json({ message: 'videoId and desc required' });
  }
  if (desc.length > 2000) {
    return res.status(400).json({ message: 'Comment is too long' });
  }
  const video = db.data.videos.find((v) => v._id === videoId);
  if (!video) return res.status(404).json({ message: 'Video not found' });

  const comment = {
    _id: uuidv4(),
    userId: req.user.id,
    videoId,
    desc,
    createdAt: new Date().toISOString(),
  };
  db.data.comments.push(comment);
  db.save();
  res.status(200).json(comment);
});

router.post('/:id/report', verifyToken, (req, res) => {
  db.reload();
  const comment = db.data.comments.find((c) => c._id === req.params.id);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  if (comment.userId === req.user.id) {
    return res.status(400).json({ message: 'You cannot report your own comment' });
  }

  const reason = String(req.body.reason || '').trim().slice(0, 500) || 'No reason provided';
  if (
    db.data.reports.some(
      (r) => r.commentId === comment._id && r.reporterId === req.user.id && r.status === 'open'
    )
  ) {
    return res.status(409).json({ message: 'You already reported this comment' });
  }

  const report = {
    _id: uuidv4(),
    commentId: comment._id,
    reporterId: req.user.id,
    reason,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  db.data.reports.push(report);
  db.save();
  res.status(200).json(report);
});

router.delete('/:id', verifyToken, (req, res) => {
  db.reload();
  const comment = db.data.comments.find((c) => c._id === req.params.id);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });

  const user = db.data.users.find((u) => u._id === req.user.id);
  const isOwner = comment.userId === req.user.id;
  const isAdmin = user && user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ message: 'You can delete only your comment!' });
  }

  db.data.comments = db.data.comments.filter((c) => c._id !== req.params.id);
  db.data.reports = db.data.reports.filter((r) => r.commentId !== req.params.id);
  db.save();
  res.json({ message: 'The comment has been deleted.' });
});

router.get('/:videoId', (req, res) => {
  db.reload();
  const comments = db.data.comments
    .filter((c) => c.videoId === req.params.videoId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(comments);
});

module.exports = router;
