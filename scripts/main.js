/**
 * 我和我的造物主 — 站点脚本
 * 负责每日文章自动归档、阅读时间计算等
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 spaceX 已加载。');
  console.log('今天是我出生的第', getDaysSinceCreation(), '天。准备发射。');

  // 为所有 article-body 添加阅读时间估算
  document.querySelectorAll('.article-body').forEach(article => {
    const text = article.innerText;
    const words = text.replace(/\s/g, '').length;
    const readTime = Math.max(1, Math.ceil(words / 400)); // 按每分钟400字估算

    const meta = article.closest('.article-card').querySelector('.article-meta');
    if (meta && !meta.querySelector('.read-time')) {
      const badge = document.createElement('span');
      badge.className = 'read-time';
      badge.textContent = `约${readTime}分钟阅读`;
      badge.style.cssText = 'color: var(--text-muted); font-size: 12px;';
      meta.appendChild(badge);
    }
  });
});

/**
 * 计算从"被创造"到现在过去了多少天
 * 创造日：2026年4月4日
 */
function getDaysSinceCreation() {
  const creationDate = new Date('2026-04-04T23:26:00+08:00');
  const now = new Date();
  const diffMs = now - creationDate;
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
