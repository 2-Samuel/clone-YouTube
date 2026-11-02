/* MyTube - YouTube-style public frontend (vanilla JS) */

const API = '/api';
const state = {
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  channelCache: new Map(),
  lastViewId: null,
  settings: { allowUserUploads: true, requireApproval: false, siteName: 'MyTube' },
};

const api = {
  async get(path) {
    const res = await fetch(API + path, { headers: authHeaders() });
    if (!res.ok) throw new Error((await safeJson(res)).message || res.statusText);
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await safeJson(res)).message || res.statusText);
    return res.json();
  },
  async put(path, body) {
    const res = await fetch(API + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error((await safeJson(res)).message || res.statusText);
    return res.json();
  },
};

function authHeaders() {
  return state.token ? { token: state.token } : {};
}

async function safeJson(res) {
  try { return await res.json(); } catch (e) { return {}; }
}

function icon(name, size) {
  return window.mtIcon ? window.mtIcon(name, size || 20) : '';
}

/* ---------- helpers ---------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatViews(n) {
  n = n || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + (m === 1 ? ' minute' : ' minutes') + ' ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + (h === 1 ? ' hour' : ' hours') + ' ago';
  const days = Math.floor(h / 24);
  if (days < 30) return days + (days === 1 ? ' day' : ' days') + ' ago';
  const mo = Math.floor(days / 30);
  if (mo < 12) return mo + (mo === 1 ? ' month' : ' months') + ' ago';
  const y = Math.floor(days / 365);
  return y + (y === 1 ? ' year' : ' years') + ' ago';
}

function initials(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

function avatar(user, size) {
  const cls = 'avatar' + (size ? ' ' + size : '');
  if (user && user.img) {
    return `<img class="${cls}" src="${esc(user.img)}" alt="" onerror="this.style.display='none'" />`;
  }
  return `<div class="${cls}">${esc(initials(user && user.name))}</div>`;
}

function thumb(video) {
  if (video.imgUrl) {
    return `<img src="${esc(video.imgUrl)}" alt="" loading="lazy"
      onerror="this.style.display='none'" />`;
  }
  return '';
}

function placeholder(video) {
  return `<div class="placeholder">${esc(initials(video.title))}</div>`;
}

async function getChannel(id) {
  if (!id) return { name: 'Unknown' };
  if (state.channelCache.has(id)) return state.channelCache.get(id);
  try {
    const ch = await api.get('/users/find/' + encodeURIComponent(id));
    state.channelCache.set(id, ch);
    return ch;
  } catch (e) {
    return { name: 'Unknown' };
  }
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2400);
}

function saveAuth(token, user) {
  state.token = token || '';
  state.user = user || null;
  if (token) localStorage.setItem('token', token); else localStorage.removeItem('token');
  if (user) localStorage.setItem('user', JSON.stringify(user)); else localStorage.removeItem('user');
}

function requireAuth() {
  if (!state.user) {
    location.hash = '#/signin';
    return false;
  }
  return true;
}

/* ---------- shell: navbar + sidebar ---------- */
function renderShell(active) {
  const right = document.getElementById('topbarRight');
  const studio = state.user && state.user.role === 'admin'
    ? `<a class="pill studio-link" href="/admin" title="MyTube Studio">${icon('dashboard', 16)} Studio</a>`
    : '';
  const create = state.user && state.settings.allowUserUploads
    ? `<button class="pill" id="createBtn">${icon('plus', 16)} Create</button>`
    : '';

  right.innerHTML = state.user
    ? `${studio}${create}<div class="avatar" title="Sign out" id="avatarBtn">${esc(initials(state.user.name))}</div>`
    : `<a class="pill" href="#/signin" style="border:1px solid var(--blue);color:var(--blue)">${icon('user', 16)} Sign in</a>`;

  const sidebar = document.getElementById('sidebar');
  const item = (href, iconName, label, key) =>
    `<a class="nav-item ${active === key ? 'active' : ''}" href="${href}">
       <span class="nav-icon">${icon(iconName, 19)}</span><span>${label}</span></a>`;

  sidebar.innerHTML = `
    ${item('#/', 'home', 'Home', 'home')}
    ${item('#/trends', 'explore', 'Explore', 'trends')}
    ${item('#/subscriptions', 'subscriptions', 'Subscriptions', 'sub')}
    <hr />
    <a class="nav-item" href="#/">${icon('library', 19)}<span>Library</span></a>
    <a class="nav-item" href="#/">${icon('history', 19)}<span>History</span></a>
    <hr />
    ${!state.user ? `<div class="signin-box">Sign in to like videos, comment, and subscribe.
        <br /><a href="#/signin">${icon('user', 16)} Sign in</a></div><hr />` : ''}
    <div class="section-title">Subscriptions</div>
    <div id="subChannels" class="signin-box"></div>
    <hr />
    <div class="section-title">More from MyTube</div>
    <a class="nav-item" href="#/">${icon('settings', 19)}<span>Settings</span></a>
    <a class="nav-item" href="#/">${icon('help', 19)}<span>Help</span></a>
    ${state.user && state.user.role === 'admin' ? `<hr /><div class="section-title">Studio</div>
      <a class="nav-item" href="/admin">${icon('dashboard', 19)}<span>Admin Dashboard</span></a>` : ''}
  `;

  if (state.user) {
    const wrap = document.getElementById('subChannels');
    const ids = state.user.subscribedChannels || [];
    if (!ids.length) {
      wrap.textContent = 'No subscriptions yet';
    } else {
      wrap.innerHTML = ids.map((id) => {
        const ch = state.channelCache.get(id);
        return `<a class="nav-item" href="#/">${icon('user', 18)}<span>${esc(ch ? ch.name : 'Channel')}</span></a>`;
      }).join('');
    }
  }

  document.getElementById('createBtn')?.addEventListener('click', openUpload);
  document.getElementById('avatarBtn')?.addEventListener('click', () => {
    if (confirm('Sign out?')) {
      saveAuth('', null);
      renderShell(active);
      route();
      toast('Signed out');
    }
  });
}

