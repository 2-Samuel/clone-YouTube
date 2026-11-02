const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails')));
app.use('/media', express.static(path.join(__dirname, 'uploads')));

app.get('/api/settings/public', (req, res) => {
  db.reload();
  res.json({
    siteName: db.data.settings.siteName,
    allowUserUploads: db.data.settings.allowUserUploads,
    requireApproval: db.data.settings.requireApproval,
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/users', require('./routes/users'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/admin', require('./routes/admin'));

const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));

app.get(/^\/(?!api|uploads|videos|thumbnails|media).*/, (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));
