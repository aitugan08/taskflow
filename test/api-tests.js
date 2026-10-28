// 2-тапсырма: 23 тест-кейсті автоматты орындау. Алдымен серверді қосыңыз: npm start
const base = process.env.BASE || 'http://localhost:3000';
const call = async (path, method = 'GET', body, token) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) });
  let d = {}; try { d = await r.json(); } catch (e) {}
  return [r.status, d];
};
const results = [];
const tc = (id, got, exp, note = '') => { const ok = got === exp; results.push(ok); console.log(`${ok ? 'Passed' : 'FAILED'}  ${id.padEnd(12)} күтілген ${exp}, нақты ${got} ${note}`); };

(async () => {
  const s = Date.now(), pw = 'Pass12345';
  const mail = (p) => `${p}${s}@mail.kz`;
  tc('TC_AUTH_001', (await call('/api/register', 'POST', { email: mail('a'), password: pw }))[0], 201);
  tc('TC_AUTH_002', (await call('/api/register', 'POST', { email: 'user@', password: pw }))[0], 400);
  tc('TC_AUTH_003', (await call('/api/register', 'POST', { email: mail('b'), password: '1234567' }))[0], 400);
  tc('TC_AUTH_004', (await call('/api/register', 'POST', { email: mail('d'), password: '12345678' }))[0], 201);
  tc('TC_AUTH_005', (await call('/api/register', 'POST', { email: mail('f'), password: 'a'.repeat(20) }))[0], 201);
  tc('TC_AUTH_006', (await call('/api/register', 'POST', { email: mail('g'), password: 'a'.repeat(21) }))[0], 400);
  tc('TC_AUTH_007', (await call('/api/register', 'POST', { email: mail('a'), password: pw }))[0], 409);
  const [c8, l] = await call('/api/login', 'POST', { email: mail('a'), password: pw });
  tc('TC_AUTH_008', c8, 200);
  tc('TC_AUTH_009', (await call('/api/login', 'POST', { email: mail('a'), password: 'wrongpass1' }))[0], 401);
  tc('TC_SEC_001', (await call('/api/login', 'POST', { email: "' OR 1=1 --", password: 'x' }))[0], 401);
  tc('TC_SEC_002', (await call('/api/tasks'))[0], 401);
  const T = l.token;
  const [c1, t1] = await call('/api/tasks', 'POST', { title: 'A' }, T); tc('TC_TASK_001', c1, 201);
  tc('TC_TASK_002', (await call('/api/tasks', 'POST', { title: 'A'.repeat(100) }, T))[0], 201);
  tc('TC_TASK_003', (await call('/api/tasks', 'POST', { title: '' }, T))[0], 400);
  tc('TC_TASK_004', (await call('/api/tasks', 'POST', { title: 'A'.repeat(101) }, T))[0], 400);
  tc('TC_TASK_005', (await call('/api/tasks', 'POST', { title: 'Өткен мерзім', due: '2020-01-01' }, T))[1].warning ? 201 : 'ескертусіз 201', 201, '(BUG-002)');
  tc('TC_TASK_006', (await call('/api/tasks', 'POST', { title: 'Қате күн', due: '2026-13-45' }, T))[0], 400, '(BUG-003)');
  tc('TC_TASK_007', (await call('/api/tasks/' + t1.id, 'PUT', { status: 'done' }, T))[0], 200);
  tc('TC_TASK_008', (await call('/api/tasks/' + t1.id, 'PUT', { title: 12345 }, T))[0], 400, '(BUG-001)');
  const f = await call('/api/tasks?status=done', 'GET', null, T);
  tc('TC_FILT_001', f[0] === 200 && f[1].every((x) => x.status === 'done') ? 200 : 0, 200);
  const [, l2] = await call('/api/login', 'POST', { email: mail('d'), password: '12345678' });
  tc('TC_TASK_009', (await call('/api/tasks/' + t1.id, 'DELETE', null, l2.token))[0], 404);
  tc('TC_TASK_010', (await call('/api/tasks/' + t1.id, 'DELETE', null, T))[0], 200);
  tc('TC_TASK_011', (await call('/api/tasks/' + t1.id, 'DELETE', null, T))[0], 404);
  const p = results.filter(Boolean).length;
  console.log(`\nЖиыны: ${results.length} тест, Passed: ${p}, Failed: ${results.length - p}`);
})();
