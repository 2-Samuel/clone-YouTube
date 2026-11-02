const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { verifyAdmin } = require('../middleware/verifyToken');
const db = require('../db');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const VIDEO_EXT = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.mkv', '.avi', '.m4v']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'video') {
      if (/^video\//.test(file.mimetype) && VIDEO_EXT.has(ext)) return cb(null, true);
      return cb(new Error('Invalid video file type'));
    }
    if (file.fieldname === 'thumbnail') {
      if (/^image\//.test(file.mimetype) && IMAGE_EXT.has(ext)) return cb(null, true);
      return cb(new Error('Invalid thumbnail image type'));
    }
    return cb(new Error('Unexpected upload field'));
  },
});

const uploadFields = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

router.use(verifyAdmin);

const nowIso = () => new Date().toISOString();

function audit(req, action, target, detail) {
  db.data.audit.unshift({
    _id: uuidv4(),
    at: nowIso(),
    adminId: req.user.id,
    adminName: req.user.name,
    action,
    target: target || '',
    detail: detail || '',
  });
  if (db.data.audit.length > 1000) db.data.audit.length = 1000;
}

function stripUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

function fileForUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  const name = path.basename(url);
  const full = path.join(uploadDir, name);
  if (!full.startsWith(uploadDir)) return null;
  return full;
}

function removeUploaded(url) {
  const full = fileForUrl(url);
  if (full && fs.existsSync(full)) {
    try { fs.unlinkSync(full); } catch (e) { /* ignore */ }
  }
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 15);
  }
  if (!value) return [];
  return String(value)
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 15);
}

function boolValue(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1' || value === 'on';
}

function intParam(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function daysBack(days) {
  const arr = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    arr.push(new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10));
  }
  return arr;
}

function countByDay(items, dateGetter, labels) {
  const map = new Map(labels.map((l) => [l, 0]));
  for (const item of items) {
    const raw = dateGetter(item);
    if (!raw) continue;
    const key = new Date(raw).toISOString().slice(0, 10);
    if (map.has(key)) map.set(key, map.get(key) + 1);
  }
  return labels.map((l) => map.get(l));
}

function categoryStats() {
  const map = new Map();
  for (const v of db.data.videos) {
    const key = v.category || 'Other';
    if (!map.has(key)) map.set(key, { category: key, videos: 0, views: 0 });
    const row = map.get(key);
    row.videos += 1;
    row.views += v.views || 0;
  }
  return Array.from(map.values()).sort((a, b) => b.videos - a.videos);
}

function userBreakdown() {
  const active = db.data.users.filter((u) => u.status === 'active').length;
  const suspended = db.data.users.filter((u) => u.status === 'suspended').length;
  const admins = db.data.users.filter((u) => u.role === 'admin').length;
  return { active, suspended, admins, regular: db.data.users.length - admins };
}

function totals() {
  let views = 0;
  let likes = 0;
  let dislikes = 0;
  let published = 0;
  let drafts = 0;
  let pending = 0;
  for (const v of db.data.videos) {
    views += v.views || 0;
    likes += (v.likes || []).length;
    dislikes += (v.dislikes || []).length;
    if (v.status === 'published') published += 1;
    if (v.status === 'draft') drafts += 1;
    if (v.status === 'pending') pending += 1;
  }
  const subscriptions = db.data.users.reduce(
    (sum, u) => sum + (u.subscribedChannels || []).length,
    0
  );
  return {
    views,
    videos: db.data.videos.length,
    published,
    drafts,
    pending,
    users: db.data.users.length,
    admins: db.data.users.filter((u) => u.role === 'admin').length,
    suspended: db.data.users.filter((u) => u.status === 'suspended').length,
    comments: db.data.comments.length,
    likes,
    dislikes,
    subscriptions,
    openReports: db.data.reports.filter((r) => r.status === 'open').length,
  };
}

function uploaderName(video) {
  const u = db.data.users.find((x) => x._id === video.userId);
  return u ? u.name : 'Unknown';
}

function adminVideo(v, index) {
  return {
    ...v,
    uploaderName: uploaderName(v),
    rating: (v.likes || []).length,
    position: index,
  };
}

