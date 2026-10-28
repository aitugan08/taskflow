const $ = (id) => document.getElementById(id);
const STATUS = { new: 'Жаңа', progress: 'Орындалуда', done: 'Орындалды' };
let tasks = [];

async function api(path, method = 'GET', body) {
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let data = {}; try { data = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, data };
}
const msg = (id, text, ok) => { const el = $(id); el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); };
function showApp(on) { $('auth').classList.toggle('hidden', on); $('app').classList.toggle('hidden', !on); $('logout').classList.toggle('hidden', !on); }

$('btn-register').onclick = async () => {
  const r = await api('/api/register', 'POST', { email: $('email').value, password: $('password').value });
  r.ok ? msg('auth-msg', 'Тіркелді. Енді «Кіру» басыңыз.', true) : msg('auth-msg', r.data.error, false);
};
$('btn-login').onclick = async () => {
  const r = await api('/api/login', 'POST', { email: $('email').value, password: $('password').value });
  if (!r.ok) return msg('auth-msg', r.data.error, false);
  showApp(true); load();
};
$('logout').onclick = async () => { await api('/api/logout', 'POST'); showApp(false); };

async function load() {
  const st = $('f-status').value;
  const r = await api('/api/tasks' + (st ? '?status=' + st : ''));
  if (r.status === 401) return showApp(false);
  tasks = r.data; render();
}
function render() {
  const q = $('f-search').value.toLowerCase();
  const ul = $('list'); ul.innerHTML = '';
  tasks.filter((t) => String(t.title).toLowerCase().includes(q)).forEach((t) => {
    const li = document.createElement('li'); if (t.status === 'done') li.className = 'done';
    const info = document.createElement('div');
    info.innerHTML = '<div class="title"></div><div class="meta"></div>';
    info.querySelector('.title').textContent = t.title;
    info.querySelector('.meta').textContent = `${t.category} · ${t.due || 'мерзімсіз'} · ${STATUS[t.status] || t.status}` + (t.description ? ' · ' + t.description : '');
    const btns = document.createElement('div'); btns.className = 'row';
    const mk = (label, cls, fn) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; btns.appendChild(b); };
    if (t.status === 'new') mk('Орындалуда', 'secondary', () => setStatus(t, 'progress'));
    if (t.status !== 'done') mk('Орындалды', '', () => setStatus(t, 'done')); else mk('Қайта ашу', 'secondary', () => setStatus(t, 'new'));
    mk('Жою', 'danger', () => remove(t));
    li.append(info, btns); ul.appendChild(li);
  });
}
async function setStatus(t, status) { await api('/api/tasks/' + t.id, 'PUT', { status }); load(); }
async function remove(t) { if (!confirm('Тапсырманы жою керек пе?')) return; await api('/api/tasks/' + t.id, 'DELETE'); load(); }

$('btn-add').onclick = async () => {
  const r = await api('/api/tasks', 'POST', { title: $('t-title').value, description: $('t-desc').value, category: $('t-cat').value, due: $('t-due').value });
  if (!r.ok) return msg('app-msg', r.data.error, false);
  msg('app-msg', 'Тапсырма қосылды', true); $('t-title').value = ''; $('t-desc').value = ''; $('t-due').value = ''; load();
};
$('f-status').onchange = load;
$('f-search').oninput = render;
// Бет қайта жүктелгенде cookie бойынша сессияны тексеру
api('/api/tasks').then((r) => { if (r.ok) { showApp(true); tasks = r.data; render(); } });
