/* MyTube Studio — admin dashboard (vanilla JS) */

const API = '/api';
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const state = {
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  page: 'dashboard',
  charts: [],
  categories: null,
  videoQuery: { page: 1, q: '', status: '', category: '', sort: 'newest' },
  usersQuery: { page: 1, q: '', role: '', status: '' },
  listQuery: { page: 1, q: '' },
  commentsQuery: { page: 1, q: '' },
  analyticsDays: 30,
};

const ICON = (name, size) => (window.mtIcon ? window.mtIcon(name, size || 18) : '');

/* ---------------- utilities ---------------- */
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function compact(n) {
  n = Number(n || 0);
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function dateFmt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function timeAgo(value) {
  if (!value) return '';
  const s = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const days = Math.floor(h / 24);
  if (days < 30) return days + 'd ago';
  return dateFmt(value);
}

function initials(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase();
}

function avatarHTML(name, size) {
  return '<div class="avatar' + (size ? ' ' + size : '') + '">' + esc(initials(name)) + '</div>';
}

function thumbHTML(video) {
  if (video.imgUrl) {
    return '<div class="thumb-cell"><img src="' + esc(video.imgUrl) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'" /></div>';
  }
  return '<div class="thumb-cell">' + esc(initials(video.title)) + '</div>';
}

function miniThumbHTML(video) {
  if (video.imgUrl) {
    return '<div class="mini-thumb"><img src="' + esc(video.imgUrl) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'" /></div>';
  }
  return '<div class="mini-thumb">' + esc(initials(video.title)) + '</div>';
}

function badge(value) {
  const v = String(value || '').toLowerCase();
  return '<span class="badge ' + esc(v) + '">' + esc(v || 'unknown') + '</span>';
}

function qs(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');
}

function toast(message, kind) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', kind === 'error');
  el.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.add('hidden'), 3000);
}