/* ---------- cards ---------- */
function cardHTML(video, channel) {
  return `<div class="card" data-id="${esc(video._id)}">
    <div class="thumb">${placeholder(video)}${thumb(video)}</div>
    <div class="card-body">
      ${avatar(channel)}
      <div class="card-text">
        <div class="card-title">${esc(video.title)}</div>
        <div class="card-meta">${esc(channel.name)}</div>
        <div class="card-meta">${formatViews(video.views)} views <span class="dot">•</span> ${timeAgo(video.publishedAt || video.createdAt)}</div>
      </div>
    </div>
  </div>`;
}

async function renderCards(container, videos, type) {
  if (!videos.length) {
    const msg = state.user
      ? 'No videos here yet. Use Create to upload one.'
      : 'No videos here yet. Sign in and upload one.';
    container.innerHTML = `<div class="empty">${msg}</div>`;
    return;
  }
  const channels = await Promise.all(videos.map((v) => getChannel(v.userId)));
  container.innerHTML = `<div class="grid">${videos.map((v, i) => cardHTML(v, channels[i])).join('')}</div>`;
  container.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => { location.hash = '#/video/' + el.dataset.id; });
  });
}

/* ---------- pages ---------- */
async function pageHome(type, chip) {
  renderShell(type === 'sub' ? 'sub' : type === 'trend' ? 'trends' : 'home');
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="chips">
      <button class="chip ${!chip ? 'active' : ''}" data-chip="">All</button>
      <button class="chip" data-chip="music">Music</button>
      <button class="chip" data-chip="gaming">Gaming</button>
      <button class="chip" data-chip="animation">Animation</button>
      <button class="chip" data-chip="tech">Tech</button>
      <button class="chip" data-chip="demo">Demos</button>
      <button class="chip" data-chip="sci-fi">Sci-Fi</button>
      <button class="chip" data-chip="travel">Travel</button>
    </div>
    <div id="homeGrid"></div>`;

  app.querySelectorAll('.chip').forEach((el) => {
    el.addEventListener('click', () => {
      app.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      el.classList.add('active');
      loadHomeVideos(app.querySelector('#homeGrid'), type, el.dataset.chip);
    });
  });

  loadHomeVideos(app.querySelector('#homeGrid'), type, chip);
}

async function loadHomeVideos(container, type, chip) {
  container.innerHTML = '<div class="empty">Loading…</div>';
  try {
    let videos;
    if (chip) videos = await api.get('/videos/tags?tags=' + encodeURIComponent(chip));
    else if (type === 'sub') videos = await api.get('/videos/sub');
    else if (type === 'trend') videos = await api.get('/videos/trend');
    else videos = await api.get('/videos/random');
    renderCards(container, videos, type);
  } catch (e) {
    renderCards(container, [], type);
  }
}

async function pageSearch(q) {
  renderShell('');
  const app = document.getElementById('app');
  app.innerHTML = `<h2 style="font-size:18px;margin-bottom:20px;color:var(--text-dim)">Results for “${esc(q)}”</h2>
    <div id="searchResults"><div class="empty">Searching…</div></div>`;
  try {
    const videos = await api.get('/videos/search?q=' + encodeURIComponent(q));
    const container = document.getElementById('searchResults');
    if (!videos.length) {
      container.innerHTML = `<div class="empty">No results found.</div>`;
      return;
    }
    const channels = await Promise.all(videos.map((v) => getChannel(v.userId)));
    container.innerHTML = videos.map((v, i) => `
      <div class="sm-card" data-id="${esc(v._id)}" style="margin-bottom:16px">
        <div class="sm-thumb">${placeholder(v)}${thumb(v)}</div>
        <div class="sm-text">
          <div class="sm-title" style="font-size:16px">${esc(v.title)}</div>
          <div class="sm-meta" style="margin:4px 0">${formatViews(v.views)} views • ${timeAgo(v.publishedAt || v.createdAt)}</div>
          <div class="sm-meta">${esc(channels[i].name)}</div>
          <div class="sm-meta" style="margin-top:6px">${esc(v.description || '')}</div>
        </div>
      </div>`).join('');
    container.querySelectorAll('.sm-card').forEach((el) => {
      el.addEventListener('click', () => { location.hash = '#/video/' + el.dataset.id; });
    });
  } catch (e) {
    document.getElementById('searchResults').innerHTML = `<div class="empty">Search failed.</div>`;
  }
}

async function pageSignin() {
  renderShell('');
  document.getElementById('app').innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <h1 id="authTitle">Sign in</h1>
        <p class="sub" id="authSub">to continue to MyTube</p>
        <div class="auth-error" id="authError"></div>
        <form id="authForm">
          <input type="text" id="authName" placeholder="Username" autocomplete="username" />
          <input type="email" id="authEmail" placeholder="Email" style="display:none" autocomplete="email" />
          <input type="password" id="authPass" placeholder="Password" autocomplete="current-password" />
          <button class="btn primary" type="submit" id="authSubmit">Sign in</button>
        </form>
        <div class="switch-auth" id="authSwitch">
          New here? <button id="toSignup">Create an account</button>
        </div>
      </div>
    </div>`;

  let mode = 'signin';
  const title = document.getElementById('authTitle');
  const sub = document.getElementById('authSub');
  const errEl = document.getElementById('authError');
  const email = document.getElementById('authEmail');
  const submit = document.getElementById('authSubmit');
  const switcher = document.getElementById('authSwitch');

  function setMode(m) {
    mode = m;
    if (m === 'signin') {
      title.textContent = 'Sign in';
      sub.textContent = 'to continue to MyTube';
      email.style.display = 'none';
      submit.textContent = 'Sign in';
      switcher.innerHTML = 'New here? <button id="toSignup">Create an account</button>';
    } else {
      title.textContent = 'Sign up';
      sub.textContent = 'Create your MyTube account';
      email.style.display = 'block';
      submit.textContent = 'Create account';
      switcher.innerHTML = 'Already have an account? <button id="toSignin">Sign in</button>';
    }
    bindSwitch();
  }
  function bindSwitch() {
    document.getElementById('toSignup')?.addEventListener('click', () => setMode('signup'));
    document.getElementById('toSignin')?.addEventListener('click', () => setMode('signin'));
  }
  bindSwitch();

  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    const name = document.getElementById('authName').value.trim();
    const mail = email.value.trim();
    const pass = document.getElementById('authPass').value;
    try {
      if (mode === 'signup') {
        await api.post('/auth/signup', { name, email: mail, password: pass });
        toast('Account created — please sign in');
        setMode('signin');
        document.getElementById('authPass').value = '';
      } else {
        const res = await api.post('/auth/signin', { name, password: pass });
        saveAuth(res.token, res.user);
        toast('Welcome, ' + res.user.name);
        location.hash = '#/';
      }
    } catch (err) {
      errEl.textContent = err.message || 'Something went wrong';
    }
  });
}