function sortVideos(items, sort) {
  const list = [...items];
  switch (sort) {
    case 'oldest':
      return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case 'views':
      return list.sort((a, b) => (b.views || 0) - (a.views || 0));
    case 'title':
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case 'newest':
    default:
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

/* ---------------- session ---------------- */

router.get('/me', (req, res) => {
  res.json(stripUser(req.adminUser));
});

/* ---------------- dashboard ---------------- */

router.get('/dashboard', (req, res) => {
  db.reload();
  const labels = daysBack(30);
  const topVideos = [...db.data.videos]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 6)
    .map(adminVideo);
  const recentVideos = [...db.data.videos]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map(adminVideo);

  const viewEvents = db.data.viewEvents;
  const viewsTrackedSince = viewEvents.length
    ? viewEvents.reduce((min, e) => (e.at < min ? e.at : min), viewEvents[0].at)
    : null;

  const now = Date.now();
  const newUsers7 = db.data.users.filter(
    (u) => now - new Date(u.createdAt).getTime() <= 7 * 86400000
  ).length;
  const newUsers30 = db.data.users.filter(
    (u) => now - new Date(u.createdAt).getTime() <= 30 * 86400000
  ).length;

  res.json({
    totals: totals(),
    topVideos,
    recentVideos,
    categoryStats: categoryStats(),
    userBreakdown: userBreakdown(),
    newUsers: { last7: newUsers7, last30: newUsers30 },
    series: {
      labels,
      views: countByDay(viewEvents, (e) => e.at, labels),
      uploads: countByDay(db.data.videos, (v) => v.createdAt, labels),
      users: countByDay(db.data.users, (u) => u.createdAt, labels),
    },
    viewsTrackedSince,
    settings: db.data.settings,
  });
});

router.get('/analytics', (req, res) => {
  db.reload();
  const days = intParam(req.query.days, 30, 7, 365);
  const labels = daysBack(days);
  const viewEvents = db.data.viewEvents.filter(
    (e) => labels.includes(new Date(e.at).toISOString().slice(0, 10))
  );

  const topVideos = [...db.data.videos]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 10)
    .map(adminVideo);

  const viewsTrackedSince = db.data.viewEvents.length
    ? db.data.viewEvents.reduce((min, e) => (e.at < min ? e.at : min), db.data.viewEvents[0].at)
    : null;

  res.json({
    days,
    labels,
    views: countByDay(viewEvents, (e) => e.at, labels),
    uploads: countByDay(db.data.videos, (v) => v.createdAt, labels),
    users: countByDay(db.data.users, (u) => u.createdAt, labels),
    topVideos,
    categories: categoryStats(),
    engagement: totals(),
    viewsTrackedSince,
  });
});

/* ---------------- videos ---------------- */

router.get('/videos', (req, res) => {
  db.reload();
  const q = String(req.query.q || '').toLowerCase().trim();
  const status = String(req.query.status || '');
  const visibility = String(req.query.visibility || '');
  const category = String(req.query.category || '');
  const uploader = String(req.query.uploader || '');
  const from = req.query.from ? new Date(req.query.from).getTime() : null;
  const to = req.query.to ? new Date(req.query.to).getTime() + 86399999 : null;
  const sort = String(req.query.sort || 'newest');
  const page = intParam(req.query.page, 1, 1, 100000);
  const limit = intParam(req.query.limit, 10, 1, 100);

  let items = db.data.videos.filter((v) => {
    if (q && !`${v.title} ${v.description || ''} ${(v.tags || []).join(' ')}`.toLowerCase().includes(q)) {
      return false;
    }
    if (status && v.status !== status) return false;
    if (visibility && v.visibility !== visibility) return false;
    if (category && v.category !== category) return false;
    if (uploader) {
      const u = db.data.users.find((x) => x._id === v.userId);
      if (!u || (!u.name.toLowerCase().includes(uploader.toLowerCase()) && u._id !== uploader)) {
        return false;
      }
    }
    if (from && new Date(v.createdAt).getTime() < from) return false;
    if (to && new Date(v.createdAt).getTime() > to) return false;
    return true;
  });

  items = sortVideos(items, sort);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  const slice = items.slice((safePage - 1) * limit, safePage * limit).map(adminVideo);

  res.json({ items: slice, total, page: safePage, pages, limit });
});

