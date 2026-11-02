const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_FILE = path.join(__dirname, 'data.json');
const BASE = 'https://storage.googleapis.com/gtv-videos-bucket/sample';
const IMG = 'https://storage.googleapis.com/gtv-videos-bucket/sample/images';

const now = Date.now();
const daysAgo = (n) => new Date(now - n * 86400000).toISOString();

const categories = [
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

const users = [
  { _id: 'u-nature', name: 'Nature Films', email: 'nature@example.com' },
  { _id: 'u-tech', name: 'TechBytes', email: 'tech@example.com' },
  { _id: 'u-music', name: 'Music Vibes', email: 'music@example.com' },
  { _id: 'u-game', name: 'GameZone', email: 'game@example.com' },
  { _id: 'u-code', name: 'CodeDaily', email: 'code@example.com' },
].map((u, i) => ({
  ...u,
  password: bcrypt.hashSync('password123', 10),
  img: '',
  role: 'user',
  status: 'active',
  subscribers: [],
  subscribedChannels: [],
  createdAt: daysAgo(200 - i * 10),
}));

const videos = [
  { _id: 'v1', userId: 'u-nature', title: 'Big Buck Bunny — Full Animated Short', description: 'A large rabbit takes revenge on three bullying rodents in this classic open movie.', file: 'BigBuckBunny.mp4', img: 'BigBuckBunny.jpg', views: 152340, days: 12, category: 'Animation', tags: ['animation', 'short film', 'nature'] },
  { _id: 'v2', userId: 'u-tech', title: 'Elephants Dream — Open Movie', description: 'Two characters explore a strange mechanical world. A landmark open-source film.', file: 'ElephantsDream.mp4', img: 'ElephantsDream.jpg', views: 98210, days: 20, category: 'Animation', tags: ['animation', 'sci-fi'] },
  { _id: 'v3', userId: 'u-music', title: 'For Bigger Blazes — Cinematic Demo', description: 'Short cinematic demo clip with rich visuals and sound.', file: 'ForBiggerBlazes.mp4', img: 'ForBiggerBlazes.jpg', views: 54210, days: 4, category: 'Music', tags: ['music', 'demo'] },
  { _id: 'v4', userId: 'u-game', title: 'For Bigger Escapes — Action Demo', description: 'High-energy action demo footage.', file: 'ForBiggerEscapes.mp4', img: 'ForBiggerEscapes.jpg', views: 33210, days: 8, category: 'Gaming', tags: ['action', 'gaming'] },
  { _id: 'v5', userId: 'u-code', title: 'For Bigger Fun — Tech Demo', description: 'A playful demo scene used for streaming tests.', file: 'ForBiggerFun.mp4', img: 'ForBiggerFun.jpg', views: 22110, days: 2, category: 'Tech', tags: ['tech', 'demo'] },
  { _id: 'v6', userId: 'u-nature', title: 'Sintel — Fantasy Short Film', description: 'A lone girl searches for her lost dragon companion.', file: 'Sintel.mp4', img: 'Sintel.jpg', views: 210900, days: 45, category: 'Entertainment', tags: ['fantasy', 'animation'] },
  { _id: 'v7', userId: 'u-tech', title: 'For Bigger Joyrides — Driving Demo', description: 'Smooth driving footage for adaptive streaming demos.', file: 'ForBiggerJoyrides.mp4', img: 'ForBiggerJoyrides.jpg', views: 77210, days: 6, category: 'Travel', tags: ['cars', 'demo'] },
  { _id: 'v8', userId: 'u-music', title: 'For Bigger Meltdowns — Drama Demo', description: 'Dramatic short demo clip.', file: 'ForBiggerMeltdowns.mp4', img: 'ForBiggerMeltdowns.jpg', views: 41210, days: 15, category: 'Entertainment', tags: ['drama'] },
  { _id: 'v9', userId: 'u-game', title: 'Tears of Steel — Sci-Fi Short', description: 'A group of warriors and scientists gather in Amsterdam to save the world.', file: 'TearsOfSteel.mp4', img: 'TearsOfSteel.jpg', views: 183400, days: 60, category: 'Entertainment', tags: ['sci-fi', 'animation'] },
  { _id: 'v10', userId: 'u-code', title: 'We Are Going On Bullrun — Road Trip', description: 'Road trip demo footage.', file: 'WeAreGoingOnBullrun.mp4', img: 'WeAreGoingOnBullrun.jpg', views: 12800, days: 3, category: 'Travel', tags: ['travel'] },
].map((v) => ({
  _id: v._id,
  userId: v.userId,
  title: v.title,
  description: v.description,
  videoUrl: BASE + '/' + v.file,
  imgUrl: IMG + '/' + v.img,
  views: v.views,
  likes: [],
  dislikes: [],
  tags: v.tags,
  category: v.category,
  status: 'published',
  visibility: 'public',
  featured: false,
  scheduledAt: null,
  publishedAt: daysAgo(v.days),
  createdAt: daysAgo(v.days),
  processingStatus: 'ready',
  fileSize: null,
}));

const comments = [
  { _id: 'c1', userId: 'u-tech', videoId: 'v1', desc: 'This is still one of my favorite shorts. The animation holds up!', createdAt: daysAgo(2) },
  { _id: 'c2', userId: 'u-music', videoId: 'v1', desc: 'The soundtrack is so good.', createdAt: daysAgo(1) },
  { _id: 'c3', userId: 'u-code', videoId: 'v6', desc: 'Sintel gets me every time.', createdAt: daysAgo(5) },
];

const data = {
  users,
  videos,
  comments,
  categories,
  settings: { siteName: 'MyTube', allowUserUploads: true, requireApproval: false },
  viewEvents: [],
  reports: [],
  audit: [],
};

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log('Seeded ' + users.length + ' users, ' + videos.length + ' videos.');