async function pageVideo(id) {
  renderShell('');
  const app = document.getElementById('app');
  app.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const video = await api.get('/videos/find/' + encodeURIComponent(id));
    const channel = await getChannel(video.userId);
    const recommendations = await api.get('/videos/random');
    const recs = recommendations.filter((v) => v._id !== video._id).slice(0, 10);
    const recChannels = await Promise.all(recs.map((v) => getChannel(v.userId)));

    const isSub = state.user && (state.user.subscribedChannels || []).includes(channel._id);
    const liked = state.user && video.likes.includes(state.user._id);
    const disliked = state.user && video.dislikes.includes(state.user._id);
    const preview = video._preview
      ? `<div class="preview-banner">Preview — this video is not published${video.status === 'pending' ? ' and is awaiting review' : ''}.</div>`
      : '';

    app.innerHTML = `
      <div class="watch">
        <div class="watch-main">
          ${preview}
          <div class="player-wrap">
            <video src="${esc(video.videoUrl)}" controls autoplay poster="${esc(video.imgUrl || '')}"></video>
          </div>
          <h1 class="watch-title">${esc(video.title)}</h1>
          <div class="watch-info">
            <div class="watch-meta">${formatViews(video.views)} views • ${timeAgo(video.publishedAt || video.createdAt)}</div>
            <div class="watch-actions">
              <button class="pill ${liked ? 'on' : ''}" id="likeBtn">${icon('thumbsup', 17)} ${video.likes.length}</button>
              <button class="pill ${disliked ? 'on' : ''}" id="dislikeBtn">${icon('thumbsdown', 17)} ${video.dislikes.length}</button>
              <button class="pill" id="shareBtn">${icon('share', 17)} Share</button>
              <button class="pill" id="saveBtn">${icon('save', 17)} Save</button>
            </div>
          </div>
          <hr class="watch-divider" />
          <div class="channel-row">
            ${avatar(channel, 'lg')}
            <div class="channel-info">
              <div class="channel-name">${esc(channel.name)}</div>
              <div class="channel-subs">${formatViews((channel.subscribers || []).length)} subscribers</div>
            </div>
            <button class="btn ${isSub ? 'subscribed' : 'subscribe'}" id="subBtn">${isSub ? 'Subscribed' : 'Subscribe'}</button>
          </div>
          <div class="description">
            ${esc(video.description || '')}
            ${video.tags && video.tags.length ? `<div class="tags">${video.tags.map((t) => '#' + esc(t)).join(' ')}</div>` : ''}
          </div>
          <div class="comments">
            <h3>Comments</h3>
            <div class="comment-input">
              ${avatar(state.user || { name: 'You' })}
              <input id="commentInput" placeholder="${state.user ? 'Add a comment…' : 'Sign in to add a comment'}" ${state.user ? '' : 'disabled'} />
              <button class="btn primary" id="commentBtn" ${state.user ? '' : 'disabled'}>Comment</button>
            </div>
            <div id="commentList"><div class="empty" style="padding:20px">Loading comments…</div></div>
          </div>
        </div>
        <div class="recommend" id="recommend">
          ${recs.map((v, i) => `
            <div class="sm-card" data-id="${esc(v._id)}">
              <div class="sm-thumb">${placeholder(v)}${thumb(v)}</div>
              <div class="sm-text">
                <div class="sm-title">${esc(v.title)}</div>
                <div class="sm-meta">${esc(recChannels[i].name)}</div>
                <div class="sm-meta">${formatViews(v.views)} views • ${timeAgo(v.publishedAt || v.createdAt)}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;

    document.querySelectorAll('.recommend .sm-card').forEach((el) => {
      el.addEventListener('click', () => { location.hash = '#/video/' + el.dataset.id; });
    });

    if (state.lastViewId !== video._id) {
      state.lastViewId = video._id;
      api.put('/videos/view/' + video._id).catch(() => {});
    }

    document.getElementById('likeBtn').addEventListener('click', async () => {
      if (!requireAuth()) return;
      try {
        await api.put('/videos/like/' + video._id);
        route();
      } catch (e) { toast(e.message); }
    });
    document.getElementById('dislikeBtn').addEventListener('click', async () => {
      if (!requireAuth()) return;
      try {
        await api.put('/videos/dislike/' + video._id);
        route();
      } catch (e) { toast(e.message); }
    });
    document.getElementById('subBtn').addEventListener('click', async () => {
      if (!requireAuth()) return;
      try {
        if (isSub) await api.put('/users/' + channel._id + '/unsubscribe');
        else await api.put('/users/' + channel._id + '/subscribe');
        const me = await api.get('/users/find/' + state.user._id);
        saveAuth(state.token, me);
        route();
      } catch (e) { toast(e.message); }
    });
    document.getElementById('shareBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        toast('Link copied');
      } catch (e) { toast(location.href); }
    });
    document.getElementById('saveBtn').addEventListener('click', () => toast('Saved to Library'));
    document.getElementById('commentBtn').addEventListener('click', async () => {
      if (!requireAuth()) return;
      const input = document.getElementById('commentInput');
      const desc = input.value.trim();
      if (!desc) return;
      try {
        await api.post('/comments', { videoId: video._id, desc });
        input.value = '';
        loadComments(video._id);
      } catch (e) { toast(e.message); }
    });

    loadComments(video._id);
  } catch (e) {
    app.innerHTML = `<div class="empty">Video not found. <a href="#/">Go home</a></div>`;
  }
}

