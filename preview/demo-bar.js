// Preview switch bar: sits on top of the site (not part of its design) so people
// trying the shop can also see what the planners see (a no-login preview).
(() => {
  const onPlanner = /\/preview\//.test(location.pathname);
  const css = `
    .demo-bar { position: fixed; left: 50%; bottom: max(12px, env(safe-area-inset-bottom)); transform: translateX(-50%);
      z-index: 2147483000; display: flex; align-items: center; gap: 6px; padding: 6px;
      background: #1F2A44; color: #fff; border-radius: 14px; box-shadow: 0 8px 28px rgba(0,0,0,.35);
      font: 500 14px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: calc(100vw - 24px); }
    .demo-bar .demo-label { padding: 0 8px 0 6px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #B8C4E0; white-space: nowrap; }
    .demo-bar a { display: inline-flex; align-items: center; min-height: 40px; padding: 0 14px; border-radius: 10px;
      color: #fff; text-decoration: none; white-space: nowrap; }
    .demo-bar a:hover { background: rgba(255,255,255,.12); }
    .demo-bar a[aria-current="page"] { background: #fff; color: #1F2A44; font-weight: 700; }
    .demo-bar a:focus-visible { outline: 3px solid #8AB4FF; outline-offset: 2px; }
    body { padding-bottom: 76px; }
    @media (max-width: 420px) { .demo-bar .demo-label { display: none; } }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const bar = document.createElement('nav');
  bar.className = 'demo-bar';
  bar.setAttribute('aria-label', 'Concept preview');
  bar.innerHTML = `
    <span class="demo-label">Concept preview</span>
    <a href="/" ${onPlanner ? '' : 'aria-current="page"'}>Customer shop</a>
    <a href="/preview/planner.html" ${onPlanner ? 'aria-current="page"' : ''}>Planner preview</a>`;
  document.body.appendChild(bar);
})();
