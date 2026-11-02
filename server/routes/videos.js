const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { verifyToken, JWT_SECRET } = require('../middleware/verifyToken');
const db = require('../db');
const { isPublicVideo, sortByPublishedDesc } = require('../utils/videos');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video' && /^video\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only video files are allowed'));
  },
});

function optionalUser(req) {
  const token =
    req.headers.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    db.reload();
    return db.data.users.find((u) => u._id === payload.id) || null;
  } catch (e) {
    return null;
  }
}

router.post('/upload', verifyToken, upload.single('video'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No video file provided' });

    db.reload();
    const settings = db.data.settings;
    if (!settings.allowUserUploads) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'User uploads are currently disabled' });
    }

    const user = db.data.users.find((u) => u._id === req.user.id);
    if (!user) return res.status(403).json({ message: 'Account not found' });
    if (user.status === 'suspended') {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'Account suspended' });
    }

    const title = String(req.body.title || '').trim();
    if (!title) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Title is required' });
    }

    const pending = settings.requireApproval === true;
    const now = new Date().toISOString();
    const category = String(req.body.category || 'Other').trim() || 'Other';

    const video = {
      _id: uuidv4(),
      userId: req.user.id,
      title: title.slice(0, 150),
      description: String(req.body.description || '').slice(0, 5000),
      videoUrl: '/uploads/' + req.file.filename,
      imgUrl: String(req.body.imgUrl || ''),
      views: 0,
      likes: [],
      dislikes: [],
      tags: req.body.tags
        ? String(req.body.tags)
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 15)
        : [],
      category,
      status: pending ? 'pending' : 'published',
      visibility: 'public',
      featured: false,
      publishedAt: pending ? null : now,
      createdAt: now,
      processingStatus: 'ready',
      fileSize: req.file.size,
    };

    if (!db.data.categories.includes(category)) db.data.categories.push(category);
    db.data.videos.push(video);
    db.save();
    res.status(200).json(video);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/random', (req, res) => {
  db.reload();
  const videos = db.data.videos
    .filter((v) => isPublicVideo(v))
    .sort(() => Math.random() - 0.5)
    .slice(0, 40);
  res.json(videos);
});

router.get('/trend', (req, res) => {
  db.reload();
  const videos = db.data.videos
    .filter((v) => isPublicVideo(v))
    .sort((a, b) => b.views - a.views);
  res.json(videos);
});

router.get('/sub', verifyToken, (req, res) => {
  db.reload();
  const user = db.data.users.find((u) => u._id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const videos = db.data.videos
    .filter((v) => isPublicVideo(v) && user.subscribedChannels.includes(v.userId))
    .sort(sortByPublishedDesc);
  res.json(videos);
});

router.get('/tags', (req, res) => {
  db.reload();
  const tags = String(req.query.tags || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const videos = db.data.videos
    .filter((v) => isPublicVideo(v) && v.tags.some((t) => tags.includes(t)))
    .slice(0, 20);
  res.json(videos);
});

router.get('/search', (req, res) => {
  db.reload();
  const q = String(req.query.q || '').toLowerCase();
  const videos = db.data.videos
    .filter(
      (v) =>
        isPublicVideo(v) &&
        (v.title.toLowerCase().includes(q) ||
          String(v.description || '').toLowerCase().includes(q) ||
          (v.tags || []).some((t) => t.includes(q)))
    )
    .slice(0, 40);
  res.json(videos);
});

router.get('/find/:id', (req, res) => {
  db.reload();
  const video = db.data.videos.find((v) => v._id === req.params.id);
  if (!video) return res.status(404).json({ message: 'Video not found' });

  if (isPublicVideo(video)) return res.json(video);

  const viewer = optionalUser(req);
  if (viewer && (viewer._id === video.userId || viewer.role === 'admin')) {
    return res.json({ ...video, _preview: true });
  }
  return res.status(404).json({ message: 'Video not found' });
});

router.put('/view/:id', (req, res) => {
  db.reload();
  const video = db.data.videos.find((v) => v._id === req.params.id);
  if (!video) return res.status(404).json({ message: 'Video not found' });
  video.views += 1;
  db.data.viewEvents.push({
    videoId: video._id,
    at: new Date().toISOString(),
  });
  if (db.data.viewEvents.length > 200000) db.data.viewEvents.splice(0, 50000);
  db.save();
  res.json({ message: 'The view has been increased.' });
});

router.put('/like/:videoId', verifyToken, (req, res) => {
  db.reload();
  const id = req.user.id;
  const video = db.data.videos.find((v) => v._id === req.params.videoId);
  if (!video) return res.status(404).json({ message: 'Video not found' });
  video.likes = video.likes.filter((x) => x !== id);
  video.dislikes = video.dislikes.filter((x) => x !== id);
  video.likes.push(id);
  db.save();
  res.json({ message: 'The video has been liked.' });
});

router.put('/dislike/:videoId', verifyToken, (req, res) => {
  db.reload();
  const id = req.user.id;
  const video = db.data.videos.find((v) => v._id === req.params.videoId);
  if (!video) return res.status(404).json({ message: 'Video not found' });
  video.likes = video.likes.filter((x) => x !== id);
  video.dislikes = video.dislikes.filter((x) => x !== id);
  video.dislikes.push(id);
  db.save();
  res.json({ message: 'The video has been disliked.' });
});

module.exports = router;
