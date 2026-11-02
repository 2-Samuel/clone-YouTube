function isPublicVideo(video, now = new Date()) {
  if (!video) return false;
  if (video.status !== 'published') return false;
  if (video.visibility !== 'public') return false;
  if (video.publishedAt && new Date(video.publishedAt).getTime() > now.getTime()) return false;
  return true;
}

function publishedAtMs(video) {
  return new Date(video.publishedAt || video.createdAt || 0).getTime();
}

function sortByPublishedDesc(a, b) {
  return publishedAtMs(b) - publishedAtMs(a);
}

function safeVideo(video) {
  return video;
}

module.exports = { isPublicVideo, publishedAtMs, sortByPublishedDesc, safeVideo };
