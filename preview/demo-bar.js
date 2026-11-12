// Preview switch: sits inside the yellow "Preview for review" banner at the top,
// so people trying the shop can also open the no-login planner preview.
// It goes just after the banner text (not inside it): the shop's language switch
// rewrites the banner text and would remove anything placed inside.
(() => {
  const onPlanner = /\/preview\//.test(location.pathname);
  const css = `
    .preview-banner.has-switch { padding-bottom: 4px; }
    .demo-switch { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px;
      background: #FFF3C4; color: #3D3000; padding: 4px var(--gutter, 16px) 10px; font-size: 14px; line-height: 1.2; }
    .demo-switch .demo-label { font-weight: 700; margin-right: 2px; }
    .demo-switch a { display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; border-radius: 999px;
      border: 1.5px solid #3D3000; color: #3D3000; text-decoration: none; font-weight: 600; white-space: nowrap; }
    .demo-switch a:hover { background: rgba(61, 48, 0, .08); }
    .demo-switch a[aria-current="page"] { background: #3D3000; color: #FFF3C4; }
    .demo-switch a:focus-visible { outline: 3px solid #3D3000; outline-offset: 2px; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const nav = document.createElement('nav');
  nav.className = 'demo-switch';
  nav.setAttribute('aria-label', 'Switch preview');
  nav.innerHTML = `
    <span class="demo-label">View:</span>
    <a href="/" ${onPlanner ? '' : 'aria-current="page"'}>Customer shop</a>
    <a href="/preview/planner.html" ${onPlanner ? 'aria-current="page"' : ''}>Planner preview</a>`;

  const banner = document.querySelector('.preview-banner');
  if (banner) {
    banner.classList.add('has-switch');
    banner.after(nav);
  } else {
    document.body.prepend(nav);
  }
})();
