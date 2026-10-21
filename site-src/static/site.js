// factfile.dev — progressive enhancement and motion. Content works without it; motion respects prefers-reduced-motion.
(() => {
  const root = document.documentElement;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = (els, fn, opts = { threshold: 0.25 }) => {
    if (!('IntersectionObserver' in window) || calm) { els.forEach(fn); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { fn(e.target); io.unobserve(e.target); } }), opts);
    els.forEach((el) => io.observe(el));
  };

  // Theme toggle (follows the system until chosen; remembered on this device).
  const themeBtn = document.querySelector('.theme-btn');
  if (themeBtn) {
    const dark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const label = () => themeBtn.setAttribute('aria-label', dark() ? 'Switch to light theme' : 'Switch to dark theme');
    label();
    themeBtn.addEventListener('click', () => { root.dataset.theme = dark() ? 'light' : 'dark'; try { localStorage.setItem('theme', root.dataset.theme); } catch {} label(); });
  }

  // Header shadow once scrolled.
  const header = document.querySelector('.site-header');
  const onScroll = () => header && header.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Mobile menu.
  const menuBtn = document.querySelector('.menu-btn'), nav = document.getElementById('site-nav');
  if (menuBtn && nav) {
    const set = (open) => { nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
    menuBtn.addEventListener('click', () => set(!nav.classList.contains('open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); menuBtn.focus(); } });
    matchMedia('(min-width: 62.01rem)').addEventListener('change', () => set(false));
  }

  // Scroll reveals.
  seen([...document.querySelectorAll('.reveal, .reveal-scale')], (el) => el.classList.add('in'), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  // Hero: highlight each Verdict claim and pop its receipt, then hold them all.
  const lines = [...document.querySelectorAll('.vline')];
  if (lines.length) {
    if (calm) lines.forEach((l) => l.classList.add('on'));
    else lines.forEach((l, i) => setTimeout(() => l.classList.add('on'), 1500 + i * 450));
  }

  // Desk props drift with the cursor and the scroll.
  const props = [...document.querySelectorAll('.prop')];
  if (props.length && !calm && matchMedia('(pointer: fine)').matches) {
    let mx = 0, my = 0, raf = 0;
    const paint = () => {
      raf = 0;
      props.forEach((p) => { const d = +p.dataset.depth || 20; p.style.transform = `translate3d(${mx * d}px, ${my * d - scrollY * d / 90}px, 0)`; });
    };
    const req = () => { if (!raf) raf = requestAnimationFrame(paint); };
    addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; req(); }, { passive: true });
    addEventListener('scroll', req, { passive: true });
  }

  // Terminal types its command, then prints the output.
  document.querySelectorAll('[data-term]').forEach((term) => {
    const t = term.querySelector('[data-type]'), outs = [...term.querySelectorAll('.out')], text = t.dataset.type;
    if (calm) { t.textContent = text; outs.forEach((o) => o.classList.add('in')); return; }
    seen([term], () => {
      let i = 0;
      const type = () => { t.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(type, 28 + Math.random() * 40); else outs.forEach((o, k) => setTimeout(() => o.classList.add('in'), 350 + k * 380)); };
      setTimeout(type, 300);
    });
  });

  // Validator report and signposts animate when in view.
  seen([...document.querySelectorAll('[data-report], [data-posts]')], (el) => setTimeout(() => el.classList.add('in'), 300));

  // FAQ: animate open and close.
  document.querySelectorAll('.faq details').forEach((d) => {
    const s = d.querySelector('summary'), a = d.querySelector('.ans');
    s.addEventListener('click', (e) => {
      if (calm || !a.animate) return;
      e.preventDefault();
      if (d.open) {
        a.animate([{ height: a.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 260, easing: 'cubic-bezier(.2,.7,.1,1)' }).onfinish = () => { d.open = false; };
      } else {
        d.open = true; const h = a.offsetHeight;
        a.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.7,.1,1)' });
      }
    });
  });

  // Scrolling code blocks must be reachable by keyboard.
  const markScrollers = () => document.querySelectorAll('pre').forEach((pre) => {
    if (pre.scrollWidth > pre.clientWidth) { pre.tabIndex = 0; pre.setAttribute('role', 'region'); pre.setAttribute('aria-label', 'Code: ' + pre.textContent.trim().split('\n')[0].slice(0, 60)); }
    else if (pre.getAttribute('role') === 'region') { pre.removeAttribute('tabindex'); pre.removeAttribute('role'); pre.removeAttribute('aria-label'); }
  });
  markScrollers(); addEventListener('resize', markScrollers, { passive: true });

  // Copy buttons on command blocks.
  document.querySelectorAll('.cmd pre').forEach((pre) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'copy'; btn.textContent = 'Copy'; btn.setAttribute('aria-label', 'Copy command');
    btn.addEventListener('click', async () => {
      const text = pre.innerText.split('\n').map((l) => l.replace(/\s+#.*$/, '')).join('\n').trim();
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; btn.dataset.copied = ''; setTimeout(() => window.coffeeToast && window.coffeeToast('Copied. If this saves you time, consider a coffee.'), 900); } catch { btn.textContent = 'Select and copy'; }
      setTimeout(() => { btn.textContent = 'Copy'; delete btn.dataset.copied; }, 1800);
    });
    pre.parentElement.appendChild(btn);
  });

  // Coffee: one floating button, shown once the visitor has seen some value; dismissals are remembered for a week.
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const snoozed = () => +(store.get('coffeeSnooze') || 0) > Date.now();
  const snooze = () => store.set('coffeeSnooze', String(Date.now() + 7 * 864e5));
  const kofi = document.querySelector('[data-kofi]');
  if (kofi && !snoozed()) {
    const btn = kofi.querySelector('.kofi-btn'), panel = kofi.querySelector('.kofi-panel');
    let shown = false;
    const show = () => { if (shown || snoozed()) return; shown = true; kofi.hidden = false; };
    const onDepth = () => { const d = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight); if (d > 0.35) { show(); removeEventListener('scroll', onDepth); } };
    addEventListener('scroll', onDepth, { passive: true });
    setTimeout(show, 45000);
    const setOpen = (open) => { panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) panel.querySelector('.btn').focus(); };
    btn.addEventListener('click', () => setOpen(panel.hidden));
    kofi.querySelector('.kofi-close').addEventListener('click', () => { snooze(); kofi.hidden = true; btn.focus(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); btn.focus(); } });
    document.addEventListener('click', (e) => { if (!panel.hidden && !kofi.contains(e.target)) setOpen(false); });
  }

  // Coffee: thank people right after they copy a command (their clearest moment of value), once per visit.
  const toast = document.querySelector('.toast');
  window.coffeeToast = (msg) => {
    if (!toast || snoozed()) return;
    try { if (sessionStorage.getItem('coffeeToast')) return; sessionStorage.setItem('coffeeToast', '1'); } catch {}
    toast.querySelector('.toast-msg').textContent = msg;
    toast.hidden = false;
    const hide = () => { toast.hidden = true; };
    toast.querySelector('.toast-x').onclick = () => { hide(); snooze(); };
    setTimeout(hide, 12000);
  };

  // Specification: mark the section in view.
  const toc = document.querySelector('.toc');
  if (toc && 'IntersectionObserver' in window) {
    const links = new Map([...toc.querySelectorAll('a[href^="#"]')].map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => { a.classList.remove('active'); a.removeAttribute('aria-current'); });
      const a = links.get(e.target.id); if (a) { a.classList.add('active'); a.setAttribute('aria-current', 'location'); }
    }), { rootMargin: '-15% 0px -75% 0px' });
    links.forEach((_, id) => { const h = document.getElementById(id); if (h) io.observe(h); });
  }
})();
