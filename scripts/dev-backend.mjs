// Local stand-in for the two Supabase services the app uses (REST + auth user),
// so the app can run against a plain Postgres during development and tests.
// It is NOT used in production, where the real Supabase project serves these.
//
// Supported: GET /rest/v1/<table> with select=<columns>, eq/neq/gt/gte/lt/lte/is/in/like/ilike
// filters, or=(...) is not supported, order, limit, offset, single-object Accept header,
// Prefer: count=exact; POST /rest/v1/rpc/<fn>; GET /auth/v1/user; POST /dev/token.
//
//   DATABASE_URL=postgres:///d5dev node scripts/dev-backend.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const PORT = Number(process.env.PORT || 54321);
const SECRET = process.env.DEV_JWT_SECRET || 'local-dev-secret-not-for-production';
// PostgREST returns plain dates as 'YYYY-MM-DD'; keep that shape.
pg.types.setTypeParser(1082, (v) => v);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres:///d5dev' });

const b64u = (b) => Buffer.from(b).toString('base64url');
function sign(payload) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verify(token) {
  const [h, b, s] = String(token || '').split('.');
  if (!s) return null;
  const want = crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url');
  if (want !== s) return null;
  const claims = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
}
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error(`bad identifier ${s}`), { code: 'PGRST100' });
  return `"${s}"`;
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function asCaller(req, fn) {
  const claims = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${claims?.sub ? 'authenticated' : 'anon'}`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [claims?.sub || '']);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };
function whereClause(params, values) {
  const parts = [];
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    const neg = raw.startsWith('not.');
    const v = neg ? raw.slice(4) : raw;
    const dot = v.indexOf('.');
    const op = v.slice(0, dot);
    const arg = v.slice(dot + 1);
    let sql;
    if (op === 'is') sql = `${ident(key)} is ${arg === 'null' ? 'null' : arg === 'true' ? 'true' : 'false'}`;
    else if (op === 'in') {
      const items = arg.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
      values.push(items);
      sql = `${ident(key)}::text = any($${values.length})`;
    } else if (OPS[op]) {
      values.push(op.includes('like') ? arg.replace(/\*/g, '%') : arg);
      sql = `${ident(key)}::text ${OPS[op]} $${values.length}`;
      if (['gt', 'gte', 'lt', 'lte'].includes(op)) sql = `${ident(key)} ${OPS[op]} $${values.length}`;
    } else throw Object.assign(new Error(`unsupported filter ${op}`), { code: 'PGRST100' });
    parts.push(neg ? `not (${sql})` : sql);
  }
  return parts.length ? ` where ${parts.join(' and ')}` : '';
}

async function getTable(req, res, table, url) {
  const params = [...url.searchParams.entries()];
  const values = [];
  const select = url.searchParams.get('select') || '*';
  const cols = select === '*' ? '*' : select.split(',').map((c) => ident(c.trim())).join(', ');
  let sql = `select ${cols} from public.${ident(table)}${whereClause(params, values)}`;
  const order = url.searchParams.get('order');
  if (order) {
    sql += ' order by ' + order.split(',').map((o) => {
      const [c, dir, nulls] = o.split('.');
      return `${ident(c)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullslast' ? ' nulls last' : nulls === 'nullsfirst' ? ' nulls first' : ''}`;
    }).join(', ');
  }
  const countSql = `select count(*)::int as n from public.${ident(table)}${whereClause(params, [])}`;
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');
  if (limit) sql += ` limit ${Number(limit)}`;
  if (offset) sql += ` offset ${Number(offset)}`;
  const wantCount = /count=exact/.test(req.headers.prefer || '');
  const { rows, total } = await asCaller(req, async (c) => ({
    rows: (await c.query(sql, values)).rows,
    total: wantCount ? (await c.query(countSql, values)).rows[0].n : null,
  }));
  const headers = wantCount ? { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${total}` } : {};
  if (req.method === 'HEAD') return send(res, 200, undefined, headers);
  if ((req.headers.accept || '').includes('vnd.pgrst.object')) {
    if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${rows.length} rows`, hint: null });
    return send(res, 200, rows[0], headers);
  }
  return send(res, 200, rows, headers);
}