async function api(path, options) {
  options = options || {};
  const headers = Object.assign({}, options.headers || {});
  if (state.token) headers.token = state.token;
  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(API + path, {
    method: options.method || 'GET',
    headers,
    body,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { data = {}; }
  if (!res.ok) {
    const err = new Error((data && data.message) || 'Request failed (' + res.status + ')');
    err.status = res.status;
    throw err;
  }
  return data;
}

function saveSession(token, user) {
  state.token = token || '';
  state.user = user || null;
  if (token) localStorage.setItem('token', token); else localStorage.removeItem('token');
  if (user) localStorage.setItem('user', JSON.stringify(user)); else localStorage.removeItem('user');
}

function clearSession() {
  saveSession('', null);
}

/* ---------------- modal ---------------- */
function closeModal() {
  const root = $('#modalRoot');
  if (root) root.innerHTML = '';
  if (closeModal._keyHandler) {
    document.removeEventListener('keydown', closeModal._keyHandler);
    closeModal._keyHandler = null;
  }
}

function openModal(opts) {
  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal ${opts.size === 'lg' ? 'lg' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <h2>${esc(opts.title || '')}</h2>
            ${opts.subtitle ? '<p>' + esc(opts.subtitle) + '</p>' : ''}
          </div>
          <button class="icon-btn" data-close title="Close" aria-label="Close">${ICON('close', 18)}</button>
        </div>
        <div class="modal-body">${opts.body || ''}</div>
        ${opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : ''}
      </div>
    </div>`;
  root.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', closeModal));
  root.querySelector('.modal-backdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  if (closeModal._keyHandler) document.removeEventListener('keydown', closeModal._keyHandler);
  const escHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  closeModal._keyHandler = escHandler;
  document.addEventListener('keydown', escHandler);
  if (opts.onMount) opts.onMount(root);
  return root;
}

function confirmDialog(title, text, confirmLabel, danger) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: '<p class="confirm-text">' + esc(text) + '</p>',
      footer: `
        <button class="btn ghost" data-cancel>Cancel</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirmLabel || 'Confirm')}</button>`,
      onMount(root) {
        root.querySelector('[data-cancel]').addEventListener('click', () => { closeModal(); resolve(false); });
        root.querySelector('[data-ok]').addEventListener('click', () => { closeModal(); resolve(true); });
      },
    });
  });
}

/* ---------------- charts ---------------- */
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(120, rect.width);
  const h = Math.max(120, rect.height);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function niceMax(value) {
  if (value <= 4) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

function chartEmpty(ctx, w, h, message) {
  ctx.fillStyle = '#777';
  ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, w / 2, h / 2);
}

function lineChart(canvas, labels, series, opts) {
  opts = opts || {};
  const draw = () => {
    if (!canvas.isConnected) return;
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const pad = { top: 14, right: 16, bottom: 26, left: 44 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    const maxVal = Math.max(1, ...series.flatMap((s) => s.data));
    const max = niceMax(maxVal);
    const steps = 4;

    ctx.strokeStyle = '#262626';
    ctx.fillStyle = '#777';
    ctx.font = '10.5px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= steps; i++) {
      const y = pad.top + (ch / steps) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillText(compact(Math.round(max - (max / steps) * i)), pad.left - 8, y);
    }

    const xAt = (i) => pad.left + (labels.length <= 1 ? cw / 2 : (cw / (labels.length - 1)) * i);
    const yAt = (v) => pad.top + ch - (v / max) * ch;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tickCount = Math.min(7, labels.length);
    for (let t = 0; t < tickCount; t++) {
      const i = Math.round((labels.length - 1) * (tickCount === 1 ? 0 : t / (tickCount - 1)));
      const label = labels[i] || '';
      const short = label.length >= 10 ? label.slice(5) : label;
      ctx.fillText(short, xAt(i), h - pad.bottom + 8);
    }

    const hasData = series.some((s) => s.data.some((v) => v > 0));
    if (!hasData) {
      chartEmpty(ctx, w, h, opts.emptyText || 'No data for this period');
      return;
    }

    series.forEach((s, si) => {
      const color = s.color || '#f10d24';
      if (si === 0 && opts.fill !== false) {
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
        grad.addColorStop(0, s.fillColor || 'rgba(241,13,36,0.22)');
        grad.addColorStop(1, 'rgba(241,13,36,0)');
        ctx.beginPath();
        ctx.moveTo(xAt(0), pad.top + ch);
        s.data.forEach((v, i) => ctx.lineTo(xAt(i), yAt(v)));
        ctx.lineTo(xAt(s.data.length - 1), pad.top + ch);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.beginPath();
      s.data.forEach((v, i) => {
        if (i === 0) ctx.moveTo(xAt(i), yAt(v));
        else ctx.lineTo(xAt(i), yAt(v));
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      if (labels.length <= 14) {
        s.data.forEach((v, i) => {
          ctx.beginPath();
          ctx.arc(xAt(i), yAt(v), 2.6, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        });
      }
    });
  };
  draw();
  state.charts.push(draw);
}

function barChart(canvas, labels, data, opts) {
  opts = opts || {};
  const draw = () => {
    if (!canvas.isConnected) return;
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const pad = { top: 14, right: 16, bottom: 26, left: 36 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    const max = niceMax(Math.max(1, ...data));
    const steps = 4;

    ctx.strokeStyle = '#262626';
    ctx.fillStyle = '#777';
    ctx.font = '10.5px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= steps; i++) {
      const y = pad.top + (ch / steps) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillText(compact(Math.round(max - (max / steps) * i)), pad.left - 8, y);
    }

    const slot = cw / Math.max(1, data.length);
    const bw = Math.max(2, Math.min(22, slot * 0.55));
    data.forEach((v, i) => {
      const bh = (v / max) * ch;
      const x = pad.left + slot * i + (slot - bw) / 2;
      const y = pad.top + ch - bh;
      ctx.fillStyle = opts.color || '#f10d24';
      if (bh > 0) {
        ctx.beginPath();
        const r = Math.min(3, bw / 2, bh);
        ctx.moveTo(x, y + bh);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.lineTo(x + bw - r, y);
        ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
        ctx.lineTo(x + bw, y + bh);
        ctx.closePath();
        ctx.fill();
      }
    });

    ctx.fillStyle = '#777';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tickCount = Math.min(7, labels.length);
    for (let t = 0; t < tickCount; t++) {
      const i = Math.round((labels.length - 1) * (tickCount === 1 ? 0 : t / (tickCount - 1)));
      const label = labels[i] || '';
      const short = label.length >= 10 ? label.slice(5) : label;
      ctx.fillText(short, pad.left + slot * i + slot / 2, h - pad.bottom + 8);
    }

    if (!data.some((v) => v > 0)) chartEmpty(ctx, w, h, opts.emptyText || 'No uploads in this period');
  };
  draw();
  state.charts.push(draw);
}

function donutChart(canvas, rows, opts) {
  opts = opts || {};
  const draw = () => {
    if (!canvas.isConnected) return;
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 14;
    const thickness = 16;

    if (!total) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.lineWidth = thickness;
      ctx.strokeStyle = '#2a2a2a';
      ctx.stroke();
      ctx.fillStyle = '#777';
      ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No videos', cx, cy);
      return;
    }

    let start = -Math.PI / 2;
    rows.forEach((r) => {
      const angle = (r.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, start + angle);
      ctx.lineWidth = thickness;
      ctx.strokeStyle = r.color;
      ctx.stroke();
      start += angle;
    });

    ctx.fillStyle = '#f5f5f5';
    ctx.font = '700 22px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(total), cx, cy - 4);
    ctx.fillStyle = '#999';
    ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('videos', cx, cy + 15);
  };
  draw();
  state.charts.push(draw);
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    state.charts.forEach((fn) => { try { fn(); } catch (e) {} });
  }, 160);
});

/* ---------------- shared render helpers ---------------- */
function pageHead(title, subtitle, actions) {
  return `<div class="page-head">
    <div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
    ${actions ? '<div class="page-actions">' + actions + '</div>' : ''}
  </div>`;
}

function loadingPage() {
  return '<div class="empty-state">' + ICON('refresh', 26) + '<p>Loading…</p></div>';
}

function errorPage(message) {
  return `<div class="card"><div class="empty-state">${ICON('reports', 30)}
    <h3>Something went wrong</h3><p>${esc(message)}</p></div></div>`;
}

function pagerHTML(page, pages, total, label) {
  return `<div class="pagination">
    <span>${fmt(total)} ${esc(label || 'items')} · page ${page} of ${pages}</span>
    <div class="page-btns">
      <button data-go="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Prev</button>
      <button class="active" disabled>${page}</button>
      <button data-go="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next</button>
    </div>
  </div>`;
}

function bindPager(root, callback) {
  $$('.page-btns [data-go]', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.go, 10);
      if (!Number.isNaN(n)) callback(n);
    });
  });
}

function emptyState(title, text, actionHTML) {
  return `<div class="empty-state">${ICON('film', 30)}<h3>${esc(title)}</h3>
    <p>${esc(text)}</p>${actionHTML ? '<div style="margin-top:16px">' + actionHTML + '</div>' : ''}</div>`;
}

/* ---------------- dashboard ---------------- */
async function pageDashboard() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  try {
    const d = await api('/admin/dashboard');
    state.charts = [];
    const t = d.totals;
    const views = d.series.views;
    const last7 = views.slice(-7).reduce((a, b) => a + b, 0);
    const prev7 = views.slice(-14, -7).reduce((a, b) => a + b, 0);
    let trendText = t.views ? 'All-time views across videos' : 'No playback recorded yet';
    let trendClass = '';
    if (d.viewsTrackedSince) {
      const delta = last7 - prev7;
      trendText = (delta >= 0 ? '+' : '') + fmt(delta) + ' vs previous 7 days';
      trendClass = delta >= 0 ? ' up' : ' down';
    }

    const catRows = d.categoryStats.slice(0, 6);
    const catColors = ['#f10d24', '#4c8dff', '#f5a623', '#2ecc71', '#a78bfa', '#6b7280'];
    const catHTML = catRows.length
      ? `<div class="donut-wrap">
           <canvas id="catChart"></canvas>
           <div class="donut-legend">${catRows.map((c, i) =>
             `<div><i style="background:${catColors[i]}"></i>${esc(c.category)}<b>${fmt(c.videos)}</b></div>`).join('')}
           </div>
         </div>`
      : emptyState('No categories yet', 'Upload a video to start building category statistics.');

    el.innerHTML = `
      ${pageHead('Dashboard', 'A live overview of your platform', `
        <a class="btn primary" href="#/upload">${ICON('upload', 16)} Upload video</a>`)}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-top"><span class="stat-label">Total views</span><span class="stat-icon red">${ICON('eye', 17)}</span></div>
          <div class="stat-value">${compact(t.views)}</div>
          <div class="stat-sub"><span class="trend${trendClass}">${esc(trendText)}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><span class="stat-label">Users</span><span class="stat-icon blue">${ICON('users', 17)}</span></div>
          <div class="stat-value">${fmt(t.users)}</div>
          <div class="stat-sub">${fmt(d.newUsers.last7)} new this week · ${fmt(t.suspended)} suspended</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><span class="stat-label">Videos</span><span class="stat-icon orange">${ICON('videos', 17)}</span></div>
          <div class="stat-value">${fmt(t.videos)}</div>
          <div class="stat-sub">${fmt(t.published)} published · ${fmt(t.drafts)} drafts${t.pending ? ' · ' + fmt(t.pending) + ' pending' : ''}</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><span class="stat-label">Engagement</span><span class="stat-icon green">${ICON('thumbsup', 17)}</span></div>
          <div class="stat-value">${compact(t.likes + t.comments)}</div>
          <div class="stat-sub">${fmt(t.likes)} likes · ${fmt(t.comments)} comments</div>
        </div>
      </div>

      <div class="grid two" style="margin-bottom:16px">
        <div class="card chart-card">
          <div class="card-head">
            <h3>Views</h3><span class="muted">Last 30 days</span>
          </div>
          ${d.viewsTrackedSince
            ? `<div class="muted" style="font-size:11.5px;margin-bottom:8px">Tracking since ${esc(dateFmt(d.viewsTrackedSince))}</div>`
            : '<div class="notice info">Playback history is tracked from now on. Historical views exist only as aggregate totals.</div>'}
          <div class="chart-wrap short"><canvas id="viewsChart"></canvas></div>
          <div class="legend"><span><i style="background:#f10d24"></i>Views recorded</span></div>
        </div>
        <div class="card chart-card">
          <div class="card-head"><h3>Top categories</h3><a class="muted" href="#/categories">Manage</a></div>
          ${catHTML}
        </div>
      </div>

      <div class="grid two" style="margin-bottom:16px">
        <div class="card chart-card">
          <div class="card-head"><h3>Uploads</h3><span class="muted">Last 30 days</span></div>
          <div class="chart-wrap short"><canvas id="uploadsChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Audience</h3><a class="muted" href="#/users">Manage users</a></div>
          <div class="list">
            <div class="list-row"><span class="stat-icon blue">${ICON('users', 16)}</span><div class="grow"><b>Active accounts</b><span>Can sign in and use the platform</span></div><b>${fmt(d.userBreakdown.active)}</b></div>
            <div class="list-row"><span class="stat-icon purple">${ICON('access', 16)}</span><div class="grow"><b>Administrators</b><span>Full access to Studio</span></div><b>${fmt(d.userBreakdown.admins)}</b></div>
            <div class="list-row"><span class="stat-icon red">${ICON('reports', 16)}</span><div class="grow"><b>Suspended</b><span>Blocked from signing in</span></div><b>${fmt(d.userBreakdown.suspended)}</b></div>
            <div class="list-row"><span class="stat-icon orange">${ICON('comments', 16)}</span><div class="grow"><b>Open reports</b><span>Community reports awaiting review</span></div><b>${fmt(t.openReports)}</b></div>
          </div>
        </div>
      </div>

      <div class="grid two">
        <div class="table-card">
          <div class="card-head" style="padding:16px 16px 0;margin-bottom:10px"><h3>Top videos</h3><a class="muted" href="#/videos">All videos</a></div>
          ${d.topVideos.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Video</th><th>Status</th><th class="right">Views</th><th class="right">Likes</th></tr></thead>
            <tbody>${d.topVideos.map((v) => `
              <tr>
                <td><div class="cell-main">${thumbHTML(v)}<div style="min-width:0"><a class="cell-title" href="/video/${esc(v._id)}" target="_blank" rel="noopener">${esc(v.title)}</a><div class="cell-sub">${esc(v.uploaderName)}</div></div></div></td>
                <td>${badge(v.status)}</td>
                <td class="right">${fmt(v.views)}</td>
                <td class="right">${fmt((v.likes || []).length)}</td>
              </tr>`).join('')}</tbody>
          </table></div>` : emptyState('No videos yet', 'Upload your first video to see performance here.')}
        </div>
        <div class="card">
          <div class="card-head"><h3>Recent uploads</h3><span class="muted">${fmt(d.recentVideos.length)}</span></div>
          ${d.recentVideos.length ? '<div class="list">' + d.recentVideos.map((v) => `
            <div class="list-row">
              ${miniThumbHTML(v)}
              <div class="grow"><b><a href="/video/${esc(v._id)}" target="_blank" rel="noopener">${esc(v.title)}</a></b>
                <span>${esc(v.uploaderName)} · ${esc(timeAgo(v.createdAt))}</span></div>
              ${badge(v.status)}
            </div>`).join('') + '</div>' : emptyState('No uploads yet', 'New uploads will appear here.')}
        </div>
      </div>`;

    lineChart($('#viewsChart'), d.series.labels, [{ data: d.series.views, color: '#f10d24' }], {
      emptyText: 'No views recorded in this period',
    });
    if ($('#uploadsChart')) {
      barChart($('#uploadsChart'), d.series.labels, d.series.uploads, {
        emptyText: 'No uploads in this period',
      });
    }
    if ($('#catChart')) {
      donutChart($('#catChart'), catRows.map((c, i) => ({ label: c.category, value: c.videos, color: catColors[i] })));
    }
  } catch (err) {
    el.innerHTML = errorPage(err.message);
  }
}

/* ---------------- videos ---------------- */
async function pageVideos() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  try {
    const q = state.videoQuery;
    const [data, categories] = await Promise.all([
      api('/admin/videos?' + qs(q)),
      api('/admin/categories'),
    ]);
    state.categories = categories;
    state.charts = [];
    const byId = new Map(data.items.map((v) => [v._id, v]));
    const catOptions = categories.filter((c) => c.name !== 'Other').map((c) =>
      `<option value="${esc(c.name)}" ${q.category === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

    el.innerHTML = `
      ${pageHead('Videos', 'Manage every video on the platform', `
        <a class="btn primary" href="#/upload">${ICON('upload', 16)} Upload video</a>`)}
      <form class="toolbar" id="videoFilters">
        <div class="search-box">${ICON('search', 16)}
          <input type="search" name="q" placeholder="Search title, description, tags" value="${esc(q.q)}" />
        </div>
        <select name="status">
          <option value="">All statuses</option>
          <option value="published" ${q.status === 'published' ? 'selected' : ''}>Published</option>
          <option value="draft" ${q.status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="pending" ${q.status === 'pending' ? 'selected' : ''}>Pending</option>
        </select>
        <select name="category">
          <option value="">All categories</option>
          ${catOptions}
        </select>
        <select name="sort">
          <option value="newest" ${q.sort === 'newest' ? 'selected' : ''}>Newest first</option>
          <option value="oldest" ${q.sort === 'oldest' ? 'selected' : ''}>Oldest first</option>
          <option value="views" ${q.sort === 'views' ? 'selected' : ''}>Most views</option>
          <option value="title" ${q.sort === 'title' ? 'selected' : ''}>Title A–Z</option>
        </select>
        <button class="btn ghost sm" type="submit">${ICON('search', 15)} Filter</button>
      </form>
      <div class="table-card">
        ${data.items.length ? `<div class="table-wrap"><table>
          <thead><tr>
            <th>Video</th><th>Status</th><th>Visibility</th><th>Category</th>
            <th class="right">Views</th><th class="right">Likes</th><th>Created</th><th class="right">Actions</th>
          </tr></thead>
          <tbody>${data.items.map((v) => `
            <tr>
              <td><div class="cell-main">${thumbHTML(v)}
                <div style="min-width:0"><div class="cell-title">${esc(v.title)}</div>
                <div class="cell-sub">${esc(v.uploaderName)}</div></div></div></td>
              <td>${badge(v.status)}</td>
              <td>${badge(v.visibility)}</td>
              <td>${esc(v.category || 'Other')}</td>
              <td class="right">${fmt(v.views)}</td>
              <td class="right">${fmt((v.likes || []).length)}</td>
              <td>${esc(dateFmt(v.createdAt))}</td>
              <td><div class="row-actions">
                <button class="icon-btn" data-action="view" data-id="${esc(v._id)}" title="Watch video">${ICON('eye', 16)}</button>
                <button class="icon-btn" data-action="edit" data-id="${esc(v._id)}" title="Edit video">${ICON('edit', 16)}</button>
                <button class="icon-btn" data-action="toggle" data-id="${esc(v._id)}" title="${v.status === 'published' ? 'Unpublish' : 'Publish'}">${ICON(v.status === 'published' ? 'close' : 'check', 16)}</button>
                <button class="icon-btn danger" data-action="delete" data-id="${esc(v._id)}" title="Delete video">${ICON('trash', 16)}</button>
              </div></td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('No videos found', 'Try changing the filters, or upload a new video.', '<a class="btn primary" href="#/upload">Upload video</a>')}
        ${pagerHTML(data.page, data.pages, data.total, 'videos')}
      </div>`;

    const form = $('#videoFilters');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      q.q = String(fd.get('q') || '').trim();
      q.status = String(fd.get('status') || '');
      q.category = String(fd.get('category') || '');
      q.sort = String(fd.get('sort') || 'newest');
      q.page = 1;
      pageVideos();
    });
    $$('select', form).forEach((sel) => sel.addEventListener('change', () => form.requestSubmit()));
    bindPager(el, (n) => { q.page = n; pageVideos(); });

    $$('[data-action]', el).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const video = byId.get(btn.dataset.id);
        if (!video) return;
        if (btn.dataset.action === 'view') {
          window.open('/video/' + encodeURIComponent(video._id), '_blank', 'noopener');
        } else if (btn.dataset.action === 'edit') {
          openVideoEdit(video, categories);
        } else if (btn.dataset.action === 'toggle') {
          const publish = video.status !== 'published';
          try {
            await api('/admin/videos/' + video._id, { method: 'PUT', body: { status: publish ? 'published' : 'draft' } });
            toast(publish ? 'Video published' : 'Video unpublished');
            pageVideos();
          } catch (err) { toast(err.message, 'error'); }
        } else if (btn.dataset.action === 'delete') {
          const ok = await confirmDialog('Delete video', 'Delete “' + video.title + '”? This also removes its comments, reports and view history. This cannot be undone.', 'Delete video', true);
          if (!ok) return;
          try {
            await api('/admin/videos/' + video._id, { method: 'DELETE' });
            toast('Video deleted');
            pageVideos();
          } catch (err) { toast(err.message, 'error'); }
        }
      });
    });
  } catch (err) {
    el.innerHTML = errorPage(err.message);
  }
}

function openVideoEdit(video, categories) {
  const catOptions = categories.filter((c) => c.name !== 'Other').map((c) =>
    `<option value="${esc(c.name)}" ${video.category === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const scheduled = video.scheduledAt ? new Date(video.scheduledAt) : null;
  const scheduledValue = scheduled && !Number.isNaN(scheduled.getTime())
    ? new Date(scheduled.getTime() - scheduled.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';

  openModal({
    title: 'Edit video',
    subtitle: video.title,
    size: 'lg',
    body: `
      <form id="editVideoForm" class="form-stack">
        <label class="field"><span>Title</span>
          <input type="text" name="title" maxlength="150" required value="${esc(video.title)}" /></label>
        <label class="field"><span>Description</span>
          <textarea name="description" rows="4" maxlength="5000">${esc(video.description || '')}</textarea></label>
        <div class="field-row">
          <label class="field"><span>Category</span>
            <select name="category">${catOptions}
              <option value="Other" ${video.category === 'Other' ? 'selected' : ''}>Other</option>
            </select></label>
          <label class="field"><span>Visibility</span>
            <select name="visibility">
              <option value="public" ${video.visibility === 'public' ? 'selected' : ''}>Public</option>
              <option value="unlisted" ${video.visibility === 'unlisted' ? 'selected' : ''}>Unlisted</option>
              <option value="private" ${video.visibility === 'private' ? 'selected' : ''}>Private</option>
            </select></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Status</span>
            <select name="status">
              <option value="published" ${video.status === 'published' ? 'selected' : ''}>Published</option>
              <option value="draft" ${video.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="pending" ${video.status === 'pending' ? 'selected' : ''}>Pending review</option>
            </select></label>
          <label class="field"><span>Schedule publish (optional)</span>
            <input type="datetime-local" name="scheduledAt" value="${esc(scheduledValue)}" /></label>
        </div>
        <label class="field"><span>Tags (comma separated)</span>
          <input type="text" name="tags" value="${esc((video.tags || []).join(', '))}" /></label>
        <label class="field"><span>Replace thumbnail (optional, image)</span>
          <input type="file" name="thumbnail" accept="image/*" /></label>
        <div class="field-row" style="align-items:center">
          <label class="check"><input type="checkbox" name="featured" ${video.featured ? 'checked' : ''} /> Featured video</label>
          <span class="muted" style="font-size:11.5px">Current file: ${esc(video.videoUrl || '—')}</span>
        </div>
      </form>`,
    footer: `<button class="btn ghost" data-close>Cancel</button>
      <button class="btn primary" id="saveVideoBtn">Save changes</button>`,
    onMount(root) {
      $('#saveVideoBtn', root).addEventListener('click', async () => {
        const form = $('#editVideoForm', root);
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        fd.append('featured', form.featured.checked ? 'true' : 'false');
        fd.append('scheduledAt', form.scheduledAt.value || '');
        const btn = $('#saveVideoBtn', root);
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
          await api('/admin/videos/' + video._id, { method: 'PUT', body: fd });
          closeModal();
          toast('Video updated');
          pageVideos();
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Save changes';
        }
      });
    },
  });
}

/* ---------------- upload ---------------- */
async function pageUpload() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  let categories = state.categories;
  if (!categories) {
    try { categories = await api('/admin/categories'); state.categories = categories; }
    catch (e) { categories = []; }
  }
  state.charts = [];
  const catOptions = categories.filter((c) => c.name !== 'Other').map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');

  el.innerHTML = `
    ${pageHead('Upload video', 'Add a new video to the library')}
    <div class="upload-grid">
      <div class="card">
        <form id="adminUploadForm" class="form-stack">
          <div class="file-drop" id="videoDrop">
            <input type="file" name="video" id="adminVideoFile" accept="video/*" hidden />
            ${ICON('upload', 26)}
            <b id="videoDropTitle">Choose a video or drag it here</b>
            <span>MP4, WebM, OGG, MOV, MKV, AVI — up to 2 GB</span>
          </div>
          <label class="field"><span>Thumbnail (optional image)</span>
            <input type="file" name="thumbnail" accept="image/*" /></label>
          <label class="field"><span>Title</span>
            <input type="text" name="title" maxlength="150" required placeholder="Give your video a title" /></label>
          <label class="field"><span>Description</span>
            <textarea name="description" rows="4" maxlength="5000" placeholder="Tell viewers about your video"></textarea></label>
          <div class="field-row">
            <label class="field"><span>Category</span>
              <select name="category"><option value="Other">Other</option>${catOptions}</select></label>
            <label class="field"><span>Visibility</span>
              <select name="visibility">
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select></label>
          </div>
          <div class="field-row">
            <label class="field"><span>Status</span>
              <select name="status">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select></label>
            <label class="field"><span>Schedule publish (optional)</span>
              <input type="datetime-local" name="scheduledAt" /></label>
          </div>
          <label class="field"><span>Tags (comma separated)</span>
            <input type="text" name="tags" placeholder="tutorial, product, demo" /></label>
          <label class="check"><input type="checkbox" name="featured" /> Mark as featured</label>
          <div class="progress hidden" id="adminUploadProgress"><div class="progress-bar" id="adminProgressBar"></div></div>
          <div class="form-actions">
            <a class="btn ghost" href="#/videos">Cancel</a>
            <button class="btn primary" type="submit" id="adminUploadBtn">${ICON('upload', 16)} Upload video</button>
          </div>
        </form>
      </div>
      <div>
        <div class="card">
          <div class="card-head"><h3>Before you publish</h3></div>
          <div class="list">
            <div class="list-row"><span class="stat-icon red">${ICON('film', 16)}</span><div class="grow"><b>Use a playable format</b><span>MP4 (H.264) plays in every modern browser.</span></div></div>
            <div class="list-row"><span class="stat-icon blue">${ICON('image', 16)}</span><div class="grow"><b>Add a thumbnail</b><span>16:9 images look best in the public feed.</span></div></div>
            <div class="list-row"><span class="stat-icon orange">${ICON('clock', 16)}</span><div class="grow"><b>Scheduling</b><span>Published videos with a future date stay hidden until that time.</span></div></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="card-head"><h3>Visibility</h3></div>
          <p class="muted" style="font-size:12.5px;line-height:1.6;margin:0">
            Public videos appear in feeds and search. Unlisted videos are reachable by link only.
            Private videos are limited to administrators. Drafts are never shown publicly.
          </p>
        </div>
      </div>
    </div>`;

  const form = $('#adminUploadForm');
  const drop = $('#videoDrop');
  const fileInput = $('#adminVideoFile');

  function setFileLabel() {
    const file = fileInput.files[0];
    $('#videoDropTitle').textContent = file ? file.name : 'Choose a video or drag it here';
    drop.classList.toggle('has-file', Boolean(file));
  }
  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', setFileLabel);
  ['dragenter', 'dragover'].forEach((evt) => drop.addEventListener(evt, (e) => {
    e.preventDefault();
    drop.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach((evt) => drop.addEventListener(evt, (e) => {
    e.preventDefault();
    drop.classList.remove('dragover');
  }));
  drop.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      setFileLabel();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) return toast('Choose a video file first', 'error');
    if (file.size > 2 * 1024 * 1024 * 1024) return toast('Video must be 2 GB or smaller', 'error');
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    fd.set('featured', form.featured.checked ? 'true' : 'false');
    const progress = $('#adminUploadProgress');
    const bar = $('#adminProgressBar');
    const btn = $('#adminUploadBtn');
    progress.classList.remove('hidden');
    bar.style.width = '0%';
    btn.disabled = true;
    btn.textContent = 'Uploading…';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/admin/videos');
    if (state.token) xhr.setRequestHeader('token', state.token);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) bar.style.width = Math.round((ev.loaded / ev.total) * 100) + '%';
    };
    xhr.onload = () => {
      btn.disabled = false;
      btn.innerHTML = ICON('upload', 16) + ' Upload video';
      let res = {};
      try { res = JSON.parse(xhr.responseText); } catch (e) {}
      if (xhr.status >= 200 && xhr.status < 300) {
        bar.style.width = '100%';
        toast(res.status === 'published' ? 'Video published' : 'Video saved as draft');
        form.reset();
        setFileLabel();
        progress.classList.add('hidden');
        const result = document.createElement('div');
        result.className = 'notice info';
        result.style.marginTop = '14px';
        result.innerHTML = 'Upload complete. <a href="/video/' + encodeURIComponent(res._id) +
          '" target="_blank" rel="noopener" style="text-decoration:underline">View video</a> · ' +
          '<a href="#/videos" style="text-decoration:underline">Manage videos</a>';
        form.appendChild(result);
        setTimeout(() => result.remove(), 12000);
      } else {
        toast(res.message || 'Upload failed', 'error');
        progress.classList.add('hidden');
      }
    };
    xhr.onerror = () => {
      toast('Upload failed — check your connection', 'error');
      btn.disabled = false;
      btn.innerHTML = ICON('upload', 16) + ' Upload video';
      progress.classList.add('hidden');
    };
    xhr.send(fd);
  });
}

/* ---------------- users ---------------- */
function userRoleActions(u) {
  const self = state.user && u._id === state.user._id;
  const makeAdmin = u.role !== 'admin';
  return `<div class="row-actions" style="gap:6px">
    <button class="btn sm ghost" data-user-action="detail" data-id="${esc(u._id)}">View</button>
    <button class="btn sm ghost" data-user-action="role" data-id="${esc(u._id)}" ${self ? 'disabled title="You cannot change your own role"' : ''}>${makeAdmin ? 'Make admin' : 'Make user'}</button>
    <button class="btn sm ${u.status === 'active' ? 'danger' : 'ghost'}" data-user-action="status" data-id="${esc(u._id)}" ${self ? 'disabled title="You cannot suspend yourself"' : ''}>${u.status === 'active' ? 'Suspend' : 'Activate'}</button>
  </div>`;
}

async function pageUsers() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  try {
    const q = state.usersQuery;
    const data = await api('/admin/users?' + qs(q));
    state.charts = [];
    const byId = new Map(data.items.map((u) => [u._id, u]));
    el.innerHTML = `
      ${pageHead('Users', 'Roles, account status and activity', `
        <a class="btn ghost" href="#/user-list">${ICON('userlist', 16)} User directory</a>`)}
      <form class="toolbar" id="userFilters">
        <div class="search-box">${ICON('search', 16)}
          <input type="search" name="q" placeholder="Search name or email" value="${esc(q.q)}" /></div>
        <select name="role">
          <option value="">All roles</option>
          <option value="admin" ${q.role === 'admin' ? 'selected' : ''}>Admins</option>
          <option value="user" ${q.role === 'user' ? 'selected' : ''}>Users</option>
        </select>
        <select name="status">
          <option value="">All statuses</option>
          <option value="active" ${q.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="suspended" ${q.status === 'suspended' ? 'selected' : ''}>Suspended</option>
        </select>
        <button class="btn ghost sm" type="submit">${ICON('search', 15)} Filter</button>
      </form>
      <div class="table-card">
        ${data.items.length ? `<div class="table-wrap"><table>
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th class="right">Videos</th>
            <th class="right">Subscribers</th><th>Joined</th><th class="right">Actions</th></tr></thead>
          <tbody>${data.items.map((u) => `
            <tr>
              <td><div class="cell-main">${avatarHTML(u.name, 'sm')}
                <div><div class="cell-title">${esc(u.name)}${u._id === (state.user && state.user._id) ? ' <span class="muted">(you)</span>' : ''}</div>
                <div class="cell-sub">${esc(u.email)}</div></div></div></td>
              <td>${badge(u.role)}</td>
              <td>${badge(u.status)}</td>
              <td class="right">${fmt(u.videoCount)}</td>
              <td class="right">${fmt(u.publicSubscribers)}</td>
              <td>${esc(dateFmt(u.createdAt))}</td>
              <td>${userRoleActions(u)}</td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('No users found', 'Try a different search or filter.')}
        ${pagerHTML(data.page, data.pages, data.total, 'accounts')}
      </div>`;

    const form = $('#userFilters');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      q.q = String(fd.get('q') || '').trim();
      q.role = String(fd.get('role') || '');
      q.status = String(fd.get('status') || '');
      q.page = 1;
      pageUsers();
    });
    $$('select', form).forEach((sel) => sel.addEventListener('change', () => form.requestSubmit()));
    bindPager(el, (n) => { q.page = n; pageUsers(); });

    $$('[data-user-action]', el).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const user = byId.get(btn.dataset.id);
        if (!user) return;
        const action = btn.dataset.userAction;
        if (action === 'detail') return openUserDetail(user._id);
        if (action === 'role') {
          const next = user.role === 'admin' ? 'user' : 'admin';
          const ok = await confirmDialog(
            next === 'admin' ? 'Grant administrator access' : 'Remove administrator access',
            next === 'admin'
              ? 'Give “' + user.name + '” full access to Studio? Administrators can manage all content, users and settings.'
              : 'Remove administrator access from “' + user.name + '”? They will keep their account and content.',
            next === 'admin' ? 'Grant access' : 'Remove access',
            next !== 'admin'
          );
          if (!ok) return;
          try {
            await api('/admin/users/' + user._id + '/role', { method: 'PUT', body: { role: next } });
            toast('Role updated');
            pageUsers();
          } catch (err) { toast(err.message, 'error'); }
        } else if (action === 'status') {
          const next = user.status === 'active' ? 'suspended' : 'active';
          const ok = await confirmDialog(
            next === 'suspended' ? 'Suspend account' : 'Activate account',
            next === 'suspended'
              ? 'Suspend “' + user.name + '”? They will be signed out and blocked from signing in.'
              : 'Reactivate “' + user.name + '” so they can sign in again.',
            next === 'suspended' ? 'Suspend account' : 'Activate account',
            next === 'suspended'
          );
          if (!ok) return;
          try {
            await api('/admin/users/' + user._id + '/status', { method: 'PUT', body: { status: next } });
            toast(next === 'suspended' ? 'Account suspended' : 'Account activated');
            pageUsers();
          } catch (err) { toast(err.message, 'error'); }
        }
      });
    });
  } catch (err) {
    el.innerHTML = errorPage(err.message);
  }
}