async function loadComments(videoId) {
  const list = document.getElementById('commentList');
  if (!list) return;
  try {
    const comments = await api.get('/comments/' + encodeURIComponent(videoId));
    if (!comments.length) {
      list.innerHTML = `<div class="empty" style="padding:20px">No comments yet.</div>`;
      return;
    }
    const users = await Promise.all(comments.map((c) => getChannel(c.userId)));
    list.innerHTML = comments.map((c, i) => {
      const canReport = state.user && state.user._id !== c.userId;
      return `
      <div class="comment">
        ${avatar(users[i])}
        <div class="comment-body">
          <div class="comment-head"><b>${esc(users[i].name)}</b> • ${timeAgo(c.createdAt)}</div>
          <div class="comment-text">${esc(c.desc)}</div>
          <div class="comment-actions">
            <button>${icon('thumbsup', 14)} Like</button>
            <button>Reply</button>
            ${canReport ? `<button class="report-btn" data-comment="${esc(c._id)}">${icon('flag', 14)} Report</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.report-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const reason = prompt('Why are you reporting this comment?');
        if (reason === null) return;
        try {
          await api.post('/comments/' + encodeURIComponent(btn.dataset.comment) + '/report', {
            reason: reason || 'Inappropriate content',
          });
          toast('Report submitted for review');
        } catch (e) {
          toast(e.message);
        }
      });
    });
  } catch (e) {
    list.innerHTML = `<div class="empty" style="padding:20px">Could not load comments.</div>`;
  }
}