function requireVideo(req, res) {
  const video = db.data.videos.find((v) => v._id === req.params.id);
  if (!video) {
    res.status(404).json({ message: 'Video not found' });
    return null;
  }
  return video;
}

router.post('/videos', uploadFields, (req, res) => {
  try {
    db.reload();
    const videoFile = req.files && req.files.video ? req.files.video[0] : null;
    const thumbFile = req.files && req.files.thumbnail ? req.files.thumbnail[0] : null;

    if (!videoFile) return res.status(400).json({ message: 'A video file is required' });

    const title = String(req.body.title || '').trim();
    if (!title) {
      removeUploaded('/uploads/' + videoFile.filename);
      if (thumbFile) removeUploaded('/uploads/' + thumbFile.filename);
      return res.status(400).json({ message: 'Title is required' });
    }

    const status = ['draft', 'published'].includes(req.body.status)
      ? req.body.status
      : 'draft';
    const visibility = ['public', 'unlisted', 'private'].includes(req.body.visibility)
      ? req.body.visibility
      : 'public';
    const category = String(req.body.category || 'Other').trim() || 'Other';
    const featured = boolValue(req.body.featured, false);

    let publishedAt = null;
    let scheduledAt = null;
    if (req.body.scheduledAt) {
      const d = new Date(req.body.scheduledAt);
      if (!Number.isNaN(d.getTime())) scheduledAt = d.toISOString();
    }
    if (status === 'published') publishedAt = scheduledAt || nowIso();

    const now = nowIso();
    const video = {
      _id: uuidv4(),
      userId: req.user.id,
      title: title.slice(0, 150),
      description: String(req.body.description || '').slice(0, 5000),
      videoUrl: '/uploads/' + videoFile.filename,
      imgUrl: thumbFile ? '/uploads/' + thumbFile.filename : String(req.body.imgUrl || ''),
      views: 0,
      likes: [],
      dislikes: [],
      tags: parseTags(req.body.tags),
      category,
      status,
      visibility,
      featured,
      scheduledAt,
      publishedAt,
      createdAt: now,
      processingStatus: 'ready',
      fileSize: videoFile.size,
    };

    if (!db.data.categories.includes(category)) db.data.categories.push(category);
    db.data.videos.push(video);
    audit(req, 'video.upload', video._id, `${video.title} (${status})`);
    db.save();
    res.status(200).json(adminVideo(video));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/videos/:id', uploadFields, (req, res) => {
  try {
    db.reload();
    const video = requireVideo(req, res);
    if (!video) return;

    const thumbFile = req.files && req.files.thumbnail ? req.files.thumbnail[0] : null;
    const newVideoFile = req.files && req.files.video ? req.files.video[0] : null;

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) return res.status(400).json({ message: 'Title cannot be empty' });
      video.title = title.slice(0, 150);
    }
    if (req.body.description !== undefined) {
      video.description = String(req.body.description).slice(0, 5000);
    }
    if (req.body.category !== undefined) {
      const category = String(req.body.category).trim() || 'Other';
      video.category = category;
      if (!db.data.categories.includes(category)) db.data.categories.push(category);
    }
    if (req.body.tags !== undefined) video.tags = parseTags(req.body.tags);
    if (req.body.visibility !== undefined) {
      if (!['public', 'unlisted', 'private'].includes(req.body.visibility)) {
        return res.status(400).json({ message: 'Invalid visibility value' });
      }
      video.visibility = req.body.visibility;
    }
    if (req.body.featured !== undefined) video.featured = boolValue(req.body.featured, video.featured);
    if (req.body.scheduledAt !== undefined) {
      if (!req.body.scheduledAt) {
        video.scheduledAt = null;
      } else {
        const d = new Date(req.body.scheduledAt);
        if (!Number.isNaN(d.getTime())) video.scheduledAt = d.toISOString();
      }
    }
    if (req.body.status !== undefined) {
      if (!['draft', 'published', 'pending'].includes(req.body.status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      video.status = req.body.status;
      if (video.status === 'published') {
        video.publishedAt = video.scheduledAt || video.publishedAt || nowIso();
      } else {
        video.publishedAt = null;
      }
    }

    if (newVideoFile) {
      const old = video.videoUrl;
      video.videoUrl = '/uploads/' + newVideoFile.filename;
      video.fileSize = newVideoFile.size;
      removeUploaded(old);
    }
    if (thumbFile) {
      const old = video.imgUrl;
      video.imgUrl = '/uploads/' + thumbFile.filename;
      removeUploaded(old);
    } else if (req.body.imgUrl !== undefined) {
      video.imgUrl = String(req.body.imgUrl);
    }

    audit(req, 'video.update', video._id, video.title);
    db.save();
    res.status(200).json(adminVideo(video));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/videos/:id', (req, res) => {
  db.reload();
  const video = requireVideo(req, res);
  if (!video) return;

  const commentIds = new Set(
    db.data.comments.filter((c) => c.videoId === video._id).map((c) => c._id)
  );
  db.data.comments = db.data.comments.filter((c) => c.videoId !== video._id);
  db.data.reports = db.data.reports.filter((r) => !commentIds.has(r.commentId));
  db.data.viewEvents = db.data.viewEvents.filter((e) => e.videoId !== video._id);
  db.data.videos = db.data.videos.filter((v) => v._id !== video._id);
  removeUploaded(video.videoUrl);
  removeUploaded(video.imgUrl);

  audit(req, 'video.delete', video._id, video.title);
  db.save();
  res.json({ message: 'Video deleted' });
});

/* ---------------- users ---------------- */

router.get('/users', (req, res) => {
  db.reload();
  const q = String(req.query.q || '').toLowerCase().trim();
  const role = String(req.query.role || '');
  const status = String(req.query.status || '');
  const page = intParam(req.query.page, 1, 1, 100000);
  const limit = intParam(req.query.limit, 10, 1, 100);
  const sort = String(req.query.sort || 'newest');

  let items = db.data.users.filter((u) => {
    if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
    if (role && u.role !== role) return false;
    if (status && u.status !== status) return false;
    return true;
  });

  const enriched = items.map((u) => ({
    ...stripUser(u),
    publicSubscribers: (u.subscribers || []).length,
    subscriptions: (u.subscribedChannels || []).length,
    videoCount: db.data.videos.filter((v) => v.userId === u._id).length,
  }));

  if (sort === 'name') enriched.sort((a, b) => a.name.localeCompare(b.name));
  else enriched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = enriched.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  res.json({
    items: enriched.slice((safePage - 1) * limit, safePage * limit),
    total,
    page: safePage,
    pages,
    limit,
  });
});

router.get('/users/:id', (req, res) => {
  db.reload();
  const user = db.data.users.find((u) => u._id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const videos = db.data.videos
    .filter((v) => v.userId === user._id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20)
    .map(adminVideo);
  res.json({
    user: {
      ...stripUser(user),
      videoCount: db.data.videos.filter((v) => v.userId === user._id).length,
      publicSubscribers: (user.subscribers || []).length,
      subscriptions: (user.subscribedChannels || []).length,
    },
    videos,
  });
});

function activeAdminCount() {
  return db.data.users.filter((u) => u.role === 'admin' && u.status === 'active').length;
}

router.put('/users/:id/role', (req, res) => {
  db.reload();
  const user = db.data.users.find((u) => u._id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const role = String(req.body.role || '');
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  if (user._id === req.user.id) {
    return res.status(400).json({ message: 'You cannot change your own role' });
  }
  if (user.role === 'admin' && role === 'user') {
    if (user.status === 'active' && activeAdminCount() <= 1) {
      return res.status(400).json({ message: 'Cannot remove the last active administrator' });
    }
  }
  const previous = user.role;
  user.role = role;
  audit(req, 'user.role', user._id, `${user.name}: ${previous} -> ${role}`);
  db.save();
  res.json({ message: 'Role updated', user: stripUser(user) });
});

router.put('/users/:id/status', (req, res) => {
  db.reload();
  const user = db.data.users.find((u) => u._id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const status = String(req.body.status || '');
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  if (user._id === req.user.id) {
    return res.status(400).json({ message: 'You cannot suspend your own account' });
  }
  if (
    status === 'suspended' &&
    user.role === 'admin' &&
    user.status === 'active' &&
    activeAdminCount() <= 1
  ) {
    return res.status(400).json({ message: 'Cannot suspend the last active administrator' });
  }
  const previous = user.status;
  user.status = status;
  audit(req, 'user.status', user._id, `${user.name}: ${previous} -> ${status}`);
  db.save();
  res.json({ message: 'Account status updated', user: stripUser(user) });
});

/* ---------------- categories & tags ---------------- */

router.get('/categories', (req, res) => {
  db.reload();
  const counts = categoryStats();
  const map = new Map(counts.map((c) => [c.category, c]));
  const items = db.data.categories
    .map((name) => map.get(name) || { category: name, videos: 0, views: 0 })
    .map((c) => ({ name: c.category, videos: c.videos, views: c.views }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(items);
});

router.post('/categories', (req, res) => {
  db.reload();
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Category name is required' });
  if (name.length > 40) return res.status(400).json({ message: 'Category name is too long' });
  if (db.data.categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ message: 'Category already exists' });
  }
  db.data.categories.push(name);
  audit(req, 'category.create', name);
  db.save();
  res.status(200).json({ name });
});

router.delete('/categories/:name', (req, res) => {
  db.reload();
  const name = req.params.name;
  const used = db.data.videos.filter((v) => v.category === name).length;
  if (used > 0) {
    return res.status(400).json({ message: `Category is used by ${used} video(s)` });
  }
  if (!db.data.categories.includes(name)) {
    return res.status(404).json({ message: 'Category not found' });
  }
  db.data.categories = db.data.categories.filter((c) => c !== name);
  audit(req, 'category.delete', name);
  db.save();
  res.json({ message: 'Category deleted' });
});

router.get('/tags', (req, res) => {
  db.reload();
  const map = new Map();
  for (const v of db.data.videos) {
    for (const tag of v.tags || []) {
      if (!map.has(tag)) map.set(tag, { tag, videos: 0, views: 0 });
      const row = map.get(tag);
      row.videos += 1;
      row.views += v.views || 0;
    }
  }
  res.json(Array.from(map.values()).sort((a, b) => b.videos - a.videos));
});

/* ---------------- comments & reports ---------------- */

router.get('/comments', (req, res) => {
  db.reload();
  const q = String(req.query.q || '').toLowerCase().trim();
  const page = intParam(req.query.page, 1, 1, 100000);
  const limit = intParam(req.query.limit, 12, 1, 100);

  const userMap = new Map(db.data.users.map((u) => [u._id, u]));
  const videoMap = new Map(db.data.videos.map((v) => [v._id, v]));

  let items = db.data.comments.map((c) => {
    const u = userMap.get(c.userId);
    const v = videoMap.get(c.videoId);
    return {
      ...c,
      userName: u ? u.name : 'Unknown',
      videoTitle: v ? v.title : 'Deleted video',
      reportCount: db.data.reports.filter((r) => r.commentId === c._id && r.status === 'open').length,
    };
  });

  if (q) {
    items = items.filter((c) =>
      `${c.desc} ${c.userName} ${c.videoTitle}`.toLowerCase().includes(q)
    );
  }
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  res.json({
    items: items.slice((safePage - 1) * limit, safePage * limit),
    total,
    page: safePage,
    pages,
    limit,
  });
});

router.delete('/comments/:id', (req, res) => {
  db.reload();
  const comment = db.data.comments.find((c) => c._id === req.params.id);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  db.data.comments = db.data.comments.filter((c) => c._id !== comment._id);
  db.data.reports = db.data.reports.filter((r) => r.commentId !== comment._id);
  audit(req, 'comment.delete', comment._id, comment.desc.slice(0, 80));
  db.save();
  res.json({ message: 'Comment deleted' });
});

router.get('/reports', (req, res) => {
  db.reload();
  const userMap = new Map(db.data.users.map((u) => [u._id, u]));
  const commentMap = new Map(db.data.comments.map((c) => [c._id, c]));
  const videoMap = new Map(db.data.videos.map((v) => [v._id, v]));

  const items = db.data.reports
    .filter((r) => r.status === 'open')
    .map((r) => {
      const comment = commentMap.get(r.commentId);
      const reporter = userMap.get(r.reporterId);
      const video = comment ? videoMap.get(comment.videoId) : null;
      const commentUser = comment ? userMap.get(comment.userId) : null;
      return {
        ...r,
        commentText: comment ? comment.desc : 'Comment removed',
        commentExists: Boolean(comment),
        commentUserName: commentUser ? commentUser.name : 'Unknown',
        videoId: comment ? comment.videoId : null,
        videoTitle: video ? video.title : 'Unknown video',
        reporterName: reporter ? reporter.name : 'Unknown',
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ items, total: items.length });
});

router.delete('/reports/:id', (req, res) => {
  db.reload();
  const report = db.data.reports.find((r) => r._id === req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found' });
  db.data.reports = db.data.reports.filter((r) => r._id !== report._id);
  audit(req, 'report.dismiss', report._id);
  db.save();
  res.json({ message: 'Report dismissed' });
});

/* ---------------- settings & profile ---------------- */

router.get('/settings', (req, res) => {
  db.reload();
  res.json(db.data.settings);
});

router.put('/settings', (req, res) => {
  db.reload();
  const body = req.body || {};
  const settings = db.data.settings;

  if (body.siteName !== undefined) {
    const siteName = String(body.siteName).trim();
    if (siteName.length < 2 || siteName.length > 40) {
      return res.status(400).json({ message: 'Site name must be 2-40 characters' });
    }
    settings.siteName = siteName;
  }
  if (body.allowUserUploads !== undefined) {
    settings.allowUserUploads = boolValue(body.allowUserUploads, settings.allowUserUploads);
  }
  if (body.requireApproval !== undefined) {
    settings.requireApproval = boolValue(body.requireApproval, settings.requireApproval);
  }

  audit(req, 'settings.update', 'site', JSON.stringify(settings));
  db.save();
  res.json(settings);
});

router.put('/profile', async (req, res) => {
  db.reload();
  const admin = db.data.users.find((u) => u._id === req.user.id);
  if (!admin) return res.status(404).json({ message: 'Account not found' });

  const body = req.body || {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 3 || name.length > 32) {
      return res.status(400).json({ message: 'Name must be 3-32 characters' });
    }
    if (
      db.data.users.some(
        (u) => u._id !== admin._id && u.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      return res.status(409).json({ message: 'Username already taken' });
    }
    admin.name = name;
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }
    if (
      db.data.users.some(
        (u) => u._id !== admin._id && u.email.toLowerCase() === email.toLowerCase()
      )
    ) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    admin.email = email;
  }

  if (body.newPassword) {
    const current = String(body.currentPassword || '');
    const ok = await bcrypt.compare(current, admin.password);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
    const newPassword = String(body.newPassword);
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    admin.password = bcrypt.hashSync(newPassword, 10);
  }

  audit(req, 'profile.update', admin._id);
  db.save();
  res.json(stripUser(admin));
});

/* ---------------- access control ---------------- */

router.get('/access', (req, res) => {
  db.reload();
  const admins = db.data.users
    .filter((u) => u.role === 'admin')
    .map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      status: u.status,
      createdAt: u.createdAt,
    }));
  res.json({
    admins,
    activeAdmins: activeAdminCount(),
    policies: [
      'Only accounts with role "admin" can call /api/admin endpoints.',
      'Suspended accounts are rejected even if they hold the admin role.',
      'The last active administrator cannot be demoted or suspended.',
      'Administrators cannot change their own role or suspend themselves.',
      'Every privileged action is recorded in the audit log.',
    ],
    audit: db.data.audit.slice(0, 100),
  });
});

/* ---------------- multer error handler ---------------- */

router.use((err, req, res, next) => {
  if (err) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    return res.status(400).json({ message });
  }
  next();
});

module.exports = router;