async function openUserDetail(id) {
  const modal = openModal({
    title: 'User details',
    size: 'lg',
    body: '<div class="empty-state">' + ICON('refresh', 24) + '<p>Loading…</p></div>',
  });
  try {
    const data = await api('/admin/users/' + id);
    const u = data.user;
    $('.modal-body', modal).innerHTML = `
      <div class="cell-main" style="margin-bottom:18px">
        ${avatarHTML(u.name, 'lg')}
        <div><div style="font-size:17px;font-weight:600">${esc(u.name)}</div>
        <div class="muted" style="font-size:12px">${esc(u.email)}</div></div>
        <div style="margin-left:auto" class="badge-line">${badge(u.role)}${badge(u.status)}</div>
      </div>
      <dl class="kv">
        <dt>Joined</dt><dd>${esc(dateFmt(u.createdAt))}</dd>
        <dt>Videos</dt><dd>${fmt(u.videoCount)}</dd>
        <dt>Subscribers</dt><dd>${fmt(u.publicSubscribers)}</dd>
        <dt>Subscriptions</dt><dd>${fmt(u.subscriptions)}</dd>
        <dt>Account ID</dt><dd><code>${esc(u._id)}</code></dd>
      </dl>
      <div class="card-head" style="margin-top:22px"><h3>Recent videos</h3><span class="muted">${fmt(data.videos.length)}</span></div>
      ${data.videos.length ? '<div class="list">' + data.videos.map((v) => `
        <div class="list-row">${miniThumbHTML(v)}
          <div class="grow"><b><a href="/video/${esc(v._id)}" target="_blank" rel="noopener">${esc(v.title)}</a></b>
          <span>${fmt(v.views)} views · ${esc(dateFmt(v.createdAt))}</span></div>
          ${badge(v.status)}
        </div>`).join('') + '</div>'
        : '<div class="table-empty">This user has not uploaded any videos.</div>'}`;
  } catch (err) {
    $('.modal-body', modal).innerHTML = '<div class="table-empty">' + esc(err.message) + '</div>';
  }
}