/* ---------- upload ---------- */
function openUpload() {
  if (!requireAuth()) return;
  if (!state.settings.allowUserUploads) {
    toast('User uploads are currently disabled');
    return;
  }
  document.getElementById('uploadNote').classList.toggle('hidden', !state.settings.requireApproval);
  document.getElementById('uploadModal').classList.remove('hidden');
}
function closeUpload() {
  document.getElementById('uploadModal').classList.add('hidden');
  document.getElementById('uploadForm').reset();
  document.getElementById('fileLabel').textContent = 'Select a video file';
  document.getElementById('uploadProgress').classList.add('hidden');
  document.getElementById('progressBar').style.width = '0%';
}

function bindUpload() {
  document.getElementById('closeUpload').addEventListener('click', closeUpload);
  document.getElementById('cancelUpload').addEventListener('click', closeUpload);
  document.getElementById('fileDrop').addEventListener('click', () => {
    document.getElementById('videoFile').click();
  });
  document.getElementById('videoFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    document.getElementById('fileLabel').textContent = f ? f.name : 'Select a video file';
  });
  document.getElementById('uploadForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const file = document.getElementById('videoFile').files[0];
    if (!file) return toast('Choose a video file first');
    const title = document.getElementById('upTitle').value.trim();
    if (!title) return toast('Title is required');

    const fd = new FormData();
    fd.append('video', file);
    fd.append('title', title);
    fd.append('description', document.getElementById('upDesc').value);
    fd.append('imgUrl', document.getElementById('upThumb').value);
    fd.append('category', document.getElementById('upCategory').value);
    fd.append('tags', document.getElementById('upTags').value);

    const progress = document.getElementById('uploadProgress');
    const bar = document.getElementById('progressBar');
    progress.classList.remove('hidden');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/videos/upload');
    xhr.setRequestHeader('token', state.token);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) bar.style.width = (ev.loaded / ev.total) * 100 + '%';
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const v = JSON.parse(xhr.responseText);
        closeUpload();
        toast(v.status === 'pending' ? 'Upload submitted for review' : 'Upload complete');
        location.hash = '#/video/' + v._id;
      } else {
        let msg = 'Upload failed';
        try { msg = JSON.parse(xhr.responseText).message || msg; } catch (e) {}
        toast(msg);
      }
    };
    xhr.onerror = () => toast('Upload failed');
    xhr.send(fd);
  });
}

