// factfile.dev/generate — draft, edit, check and download a factfile.md in the browser.
// Uses window.Factfile (factfile-tools.js), the same code as `npx factfile`.
(() => {
  const F = window.Factfile;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };

  // ---------- fetch through the factfile.dev relay ----------
  async function relayFetch(input, opts = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const q = new URLSearchParams({ url });
    if (opts.redirect === 'manual') q.set('redirect', 'manual');
    const headers = {};
    const acc = opts.headers && (opts.headers.accept || opts.headers.Accept);
    if (acc) headers['x-accept'] = acc;
    const r = await fetch('/api/fetch?' + q, { headers, signal: opts.signal });
    if (!r.ok) {
      let msg = `The relay returned ${r.status}.`;
      try { msg = (await r.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    let passed = {};
    try { passed = JSON.parse(decodeURIComponent(r.headers.get('x-relay-headers') || '%7B%7D')); } catch {}
    const status = +(r.headers.get('x-relay-status') || 200);
    const body = await r.arrayBuffer();
    const res = new Response(status === 204 || status === 304 || (status >= 300 && status < 400) ? null : body, { status: status >= 200 && status <= 599 ? status : 502, headers: passed });
    Object.defineProperty(res, 'url', { value: r.headers.get('x-relay-url') || url });
    return res;
  }
  let relayOk = null;
  async function relayAvailable() {
    if (relayOk !== null) return relayOk;
    try { const r = await fetch('/api/fetch?url=' + encodeURIComponent('https://factfile.dev/robots.txt'), { method: 'GET' }); relayOk = r.ok || r.status === 502 || r.status === 400; }
    catch { relayOk = false; }
    return relayOk;
  }

  // ---------- elements ----------
  const start = $('#gen-start'), work = $('#gen-work'), log = $('#gen-log');
  const ta = $('#gen-text'), gutter = $('#gen-gutter');
  const todoList = $('#gen-todos'), todoCount = $$('[data-todo-count]');
  const checkOut = $('#gen-check'), previewOut = $('#gen-preview'), setupOut = $('#gen-setup');
  const levelSteps = $$('.gen-level li');
  let state = { origin: null, name: null, platform: null, findings: [], todos: [], online: null };

  // ---------- start options ----------
  const normalise = (v) => { v = v.trim(); if (!v) return null; if (!/^https?:\/\//i.test(v)) v = 'https://' + v; try { return new URL(v).origin; } catch { return null; } };
  const say = (html, kind = '') => { log.hidden = false; log.className = 'gen-log ' + kind; log.innerHTML = html; };

  $('#gen-from-site').addEventListener('submit', async (e) => {
    e.preventDefault();
    const origin = normalise($('#gen-url').value);
    if (!origin) return say('Enter your website address, for example <code>example.com</code>.', 'bad');
    const btn = e.submitter || $('#gen-from-site button'); btn.disabled = true;
    say('<span class="spin" aria-hidden="true"></span> Checking the connection…');
    if (!(await relayAvailable())) {
      btn.disabled = false;
      return say('Reading websites only works on <strong>factfile.dev</strong> itself. Here, start from the blank template or paste a file instead.', 'bad');
    }
    const lines = [];
    const progress = (m) => { lines.push(esc(m)); say('<span class="spin" aria-hidden="true"></span> ' + lines.slice(-4).join('<br>')); };
    try {
      progress(`Reading ${new URL(origin).host} (robots.txt respected)…`);
      const r = await F.generate(origin, { fetch: relayFetch, log: progress, version: '0.5.0 (web)' });
      state.origin = r.facts.url ? new URL(r.facts.url).origin : origin; state.name = r.facts.name; state.platform = r.platform || null;
      const notes = (r.notes || []).map((n) => `<li>${esc(n)}</li>`).join('');
      say(`Read ${r.pages.length} page${r.pages.length === 1 ? '' : 's'}. ${r.todos.length} line${r.todos.length === 1 ? ' needs' : 's need'} your input.${notes ? `<ul>${notes}</ul>` : ''}`, 'good');
      open(r.text);
    } catch (err) {
      say(`Could not read the site: ${esc(err.message)} You can still start from the blank template.`, 'bad');
    } finally { btn.disabled = false; }
  });

  $('#gen-blank').addEventListener('click', () => {
    const origin = normalise($('#gen-url').value) || 'https://example.com';
    state.origin = origin; state.name = new URL(origin).hostname; state.platform = null;
    open(F.blank(origin)); log.hidden = true;
  });
  $('#gen-paste').addEventListener('click', () => { state.origin = null; open(''); ta.placeholder = 'Paste your factfile.md here'; log.hidden = true; });

  const saved = store.get('factfile-draft');
  if (saved) {
    const r = $('#gen-resume'); r.hidden = false;
    r.querySelector('button').addEventListener('click', () => { try { const d = JSON.parse(saved); Object.assign(state, d.state || {}); open(d.text); } catch { store.del('factfile-draft'); } });
  }

  // ---------- editor ----------
  function open(text) {
    ta.value = text; work.hidden = false;
    refresh();
    work.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => ta.focus({ preventScroll: true }), 400);
  }
  function lineOffset(n) { const lines = ta.value.split('\n'); let o = 0; for (let i = 0; i < n - 1 && i < lines.length; i++) o += lines[i].length + 1; return o; }
  function jump(n) {
    const lines = ta.value.split('\n');
    const o = lineOffset(n), end = o + (lines[n - 1] || '').length;
    const todoAt = (lines[n - 1] || '').indexOf('TODO');
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(todoAt >= 0 ? o + todoAt : o, end);
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, (n - 4) * lh);
    syncGutter();
  }
  function syncGutter() { gutter.scrollTop = ta.scrollTop; }
  ta.addEventListener('scroll', syncGutter, { passive: true });
  let t;
  ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(refresh, 250); state.online = null; });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && e.target.dataset.tabIndent === 'on') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); nextTodo(); }
  });
  $('#gen-next').addEventListener('click', nextTodo);
  function nextTodo() {
    if (!state.todos.length) return;
    const cur = ta.value.slice(0, ta.selectionEnd).split('\n').length;
    const next = state.todos.find((x) => x.line > cur) || state.todos[0];
    jump(next.line);
  }

  function refresh() {
    const text = ta.value;
    const lines = text.split('\n');
    const { findings, level } = F.check(text);
    state.findings = findings;
    state.todos = findings.filter((f) => f.rule === 'draft.todo' && f.line).sort((a, b) => a.line - b.line);
    if (!state.origin) { try { const d = F.parseFactfile(text); if (d.header?.url) { state.origin = new URL(String(d.header.url)).origin; state.name = String(d.header.name || ''); } } catch {} }

    // gutter with markers
    const marks = new Map();
    for (const f of findings) if (f.line) marks.set(f.line, f.rule === 'draft.todo' ? 'todo' : marks.get(f.line) === 'todo' ? 'todo' : f.severity === 'error' ? 'err' : (marks.get(f.line) || 'warn'));
    gutter.innerHTML = lines.map((_, i) => `<span class="${marks.get(i + 1) || ''}">${i + 1}</span>`).join('');
    syncGutter();

    // needs your input
    todoCount.forEach((el) => (el.textContent = state.todos.length));
    $('#gen-next').disabled = !state.todos.length;
    todoList.innerHTML = state.todos.length
      ? state.todos.map((f) => `<li><button type="button" data-line="${f.line}"><span class="ln">Line ${f.line}</span>${esc(f.message.replace(/^Unfinished draft: /, ''))}</button></li>`).join('')
      : '<li class="done">Every line is filled in. Check the results, then download.</li>';

    // checks
    const lv = state.online?.level ?? level;
    levelSteps.forEach((li) => { const k = li.dataset.level; const order = ['basic', 'comparable', 'checked']; li.classList.toggle('done', !!lv && order.indexOf(k) <= order.indexOf(lv)); });
    $('#gen-level-name').textContent = lv ? F.levelNames?.[lv] || lv[0].toUpperCase() + lv.slice(1) : 'Not yet Basic';
    const list = (state.online?.findings || findings).filter((f) => f.rule !== 'draft.todo');
    const errs = list.filter((f) => f.severity === 'error'), warns = list.filter((f) => f.severity !== 'error');
    const row = (f) => `<li class="${f.severity}">${f.line ? `<button type="button" data-line="${f.line}">Line ${f.line}</button>` : ''}<span>${esc(f.message)}</span><em>${esc(f.level)}</em></li>`;
    checkOut.innerHTML = (errs.length || warns.length)
      ? `${errs.length ? `<h3>${errs.length} to fix</h3><ul class="gen-findings">${errs.map(row).join('')}</ul>` : ''}${warns.length ? `<h3>${warns.length} to consider</h3><ul class="gen-findings">${warns.map(row).join('')}</ul>` : ''}`
      : `<p class="gen-empty">${state.todos.length ? 'Fill in the lines that need your input, and problems will show here.' : 'No problems found offline.'}</p>`;
    $('#gen-online').disabled = !!state.todos.length || !state.origin;

    // preview
    let pageOk = false;
    try {
      const { fragment } = F.renderPage(text);
      previewOut.innerHTML = fragment; pageOk = true;
      $$('a', previewOut).forEach((a) => { a.target = '_blank'; a.rel = 'noopener nofollow'; });
    } catch (err) {
      previewOut.innerHTML = `<p class="gen-empty">${esc(err.message)}</p>`;
    }
    $$('[data-needs-page]').forEach((b) => { b.disabled = !pageOk; b.title = pageOk ? '' : 'Finish every TODO first, so the page shows checked facts.'; });

    // setup guide
    if (state.origin) setupOut.textContent = F.writeSetupGuide({ name: state.name || new URL(state.origin).host, origin: state.origin, platform: $('#gen-platform').value || state.platform || null });
    else setupOut.textContent = 'Add a url: line to the header to get a setup guide for your site.';

    $('#gen-md-warn').hidden = !state.todos.length;
    store.set('factfile-draft', JSON.stringify({ text, state: { origin: state.origin, name: state.name, platform: state.platform } }));
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-line]'); if (b && work.contains(b)) jump(+b.dataset.line); });
  $('#gen-platform').addEventListener('change', refresh);

  // tabs
  $$('.gen-tabs [role="tab"]').forEach((tab) => tab.addEventListener('click', () => {
    $$('.gen-tabs [role="tab"]').forEach((x) => { const on = x === tab; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; });
  }));
  $('.gen-tabs [role="tablist"]').addEventListener('keydown', (e) => {
    const tabs = $$('.gen-tabs [role="tab"]'); const i = tabs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.click(); n.focus();
  });

  // live check (Checked level)
  $('#gen-online').addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true; const label = btn.textContent; btn.textContent = 'Checking live pages…';
    try {
      if (!(await relayAvailable())) throw new Error('Live checks only work on factfile.dev itself.');
      state.online = await F.validate({ text: ta.value, online: true, fetch: relayFetch });
      refresh();
      $('#gen-online-note').textContent = `Checked live pages: ${state.online.levelName || 'not yet Basic'}, ${state.online.errors} to fix, ${state.online.warnings} to consider.`;
    } catch (err) { $('#gen-online-note').textContent = err.message; }
    finally { btn.textContent = label; btn.disabled = !!state.todos.length; }
  });

  // ---------- downloads ----------
  const files = () => {
    const text = ta.value; const out = { 'factfile.md': text };
    try { const p = F.renderPage(text); out['factfile.html'] = p.page; out['factfile-page.html'] = p.fragment; } catch {}
    if (state.origin) {
      out['factfile-setup.md'] = F.writeSetupGuide({ name: state.name || new URL(state.origin).host, origin: state.origin, platform: $('#gen-platform').value || state.platform || null });
      out['llms-txt-line.txt'] = F.llmsLine(state.origin) + '\n';
    }
    return out;
  };
  function save(name, content, type = 'text/plain') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type + ';charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const thank = () => setTimeout(() => window.coffeeToast && window.coffeeToast('Downloaded. If this saved you time, consider a coffee.'), 1200);
  $$('[data-download]').forEach((b) => b.addEventListener('click', () => {
    const name = b.dataset.download, f = files();
    if (!f[name]) return;
    save(name, f[name], name.endsWith('.html') ? 'text/html' : name.endsWith('.md') ? 'text/markdown' : 'text/plain'); thank();
  }));
  $('#gen-zip').addEventListener('click', () => {
    const f = files();
    f['README.txt'] = `Your factfile.md files, made at factfile.dev/generate on ${new Date().toISOString().slice(0, 10)}.\n\n` +
      'factfile.md          upload to your website root, so it is at /factfile.md (and a copy at /.well-known/factfile.md)\n' +
      (f['factfile.html'] ? 'factfile.html        a complete Key facts page: upload it so it opens at /factfile\nfactfile-page.html   the same page as a fragment, to paste into a site builder\n' : 'factfile.html        not included: finish every TODO first, so the page shows checked facts\n') +
      (f['factfile-setup.md'] ? 'factfile-setup.md    step-by-step guide to the five signposts for your platform\nllms-txt-line.txt    the line to add to your llms.txt\n' : '') +
      '\nCheck the live file any time with: npx factfile validate yourdomain.com\n';
    save('factfile.zip', zip(f), 'application/zip'); thank();
  });
  $('#gen-copy-llms').addEventListener('click', async (e) => {
    const btn = e.currentTarget; // currentTarget is null once the await below resumes
    if (!state.origin) { btn.textContent = 'Add a url: line first'; setTimeout(() => (btn.textContent = 'Copy llms.txt line'), 1800); return; }
    try { await navigator.clipboard.writeText(F.llmsLine(state.origin)); btn.textContent = 'Copied'; }
    catch { btn.textContent = 'Copy failed: see the Setup guide tab'; }
    setTimeout(() => (btn.textContent = 'Copy llms.txt line'), 1800);
  });
  $('#gen-reset').addEventListener('click', () => { if (confirm('Clear this draft and start again?')) { store.del('factfile-draft'); ta.value = ''; work.hidden = true; log.hidden = true; $('#gen-resume').hidden = true; start.scrollIntoView(); } });

  // ---------- tiny zip writer (stored, no compression) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(fileMap) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const [name, content] of Object.entries(fileMap)) {
      const n = enc.encode(name), data = enc.encode(content), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, n.length, 2], [28, 0, 2]].forEach(([o, v, s]) => (s === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true)));
      parts.push(new Uint8Array(h.buffer), n, data);
      const c = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, n.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]].forEach(([o, v, s]) => (s === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true)));
      central.push(new Uint8Array(c.buffer), n);
      offset += 30 + n.length + data.length;
    }
    const size = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    const count = Object.keys(fileMap).length;
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, count, 2], [10, count, 2], [12, size, 4], [16, offset, 4], [20, 0, 2]].forEach(([o, v, s]) => (s === 4 ? e.setUint32(o, v, true) : e.setUint16(o, v, true)));
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }
  window.__factfileZip = zip;

  // ---------- WebMCP: the same tools for AI agents working in this browser ----------
  // Registered only where the browser supports it (document.modelContext / navigator.modelContext).
  const mc = document.modelContext || navigator.modelContext;
  if (mc && typeof mc.registerTool === 'function') {
    const text = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
    const tools = [
      {
        name: 'factfile_validate',
        description: 'Check the text of a factfile.md against the specification. Returns the level reached (basic, comparable or checked; null if not yet Basic) and every problem with its line number. Offline checks only.',
        inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'The full factfile.md text' } }, required: ['text'] },
        execute: async ({ text: t }) => { const r = F.check(String(t || '')); return text({ level: r.level, problems: r.findings.map((f) => ({ line: f.line ?? null, severity: f.severity, level: f.level, rule: f.rule, message: f.message })) }); },
      },
      {
        name: 'factfile_draft_from_website',
        description: 'Draft a factfile.md from a public website, using only what its pages visibly say (robots.txt respected). Lines only the owner can answer are marked TODO. Returns the draft text and the list of TODO lines.',
        inputSchema: { type: 'object', properties: { website: { type: 'string', description: 'The website address, for example example.com' } }, required: ['website'] },
        execute: async ({ website }) => {
          const origin = normalise(String(website || ''));
          if (!origin) return text('Give a website address, for example example.com.');
          const r = await F.generate(origin, { fetch: relayFetch, version: '0.5.0 (web, WebMCP)' });
          return text({ text: r.text, todos: r.todos.map((x) => x.message || x), pagesRead: r.pages });
        },
      },
      {
        name: 'factfile_key_facts_page',
        description: 'Turn a finished factfile.md (no TODO lines) into the HTML of its Key facts page for /factfile.',
        inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'The full factfile.md text' } }, required: ['text'] },
        execute: async ({ text: t }) => { try { return text(F.renderPage(String(t || '')).page); } catch (err) { return text(err.message); } },
      },
    ];
    for (const tool of tools) { try { mc.registerTool(tool); } catch {} }
  }
})();