async function pageUserList() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  try {
    const q = state.listQuery;
    const data = await api('/admin/users?' + qs({ page: q.page, q: q.q, limit: 20 }));
    state.charts = [];
    el.innerHTML = `
      ${pageHead('User list', 'Read-only directory of every account')}
      <form class="toolbar" id="listFilters">
        <div class="search-box">${ICON('search', 16)}
          <input type="search" name="q" placeholder="Search name or email" value="${esc(q.q)}" /></div>
        <button class="btn ghost sm" type="submit">${ICON('search', 15)} Search</button>
        <span class="spacer"></span>
        <span class="muted">${fmt(data.total)} accounts</span>
      </form>
      <div class="table-card">
        ${data.items.length ? `<div class="table-wrap"><table>
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th class="right">Videos</th>
            <th class="right">Subscribers</th><th class="right">Subscriptions</th><th>Joined</th><th class="right"></th></tr></thead>
          <tbody>${data.items.map((u) => `
            <tr>
              <td><div class="cell-main">${avatarHTML(u.name, 'sm')}
                <div><div class="cell-title">${esc(u.name)}</div><div class="cell-sub">${esc(u.email)}</div></div></div></td>
              <td>${badge(u.role)}</td><td>${badge(u.status)}</td>
              <td class="right">${fmt(u.videoCount)}</td>
              <td class="right">${fmt(u.publicSubscribers)}</td>
              <td class="right">${fmt(u.subscriptions)}</td>
              <td>${esc(dateFmt(u.createdAt))}</td>
              <td class="right"><button class="btn sm ghost" data-view="${esc(u._id)}">Details</button></td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('No accounts found', 'Try a different search.')}
        ${pagerHTML(data.page, data.pages, data.total, 'accounts')}
      </div>`;
    const form = $('#listFilters');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      q.q = String(new FormData(form).get('q') || '').trim();
      q.page = 1;
      pageUserList();
    });
    bindPager(el, (n) => { q.page = n; pageUserList(); });
    $$('[data-view]', el).forEach((btn) => btn.addEventListener('click', () => openUserDetail(btn.dataset.view)));
  } catch (err) {
    el.innerHTML = errorPage(err.message);
  }
}

