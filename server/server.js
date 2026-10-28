// TaskFlow demo server: Node.js (http), деректер жад ішінде сақталады.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const LOG_DIR = path.join(__dirname, '..', 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const users = [];            // {id, email, salt, hash}
const tasks = [];            // {id, owner, title, description, category, due, status}
const tokens = new Map();    // token -> userId
let taskSeq = 0;

function log(file, msg) {
  fs.appendFile(path.join(LOG_DIR, file), `${new Date().toISOString()} ${msg}\n`, () => {});
}
const hash = (pw, salt) => crypto.pbkdf2Sync(pw, salt, 10000, 32, 'sha256').toString('hex');
const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', (c) => (s += c));
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
});
const authUser = (req) => {
  const h = req.headers['authorization'] || '';
  if (h) return tokens.get(h.replace(/^Bearer\s+/i, ''));
  const m = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || '');
  return m ? tokens.get(m[1]) : undefined;
};

// Статикалық файлдар (веб-клиент): Cache-Control + ETag
const PUB = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };
function serveStatic(req, res, p) {
  const f = path.join(PUB, p === '/' ? 'index.html' : p);
  if (!f.startsWith(PUB) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return false;
  const data = fs.readFileSync(f);
  const etag = '"' + crypto.createHash('sha1').update(data).digest('hex') + '"';
  const headers = { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600', ETag: etag };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return true; }
  res.writeHead(200, headers); res.end(data);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  const m = req.method;
  try {
    if (m === 'GET' && !p.startsWith('/api/') && serveStatic(req, res, p)) return;
    if (m === 'GET' && p === '/api/health') return send(res, 200, { status: 'ok' });

    if (m === 'POST' && p === '/api/register') {
      const b = await readBody(req);
      if (typeof b.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email))
        return send(res, 400, { error: 'Email форматы қате' });
      if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 20)
        return send(res, 400, { error: 'Пароль ұзындығы 8-20 таңба болуы керек' });
      if (users.find((u) => u.email === b.email)) return send(res, 409, { error: 'Email бұрын тіркелген' });
      const salt = crypto.randomBytes(8).toString('hex');
      const u = { id: users.length + 1, email: b.email, salt, hash: hash(b.password, salt) };
      users.push(u);
      return send(res, 201, { id: u.id, email: u.email });
    }

    if (m === 'POST' && p === '/api/login') {
      const b = await readBody(req);
      const u = users.find((x) => x.email === b.email);
      if (!u || typeof b.password !== 'string' || hash(b.password, u.salt) !== u.hash)
        return send(res, 401, { error: 'Email немесе пароль қате' });
      const token = crypto.randomBytes(16).toString('hex');
      tokens.set(token, u.id);
      res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);
      return send(res, 200, { token });
    }

    if (m === 'POST' && p === '/api/logout') {
      res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
      return send(res, 200, { ok: true });
    }

    // ---- төменгі эндпоинттерге токен қажет ----
    if (p === '/api/tasks' || p.startsWith('/api/tasks/')) {
      const uid = authUser(req);
      if (!uid) return send(res, 401, { error: 'Авторизация қажет' });

      if (m === 'GET' && p === '/api/tasks') {
        const st = url.searchParams.get('status');
        return send(res, 200, tasks.filter((t) => t.owner === uid && (!st || t.status === st)));
      }
      if (m === 'POST' && p === '/api/tasks') {
        const b = await readBody(req);
        if (typeof b.title !== 'string' || b.title.length < 1 || b.title.length > 100)
          return send(res, 400, { error: 'Атауы 1-100 таңба болуы керек' });
        // ЕСКЕРТУ: due өрісі әдейі тексерілмейді (BUG-002, BUG-003 — оқу мақсатында)
        const t = { id: ++taskSeq, owner: uid, title: b.title, description: b.description || '',
                    category: b.category || 'General', due: b.due || null, status: 'new' };
        tasks.push(t);
        return send(res, 201, t);
      }
      const id = Number(p.split('/')[3]);
      const t = tasks.find((x) => x.id === id && x.owner === uid);
      if (!t) return send(res, 404, { error: 'Тапсырма табылмады' });
      if (m === 'PUT') {
        const b = await readBody(req);
        // BUG-001: title жол емес болса b.title.trim() қате береді -> 500
        if (b.title !== undefined) t.title = b.title.trim();
        if (b.status !== undefined) t.status = b.status;
        if (b.description !== undefined) t.description = b.description;
        if (b.category !== undefined) t.category = b.category;
        if (b.due !== undefined) t.due = b.due;
        return send(res, 200, t);
      }
      if (m === 'DELETE') {
        tasks.splice(tasks.indexOf(t), 1);
        return send(res, 200, { deleted: true });
      }
    }
    return send(res, 404, { error: 'Not Found' });
  } catch (e) {
    log('error.log', `ERROR ${m} ${p} | ${e.stack.split('\n').slice(0, 2).join(' | ')}`);
    return send(res, 500, { error: 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`TaskFlow server: http://localhost:${PORT}`);
  log('app.log', `Server started on port ${PORT}`);
});