async function rpc(req, res, fn, body) {
  const meta = (await pool.query(
    `select p.proretset as set, t.typtype as kind, t.typname as ret, p.proargnames as names,
            array(select format_type(x, null) from unnest(p.proargtypes) x) as types, p.proargmodes as modes
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
     where n.nspname = 'public' and p.proname = $1`, [fn])).rows[0];
  if (!meta) return send(res, 404, { code: 'PGRST202', message: `Could not find the function public.${fn}`, details: null, hint: null });
  const modes = typeof meta.modes === 'string' ? meta.modes.replace(/[{}]/g, '').split(',') : meta.modes;
  const names = (meta.names || []).filter((_, i) => !modes || modes[i] === 'i');
  const values = [];
  const args = Object.entries(body || {}).map(([k, v]) => {
    const i = names.indexOf(k);
    if (i < 0) throw Object.assign(new Error(`unknown argument ${k}`), { code: 'PGRST202' });
    const isJson = /^jsonb?$/.test(meta.types[i]);
    values.push(v !== null && (isJson || (typeof v === 'object' && !meta.types[i].endsWith('[]'))) ? JSON.stringify(v) : v);
    return `${ident(k)} => $${values.length}::${meta.types[i]}`;
  });
  const call = `public.${ident(fn)}(${args.join(', ')})`;
  const rows = await asCaller(req, async (c) => (await c.query(
    meta.kind === 'c' || meta.ret === 'record' ? `select * from ${call}` : `select ${call} as v`, values)).rows);
  if (meta.ret === 'void') return send(res, 200, null);
  if (meta.kind === 'c' || meta.ret === 'record') return send(res, 200, meta.set ? rows : rows[0] ?? null);
  return send(res, 200, meta.set ? rows.map((r) => r.v) : rows[0]?.v ?? null);
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === 'OPTIONS') return send(res, 204, undefined, { 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });
    if (url.pathname === '/auth/v1/user') {
      const claims = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
      if (!claims) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      const u = (await pool.query('select id, email, raw_user_meta_data from auth.users where id = $1', [claims.sub])).rows[0];
      if (!u) return send(res, 404, { code: 404, error_code: 'user_not_found', msg: 'User not found' });
      return send(res, 200, { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
        user_metadata: u.raw_user_meta_data, app_metadata: { provider: 'discord' }, created_at: new Date().toISOString() });
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204);
    if (url.pathname === '/dev/token' && req.method === 'POST') {
      // Creates (or reuses) a local test user and returns a session for it.
      const { handle } = await readBody(req);
      if (!/^[a-z0-9_]{2,32}$/.test(handle || '')) return send(res, 422, { error: 'bad handle' });
      const email = `${handle}@dev.local`;
      let u = (await pool.query('select id from auth.users where email = $1', [email])).rows[0];
      if (!u) u = (await pool.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
        [email, { full_name: handle.replace(/_/g, ' '), name: handle, provider_id: `dev-${handle}` }])).rows[0];
      const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
      const access_token = sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', exp, email });
      return send(res, 200, { access_token, refresh_token: `dev-${u.id}`, expires_in: 8 * 3600, expires_at: exp, token_type: 'bearer' });
    }
    const m = url.pathname.match(/^\/rest\/v1\/(rpc\/)?([a-z_][a-z0-9_]*)$/);
    if (m && m[1] && req.method === 'POST') return await rpc(req, res, m[2], await readBody(req));
    if (m && !m[1] && (req.method === 'GET' || req.method === 'HEAD')) return await getTable(req, res, m[2], url);
    return send(res, 404, { message: 'not found' });
  } catch (e) {
    const code = e.code || 'XX000';
    const status = code === '42501' ? 403 : code.startsWith('D54') ? Number(code.slice(2)) || 400 : code.startsWith('PGRST') ? 400 : 400;
    return send(res, status, { code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
  }
}).listen(PORT, () => console.log(`dev backend on http://localhost:${PORT}`));