/* ---------------- categories ---------------- */
async function pageCategories() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  try {
    const items = await api('/admin/categories');
    state.charts = [];
    el.innerHTML = `
      ${pageHead('Categories', 'Organize the library by topic')}
      <div class="grid two" style="align-items:start">
        <div class="table-card">
          <div class="table-wrap"><table>
            <thead><tr><th>Category</th><th class="right">Videos</th><th class="right">Views</th><th class="right">Actions</th></tr></thead>
            <tbody>${items.length ? items.map((c) => `
              <tr>
                <td><div class="cell-main"><span class="stat-icon red">${ICON('categories', 15)}</span><b>${esc(c.name)}</b></div></td>
                <td class="right">${fmt(c.videos)}</td>
                <td class="right">${fmt(c.views)}</td>
                <td class="right"><div class="row-actions">
                  <button class="icon-btn danger" data-delete="${esc(c.name)}" title="${c.videos ? 'Move or delete its videos first' : 'Delete category'}" ${c.videos ? 'disabled' : ''}>${ICON('trash', 16)}</button>
                </div></td>
              </tr>`).join('') : `<tr><td colspan="4"><div class="table-empty">No categories yet.</div></td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Add category</h3></div>
          <form id="addCategoryForm" class="form-stack">
            <label class="field"><span>Name</span>
              <input type="text" name="name" maxlength="40" placeholder="e.g. Education" required /></label>
            <div class="form-actions" style="margin-top:6px">
              <button class="btn primary" type="submit">${ICON('plus', 16)} Add category</button>
            </div>
          </form>
          <p class="muted" style="font-size:11.5px;line-height:1.6;margin:16px 0 0">
            Categories with videos cannot be deleted. Reassign those videos first.
          </p>
        </div>
      </div>`;

    $('#addCategoryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = e.target.name.value.trim();
      if (!name) return;
      try {
        await api('/admin/categories', { method: 'POST', body: { name } });
        toast('Category added');
        state.categories = null;
        pageCategories();
      } catch (err) { toast(err.message, 'error'); }
    });

    $$('[data-delete]', el).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.delete;
        const ok = await confirmDialog('Delete category', 'Delete the category “' + name + '”?', 'Delete', true);
        if (!ok) return;
        try {
          await api('/admin/categories/' + encodeURIComponent(name), { method: 'DELETE' });
          toast('Category deleted');
          state.categories = null;
          pageCategories();
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  } catch (err) {
    el.innerHTML = errorPage(err.message);
  }
}

/* ---------------- analytics ---------------- */
async function pageAnalytics() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  try {
    const d = await api('/admin/analytics?days=' + state.analyticsDays);
    state.charts = [];
    const viewsInRange = d.views.reduce((a, b) => a + b, 0);
    const uploadsInRange = d.uploads.reduce((a, b) => a + b, 0);
    const usersInRange = d.users.reduce((a, b) => a + b, 0);
    const avgViews = d.engagement.videos ? Math.round(d.engagement.views / d.engagement.videos) : 0;

    el.innerHTML = `
      ${pageHead('Analytics', 'Performance based on data stored on this server', `
        <select id="analyticsRange" style="width:auto">
          <option value="7" ${d.days === 7 ? 'selected' : ''}>Last 7 days</option>
          <option value="30" ${d.days === 30 ? 'selected' : ''}>Last 30 days</option>
          <option value="90" ${d.days === 90 ? 'selected' : ''}>Last 90 days</option>
          <option value="365" ${d.days === 365 ? 'selected' : ''}>Last 365 days</option>
        </select>`)}
      ${!d.viewsTrackedSince ? '<div class="notice info">Playback tracking starts from the first view recorded after installation. Totals include aggregate lifetime views.</div>' : ''}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-top"><span class="stat-label">Views in range</span><span class="stat-icon red">${ICON('eye', 17)}</span></div>
          <div class="stat-value">${fmt(viewsInRange)}</div>
          <div class="stat-sub">${d.viewsTrackedSince ? 'Tracked since ' + esc(dateFmt(d.viewsTrackedSince)) : 'Tracking not started yet'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><span class="stat-label">Uploads in range</span><span class="stat-icon orange">${ICON('videos', 17)}</span></div>
          <div class="stat-value">${fmt(uploadsInRange)}</div>
          <div class="stat-sub">${fmt(d.engagement.published)} published overall</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><span class="stat-label">New users in range</span><span class="stat-icon blue">${ICON('users', 17)}</span></div>
          <div class="stat-value">${fmt(usersInRange)}</div>
          <div class="stat-sub">${fmt(d.engagement.users)} total accounts</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><span class="stat-label">Avg. views / video</span><span class="stat-icon green">${ICON('analytics', 17)}</span></div>
          <div class="stat-value">${compact(avgViews)}</div>
          <div class="stat-sub">${fmt(d.engagement.likes)} likes · ${fmt(d.engagement.comments)} comments</div>
        </div>
      </div>
      <div class="card chart-card" style="margin-bottom:16px">
        <div class="card-head"><h3>Views</h3><span class="muted">${d.days} days</span></div>
        <div class="chart-wrap"><canvas id="anaViews"></canvas></div>
      </div>
      <div class="grid half" style="margin-bottom:16px">
        <div class="card chart-card">
          <div class="card-head"><h3>Uploads</h3><span class="muted">${d.days} days</span></div>
          <div class="chart-wrap short"><canvas id="anaUploads"></canvas></div>
        </div>
        <div class="card chart-card">
          <div class="card-head"><h3>New users</h3><span class="muted">${d.days} days</span></div>
          <div class="chart-wrap short"><canvas id="anaUsers"></canvas></div>
        </div>
      </div>
      <div class="grid two">
        <div class="table-card">
          <div class="card-head" style="padding:16px 16px 0;margin-bottom:10px"><h3>Top videos</h3><span class="muted">By total views</span></div>
          ${d.topVideos.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Video</th><th>Status</th><th class="right">Views</th><th class="right">Likes</th></tr></thead>
            <tbody>${d.topVideos.map((v) => `
              <tr><td><div class="cell-main">${thumbHTML(v)}<div style="min-width:0">
                <a class="cell-title" href="/video/${esc(v._id)}" target="_blank" rel="noopener">${esc(v.title)}</a>
                <div class="cell-sub">${esc(v.category || 'Other')}</div></div></div></td>
                <td>${badge(v.status)}</td><td class="right">${fmt(v.views)}</td>
                <td class="right">${fmt((v.likes || []).length)}</td></tr>`).join('')}
            </tbody></table></div>` : emptyState('No videos yet', 'Analytics will appear after videos are uploaded.')}
        </div>
        <div class="table-card">
          <div class="card-head" style="padding:16px 16px 0;margin-bottom:10px"><h3>Categories</h3><span class="muted">Videos & views</span></div>
          ${d.categories.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Category</th><th class="right">Videos</th><th class="right">Views</th></tr></thead>
            <tbody>${d.categories.map((c) => `<tr><td>${esc(c.category)}</td>
              <td class="right">${fmt(c.videos)}</td><td class="right">${fmt(c.views)}</td></tr>`).join('')}
            </tbody></table></div>` : emptyState('No categories', 'Upload videos to build category analytics.')}
        </div>
      </div>`;

    lineChart($('#anaViews'), d.labels, [{ data: d.views, color: '#f10d24' }], {
      emptyText: 'No views recorded in this period',
    });
    barChart($('#anaUploads'), d.labels, d.uploads, { emptyText: 'No uploads in this period' });
    lineChart($('#anaUsers'), d.labels, [{ data: d.users, color: '#4c8dff', fillColor: 'rgba(76,141,255,0.18)' }], {
      emptyText: 'No new users in this period',
    });
    $('#analyticsRange').addEventListener('change', (e) => {
      state.analyticsDays = parseInt(e.target.value, 10) || 30;
      pageAnalytics();
    });
  } catch (err) {
    el.innerHTML = errorPage(err.message);
  }
}

/* ---------------- reports ---------------- */
async function pageReports() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  try {
    const data = await api('/admin/reports');
    state.charts = [];
    el.innerHTML = `
      ${pageHead('Reports', 'Community reports awaiting review')}
      <div class="table-card">
        ${data.items.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Comment</th><th>Comment author</th><th>Reported by</th><th>Reason</th><th>Date</th><th class="right">Actions</th></tr></thead>
          <tbody>${data.items.map((r) => `
            <tr>
              <td style="max-width:320px">
                <div class="cell-title">${esc(r.commentText)}</div>
                <div class="cell-sub">${esc(r.videoTitle)}</div>
              </td>
              <td>${esc(r.commentUserName)}</td>
              <td>${esc(r.reporterName)}</td>
              <td style="max-width:220px"><div class="cell-title">${esc(r.reason || 'No reason given')}</div></td>
              <td>${esc(dateFmt(r.createdAt))}</td>
              <td><div class="row-actions" style="gap:6px">
                ${r.videoId ? `<button class="btn sm ghost" data-view-video="${esc(r.videoId)}">View video</button>` : ''}
                ${r.commentExists ? `<button class="btn sm danger" data-delete-comment="${esc(r.commentId)}">Delete comment</button>` : ''}
                <button class="btn sm ghost" data-dismiss="${esc(r._id)}">Dismiss</button>
              </div></td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('No open reports', 'Reports submitted from the public site will appear here.')}
      </div>`;

    $$('[data-view-video]', el).forEach((btn) => btn.addEventListener('click', () => {
      window.open('/video/' + encodeURIComponent(btn.dataset.viewVideo), '_blank', 'noopener');
    }));
    $$('[data-delete-comment]', el).forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDialog('Delete comment', 'Delete this comment and close all reports attached to it?', 'Delete comment', true);
      if (!ok) return;
      try {
        await api('/admin/comments/' + btn.dataset.deleteComment, { method: 'DELETE' });
        toast('Comment deleted');
        pageReports();
      } catch (err) { toast(err.message, 'error'); }
    }));
    $$('[data-dismiss]', el).forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDialog('Dismiss report', 'Dismiss this report without deleting the comment?', 'Dismiss report');
      if (!ok) return;
      try {
        await api('/admin/reports/' + btn.dataset.dismiss, { method: 'DELETE' });
        toast('Report dismissed');
        pageReports();
      } catch (err) { toast(err.message, 'error'); }
    }));
  } catch (err) {
    el.innerHTML = errorPage(err.message);
  }
}

