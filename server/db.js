const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

const DEFAULT_CATEGORIES = [
  'Animation',
  'Education',
  'Entertainment',
  'Gaming',
  'Music',
  'News',
  'Sports',
  'Tech',
  'Travel',
  'Other',
];

function nowIso() {
  return new Date().toISOString();
}

function migrate(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};

  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.videos)) data.videos = [];
  if (!Array.isArray(data.comments)) data.comments = [];
  if (!Array.isArray(data.categories)) data.categories = [];
  if (!Array.isArray(data.viewEvents)) data.viewEvents = [];
  if (!Array.isArray(data.reports)) data.reports = [];
  if (!Array.isArray(data.audit)) data.audit = [];

  if (!data.settings || typeof data.settings !== 'object') data.settings = {};
  if (typeof data.settings.siteName !== 'string') data.settings.siteName = 'MyTube';
  if (typeof data.settings.allowUserUploads !== 'boolean') data.settings.allowUserUploads = true;
  if (typeof data.settings.requireApproval !== 'boolean') data.settings.requireApproval = false;

  for (const u of data.users) {
    if (!u.role) u.role = 'user';
    if (!u.status) u.status = 'active';
    if (!Array.isArray(u.subscribers)) u.subscribers = [];
    if (!Array.isArray(u.subscribedChannels)) u.subscribedChannels = [];
    if (!u.createdAt) u.createdAt = nowIso();
    if (typeof u.img !== 'string') u.img = '';
  }

  for (const v of data.videos) {
    if (!Array.isArray(v.likes)) v.likes = [];
    if (!Array.isArray(v.dislikes)) v.dislikes = [];
    if (!Array.isArray(v.tags)) v.tags = [];
    if (!v.status) v.status = 'published';
    if (!v.visibility) v.visibility = 'public';
    if (!v.category) v.category = 'Other';
    if (typeof v.featured !== 'boolean') v.featured = false;
    if (typeof v.views !== 'number') v.views = 0;
    if (!v.publishedAt) v.publishedAt = v.createdAt || nowIso();
    if (!v.createdAt) v.createdAt = nowIso();
    if (typeof v.imgUrl !== 'string') v.imgUrl = '';
    if (!v.processingStatus) v.processingStatus = 'ready';
  }

  const known = new Set(data.categories);
  for (const c of DEFAULT_CATEGORIES) known.add(c);
  for (const v of data.videos) if (v.category) known.add(v.category);
  data.categories = Array.from(known);

  return data;
}

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return migrate(parsed);
  } catch (e) {
    return migrate({});
  }
}

let data = load();

module.exports = {
  get data() {
    return data;
  },
  get categories() {
    return data.categories;
  },
  get settings() {
    return data.settings;
  },
  save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  },
  reload() {
    data = load();
  },
  DEFAULT_CATEGORIES,
};
