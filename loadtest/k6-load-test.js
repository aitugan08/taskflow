// 3-тапсырма: TaskFlow жүктемелік тестілеуі (k6). Іске қосу: k6 run loadtest/k6-load-test.js
// Жүктеме 4 кезеңмен біртіндеп артады: 10 -> 50 -> 100 -> 200 виртуалды пайдаланушы (VU).
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const QUICK = __ENV.QUICK === '1'; // тек сценарийді тез тексеру үшін (қысқа режим)

// [кезең, VU саны, Ramp-Up (сек)]
const STAGES = [['stage1', 10, 10], ['stage2', 50, 30], ['stage3', 100, 60], ['stage4', 200, 120]];
const HOLD = QUICK ? 2 : 30;   // максимал жүктемені ұстау уақыты (сек)
const GAP = QUICK ? 2 : 5;     // кезеңдер арасындағы үзіліс (сек)

const scenarios = {};
const thresholds = {};
let start = 0;
for (const [name, vus, ramp] of STAGES) {
  const r = QUICK ? Math.max(1, Math.round(ramp / 10)) : ramp;
  scenarios[name] = {
    executor: 'ramping-vus', startVUs: 0, startTime: start + 's', gracefulRampDown: '5s',
    stages: [{ duration: r + 's', target: QUICK ? Math.ceil(vus / 10) : vus }, { duration: HOLD + 's', target: QUICK ? Math.ceil(vus / 10) : vus }],
  };
  start += r + HOLD + GAP;
  // Бұл шектер әрқашан орындалады, бірақ әр кезеңнің метрикасын қорытындыда көрсетеді
  thresholds[`http_req_duration{scenario:${name}}`] = ['p(95)<1000000'];
  thresholds[`http_req_failed{scenario:${name}}`] = ['rate<=1'];
  thresholds[`http_reqs{scenario:${name}}`] = ['count>=0'];
}
export const options = { scenarios, thresholds };

// VU-ға тән айнымалылар (әр VU өз аккаунтымен жұмыс істейді)
let token = null;
const JSON_H = { 'Content-Type': 'application/json' };

export default function () {
  if (!token) {
    const email = `u${__VU}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@load.kz`;
    const body = JSON.stringify({ email, password: 'Pass12345678' });
    const reg = http.post(`${BASE}/api/register`, body, { headers: JSON_H, tags: { name: 'POST /api/register' } });
    check(reg, { 'register 201': (r) => r.status === 201 });
    const login = http.post(`${BASE}/api/login`, body, { headers: JSON_H, tags: { name: 'POST /api/login' } });
    check(login, { 'login 200': (r) => r.status === 200 });
    token = login.status === 200 ? login.json('token') : null;
    sleep(0.5);
    return;
  }
  const auth = { headers: { ...JSON_H, Authorization: `Bearer ${token}` } };
  const list = http.get(`${BASE}/api/tasks`, { ...auth, tags: { name: 'GET /api/tasks' } });
  check(list, { 'list 200': (r) => r.status === 200 });
  sleep(0.5);
  const add = http.post(`${BASE}/api/tasks`,
    JSON.stringify({ title: 'Load test task', description: 'k6', category: 'Study', due: '2026-12-01' }),
    { ...auth, tags: { name: 'POST /api/tasks' } });
  check(add, { 'create 201': (r) => r.status === 201 });
  sleep(0.5);
}