/* ---------------- comments ---------------- */
async function pageComments() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  try {
    const q = state.commentsQuery;
    const data = await api('/admin/comments?' + qs(q));
    state.charts = [];
    el.innerHTML = `
      ${pageHead('Comments', 'Moderate discussion across videos')}
      <form class="toolbar" id="commentFilters">
        <div class="search-box">${ICON('search', 16)}
          <input type="search" name="q" placeholder="Search comments, authors, videos" value="${esc(q.q)}" /></div>
        <button class="btn ghost sm" type="submit">${ICON('search', 15)} Search</button>
      </form>
      <div class="table-card">
        ${data.items.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Comment</th><th>Video</th><th>Author</th><th>Reports</th><th>Date</th><th class="right">Actions</th></tr></thead>
          <tbody>${data.items.map((c) => `
            <tr>
              <td style="max-width:360px"><div class="cell-title">${esc(c.desc)}</div></td>
              <td style="max-width:220px"><div class="cell-title">${esc(c.videoTitle)}</div></td>
              <td>${esc(c.userName)}</td>
              <td>${c.reportCount ? '<span class="badge suspended">' + fmt(c.reportCount) + ' open</span>' : '<span class="muted">—</span>'}</td>
              <td>${esc(dateFmt(c.createdAt))}</td>
              <td><div class="row-actions">
                <button class="icon-btn" data-view-video="${esc(c.videoId)}" title="View video">${ICON('eye', 16)}</button>
                <button class="icon-btn danger" data-delete="${esc(c._id)}" title="Delete comment">${ICON('trash', 16)}</button>
              </div></td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('No comments found', q.q ? 'No comments match your search.' : 'Comments posted on videos will appear here.')}
        ${pagerHTML(data.page, data.pages, data.total, 'comments')}
      </div>`;

    const form = $('#commentFilters');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      q.q = String(new FormData(form).get('q') || '').trim();
      q.page = 1;
      pageComments();
    });
    bindPager(el, (n) => { q.page = n; pageComments(); });
    $$('[data-view-video]', el).forEach((btn) => btn.addEventListener('click', () => {
      window.open('/video/' + encodeURIComponent(btn.dataset.viewVideo), '_blank', 'noopener');
    }));
    $$('[data-delete]', el).forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDialog('Delete comment', 'Delete this comment permanently? Any reports attached to it will be closed.', 'Delete comment', true);
      if (!ok) return;
      try {
        await api('/admin/comments/' + btn.dataset.delete, { method: 'DELETE' });
        toast('Comment deleted');
        pageComments();
      } catch (err) { toast(err.message, 'error'); }
    }));
  } catch (err) {
    el.innerHTML = errorPage(err.message);
  }
}

/* ---------------- tags ---------------- */
async function pageTags() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  try {
    const items = await api('/admin/tags');
    state.charts = [];
    el.innerHTML = `
      ${pageHead('Tags', 'Tags discovered from uploaded videos')}
      <form class="toolbar" id="tagFilters">
        <div class="search-box">${ICON('search', 16)}
          <input type="search" id="tagSearch" placeholder="Filter tags" /></div>
        <span class="spacer"></span>
        <span class="muted" id="tagCount">${fmt(items.length)} tags</span>
      </form>
      <div class="table-card">
        ${items.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Tag</th><th class="right">Videos</th><th class="right">Views</th></tr></thead>
          <tbody id="tagRows">${items.map((t) => `
            <tr data-tag="${esc(t.tag)}"><td><span class="badge user">#${esc(t.tag)}</span></td>
              <td class="right">${fmt(t.videos)}</td><td class="right">${fmt(t.views)}</td></tr>`).join('')}
          </tbody>
        </table></div>` : emptyState('No tags yet', 'Tags are added when you upload or edit a video.')}
      </div>`;

    $('#tagSearch').addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      let shown = 0;
      $$('#tagRows tr').forEach((row) => {
        const match = row.dataset.tag.includes(term);
        row.classList.toggle('hidden', !match);
        if (match) shown += 1;
      });
      $('#tagCount').textContent = shown + ' tags';
    });
  } catch (err) {
    el.innerHTML = errorPage(err.message);
  }
}