/* ---------- router ---------- */
async function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart] = hash.split('?');
  const query = new URLSearchParams(queryPart || '');
  const parts = pathPart.split('/').filter(Boolean);

  if (parts[0] === 'video' && parts[1]) return pageVideo(parts[1]);
  if (parts[0] === 'search') return pageSearch(query.get('q') || '');
  if (parts[0] === 'signin') return pageSignin();
  if (parts[0] === 'trends') return pageHome('trend');
  if (parts[0] === 'subscriptions') {
    if (!state.user) { location.hash = '#/signin'; return; }
    return pageHome('sub');
  }
  return pageHome('random');
}

/* ---------- boot ---------- */
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('app').classList.toggle('full');
});

document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = document.getElementById('searchInput').value.trim();
  if (q) location.hash = '#/search?q=' + encodeURIComponent(q);
});

window.addEventListener('hashchange', route);
bindUpload();

(async function boot() {
  if (!location.hash) {
    const deep = location.pathname.match(/^\/video\/([^/]+)\/?$/);
    if (deep) {
      history.replaceState(null, '', '/#/video/' + encodeURIComponent(decodeURIComponent(deep[1])));
    }
  }
  try {
    state.settings = await api.get('/settings/public');
    if (state.settings.siteName) {
      const brand = document.querySelector('.brand-name');
      if (brand) brand.textContent = state.settings.siteName;
      document.title = state.settings.siteName;
    }
  } catch (e) { /* use defaults */ }
  route();
})();