/* ---------------- settings ---------------- */
async function pageSettings() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  try {
    const s = await api('/admin/settings');
    state.charts = [];
    el.innerHTML = `
      ${pageHead('Settings', 'Platform configuration and your administrator profile')}
      <div class="grid half" style="align-items:start">
        <div class="card">
          <div class="card-head"><h3>Platform settings</h3></div>
          <form id="siteForm" class="form-stack">
            <label class="field"><span>Site name</span>
              <input type="text" name="siteName" minlength="2" maxlength="40" required value="${esc(s.siteName)}" /></label>
            <div>
              <div class="switch-row">
                <div><b>Allow user uploads</b><span>Let regular users upload videos from the public site.</span></div>
                <label class="switch"><input type="checkbox" name="allowUserUploads" ${s.allowUserUploads ? 'checked' : ''} /><span class="track"></span></label>
              </div>
              <div class="switch-row">
                <div><b>Require admin approval</b><span>New user uploads stay pending until an administrator publishes them.</span></div>
                <label class="switch"><input type="checkbox" name="requireApproval" ${s.requireApproval ? 'checked' : ''} /><span class="track"></span></label>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn primary" type="submit">Save settings</button>
            </div>
          </form>
        </div>

        <div class="card">
          <div class="card-head"><h3>Administrator profile</h3></div>
          <form id="profileForm" class="form-stack">
            <label class="field"><span>Name</span>
              <input type="text" name="name" minlength="3" maxlength="32" required value="${esc(state.user.name)}" /></label>
            <label class="field"><span>Email</span>
              <input type="email" name="email" required value="${esc(state.user.email || '')}" /></label>
            <div class="field-row">
              <label class="field"><span>Current password</span>
                <input type="password" name="currentPassword" autocomplete="current-password" placeholder="Required to change password" /></label>
              <label class="field"><span>New password</span>
                <input type="password" name="newPassword" autocomplete="new-password" minlength="6" placeholder="At least 6 characters" /></label>
            </div>
            <label class="field"><span>Confirm new password</span>
              <input type="password" name="confirmPassword" autocomplete="new-password" /></label>
            <div class="form-actions">
              <button class="btn primary" type="submit">Save profile</button>
            </div>
          </form>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>Data & security</h3></div>
        <div class="list">
          <div class="list-row"><span class="stat-icon green">${ICON('access', 16)}</span><div class="grow"><b>Administrator routes are protected</b><span>Every /api/admin request verifies the JWT and re-checks the account role and status.</span></div></div>
          <div class="list-row"><span class="stat-icon blue">${ICON('folder', 16)}</span><div class="grow"><b>JSON-backed storage</b><span>Videos, users and settings are stored in server/data.json with uploads under server/uploads.</span></div></div>
          <div class="list-row"><span class="stat-icon orange">${ICON('settings', 16)}</span><div class="grow"><b>Passwords are hashed</b><span>Account passwords are stored as bcrypt hashes and never returned by the API.</span></div></div>
        </div>
      </div>`;

    $('#siteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      try {
        await api('/admin/settings', {
          method: 'PUT',
          body: {
            siteName: form.siteName.value.trim(),
            allowUserUploads: form.allowUserUploads.checked,
            requireApproval: form.requireApproval.checked,
          },
        });
        toast('Settings saved');
      } catch (err) { toast(err.message, 'error'); }
    });

    $('#profileForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const body = { name: form.name.value.trim(), email: form.email.value.trim() };
      if (form.newPassword.value) {
        if (form.newPassword.value !== form.confirmPassword.value) {
          return toast('New passwords do not match', 'error');
        }
        body.currentPassword = form.currentPassword.value;
        body.newPassword = form.newPassword.value;
      }
      try {
        const updated = await api('/admin/profile', { method: 'PUT', body });
        state.user = Object.assign({}, state.user, {
          name: updated.name,
          email: updated.email,
          role: updated.role,
          status: updated.status,
        });
        localStorage.setItem('user', JSON.stringify(state.user));
        updateIdentity();
        form.currentPassword.value = '';
        form.newPassword.value = '';
        form.confirmPassword.value = '';
        toast('Profile updated');
      } catch (err) { toast(err.message, 'error'); }
    });
  } catch (err) {
    el.innerHTML = errorPage(err.message);
  }
}

/* ---------------- access control ---------------- */
async function pageAccess() {
  const el = $('#page');
  el.innerHTML = loadingPage();
  try {
    const d = await api('/admin/access');
    state.charts = [];
    el.innerHTML = `
      ${pageHead('Access control', 'Administrator accounts, policies and audit history', `
        <a class="btn ghost" href="#/users">${ICON('users', 16)} Manage users</a>`)}
      <div class="stats-grid three">
        <div class="stat-card">
          <div class="stat-top"><span class="stat-label">Active admins</span><span class="stat-icon purple">${ICON('access', 17)}</span></div>
          <div class="stat-value">${fmt(d.activeAdmins)}</div>
          <div class="stat-sub">At least one must remain active</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><span class="stat-label">Total admins</span><span class="stat-icon blue">${ICON('users', 17)}</span></div>
          <div class="stat-value">${fmt(d.admins.length)}</div>
          <div class="stat-sub">Including suspended accounts</div>
        </div>
        <div class="stat-card">
          <div class="stat-top"><span class="stat-label">Audit entries</span><span class="stat-icon orange">${ICON('history', 17)}</span></div>
          <div class="stat-value">${fmt(d.audit.length)}</div>
          <div class="stat-sub">Most recent privileged actions</div>
        </div>
      </div>

      <div class="grid two" style="margin-bottom:16px;align-items:start">
        <div class="table-card">
          <div class="card-head" style="padding:16px 16px 0;margin-bottom:10px"><h3>Administrators</h3></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Admin</th><th>Status</th><th>Since</th></tr></thead>
            <tbody>${d.admins.length ? d.admins.map((a) => `
              <tr><td><div class="cell-main">${avatarHTML(a.name, 'sm')}
                <div><div class="cell-title">${esc(a.name)}</div><div class="cell-sub">${esc(a.email)}</div></div></div></td>
                <td>${badge(a.status)}</td><td>${esc(dateFmt(a.createdAt))}</td></tr>`).join('')
              : '<tr><td colspan="3"><div class="table-empty">No administrators.</div></td></tr>'}</tbody>
          </table></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Security policies</h3></div>
          <div class="list">${d.policies.map((p) => `
            <div class="list-row"><span class="stat-icon green">${ICON('check', 14)}</span>
              <div class="grow"><span style="color:#d8d8d8;font-size:12.5px;line-height:1.5">${esc(p)}</span></div></div>`).join('')}
          </div>
          <div class="notice info" style="margin:14px 0 0">
            Create a first administrator from the terminal with <code style="color:#cfe0ff">npm run create-admin</code>,
            or promote an existing account under Users.
          </div>
        </div>
      </div>

      <div class="table-card">
        <div class="card-head" style="padding:16px 16px 0;margin-bottom:10px"><h3>Audit log</h3><span class="muted">Latest 100 actions</span></div>
        ${d.audit.length ? `<div class="table-wrap"><table>
          <thead><tr><th>When</th><th>Administrator</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
          <tbody>${d.audit.map((a) => `
            <tr><td style="white-space:nowrap">${esc(dateFmt(a.at))} <span class="muted">${esc(new Date(a.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))}</span></td>
              <td>${esc(a.adminName)}</td>
              <td><code style="font-size:11.5px;color:#c9c9c9">${esc(a.action)}</code></td>
              <td><span class="cell-title" style="max-width:200px">${esc(a.target || '—')}</span></td>
              <td><span class="cell-title" style="max-width:320px">${esc(a.detail || '—')}</span></td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('No audit entries yet', 'Privileged actions will be recorded here.')}
      </div>`;
  } catch (err) {
    el.innerHTML = errorPage(err.message);
  }
}

/* ---------------- navigation & shell ---------------- */
const NAV = [
  { group: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }] },
  {
    group: 'Manage',
    items: [
      { id: 'videos', label: 'Videos', icon: 'videos' },
      { id: 'users', label: 'Users', icon: 'users' },
      { id: 'user-list', label: 'User List', icon: 'userlist' },
      { id: 'categories', label: 'Categories', icon: 'categories' },
      { id: 'upload', label: 'Upload Video', icon: 'upload' },
      { id: 'analytics', label: 'Analytics', icon: 'analytics' },
      { id: 'reports', label: 'Reports', icon: 'reports' },
      { id: 'comments', label: 'Comments', icon: 'comments' },
      { id: 'tags', label: 'Tags', icon: 'tags' },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'settings', label: 'Settings', icon: 'settings' },
      { id: 'access', label: 'Access Control', icon: 'access' },
    ],
  },
];

const PAGE_META = {
  dashboard: 'Dashboard',
  videos: 'Videos',
  users: 'Users',
  'user-list': 'User list',
  categories: 'Categories',
  upload: 'Upload video',
  analytics: 'Analytics',
  reports: 'Reports',
  comments: 'Comments',
  tags: 'Tags',
  settings: 'Settings',
  access: 'Access control',
};

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = NAV.map((group) => `
    <div class="nav-group">${esc(group.group)}</div>
    ${group.items.map((item) => `
      <a class="nav-item ${state.page === item.id ? 'active' : ''}" href="#/${item.id}">
        ${ICON(item.icon, 18)}<span class="nav-label">${esc(item.label)}</span>
      </a>`).join('')}
  `).join('');
  $$('.nav-item', nav).forEach((link) => link.addEventListener('click', () => closeSidebar()));
}

function updateIdentity() {
  const u = state.user || {};
  const first = initials(u.name);
  const avatars = $$('#sidebarAvatar, #topbarAvatar');
  avatars.forEach((a) => { a.textContent = first; });
  $('#sidebarName').textContent = u.name || 'Administrator';
  $('#sidebarRole').textContent = u.role || 'Admin';
  $('#topbarAvatar').title = u.name || '';
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.remove('show');
}

function openSidebar() {
  $('#sidebar').classList.add('open');
  $('#overlay').classList.add('show');
}

function showLogin(message) {
  $('#adminView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
  const err = $('#loginError');
  if (message) {
    err.textContent = message;
    err.classList.add('show');
  } else {
    err.textContent = '';
    err.classList.remove('show');
  }
  setTimeout(() => $('#loginName').focus(), 50);
}

function showAdmin() {
  $('#loginView').classList.add('hidden');
  $('#adminView').classList.remove('hidden');
  updateIdentity();
  renderNav();
  if (!location.hash || location.hash === '#') {
    location.hash = '#/dashboard';
  } else {
    route();
  }
}

async function route() {
  if (!state.user) return;
  const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const page = raw.split('?')[0];
  state.page = PAGE_META[page] ? page : 'dashboard';
  state.charts = [];
  closeModal();
  renderNav();
  $('#topbarPage').textContent = PAGE_META[state.page];
  const el = $('#page');
  try {
    switch (state.page) {
      case 'videos': return await pageVideos();
      case 'users': return await pageUsers();
      case 'user-list': return await pageUserList();
      case 'categories': return await pageCategories();
      case 'upload': return await pageUpload();
      case 'analytics': return await pageAnalytics();
      case 'reports': return await pageReports();
      case 'comments': return await pageComments();
      case 'tags': return await pageTags();
      case 'settings': return await pageSettings();
      case 'access': return await pageAccess();
      default: return await pageDashboard();
    }
  } catch (err) {
    el.innerHTML = errorPage(err.message || 'Could not load this page');
  }
}

/* ---------------- login / boot ---------------- */
async function handleLogin(e) {
  e.preventDefault();
  const err = $('#loginError');
  err.classList.remove('show');
  const name = $('#loginName').value.trim();
  const password = $('#loginPass').value;
  const btn = $('#loginSubmit');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    const credentials = name.includes('@') ? { email: name, password } : { name, password };
    const res = await api('/auth/signin', { method: 'POST', body: credentials });
    if (!res.user || res.user.role !== 'admin') {
      err.textContent = 'This account does not have administrator access.';
      err.classList.add('show');
      return;
    }
    saveSession(res.token, res.user);
    const me = await api('/admin/me');
    state.user = me;
    localStorage.setItem('user', JSON.stringify(me));
    $('#loginPass').value = '';
    showAdmin();
  } catch (error) {
    err.textContent = error.message || 'Sign in failed';
    err.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in to Studio';
  }
}

async function boot() {
  $('#loginForm').addEventListener('submit', handleLogin);
  $('#menuBtn').innerHTML = ICON('menu', 20);
  $('#menuBtn').addEventListener('click', openSidebar);
  $('#overlay').addEventListener('click', closeSidebar);
  $('#logoutBtn').innerHTML = ICON('logout', 18);
  window.addEventListener('hashchange', () => { if (state.user) route(); });
  $('#logoutBtn').addEventListener('click', async () => {
    const ok = await confirmDialog('Sign out', 'Sign out of MyTube Studio on this device?', 'Sign out');
    if (!ok) return;
    closeModal();
    clearSession();
    location.href = '/admin/';
  });
  $('#topbarAvatar').addEventListener('click', () => { location.hash = '#/settings'; });
  $('#viewSiteBtn').addEventListener('click', () => {
    window.open('/', '_blank', 'noopener');
  });

  if (!state.token) {
    showLogin();
    return;
  }
  try {
    const me = await api('/admin/me');
    if (!me || me.role !== 'admin') throw Object.assign(new Error('Administrator access required'), { status: 403 });
    state.user = me;
    localStorage.setItem('user', JSON.stringify(me));
    showAdmin();
  } catch (err) {
    clearSession();
    showLogin(err.status === 403 ? 'Administrator access is required. Sign in with an admin account.' : 'Your session expired. Please sign in again.');
  }
}

boot();

