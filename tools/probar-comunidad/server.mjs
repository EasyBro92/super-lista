// Supabase falso para probar: sirve la app y responde como Supabase usando un Postgres local de verdad con el SQL del repo.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
const ROOT = process.argv[2], PORT = +process.argv[3] || 8790, DB = process.argv[4] || "t2";
const pool = new pg.Pool({ host: "/tmp", port: 5433, user: "postgres", database: DB });
const pw = new Map(); // email -> { id, password }
const files = new Map(); // "fotos/uid/x.jpg" -> { type, buf }
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const body = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });
const json = (res, code, o) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(o)); };
export async function asUser(uid, sql, params = []) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    const r = await c.query(sql, params);
    await c.query("commit");
    return r;
  } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
}
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"), uid = req.headers["x-uid"] || null;
  try {
    if (u.pathname.startsWith("/fake/auth/")) {
      const b = JSON.parse((await body(req)).toString() || "{}"), what = u.pathname.slice(11);
      if (what === "signup") {
        if (pw.has(b.email)) return json(res, 200, { error: { code: "user_already_exists", message: "User already registered" } });
        if ((b.password ?? "").length < 6) return json(res, 200, { error: { code: "weak_password", message: "weak" } });
        const { rows } = await pool.query("insert into auth.users (email) values ($1) returning id", [b.email]);
        pw.set(b.email, { id: rows[0].id, password: b.password });
        return json(res, 200, { user: { id: rows[0].id, email: b.email } });
      }
      if (what === "login") {
        const x = pw.get(b.email);
        if (!x || x.password !== b.password) return json(res, 200, { error: { code: "invalid_credentials", message: "Invalid login credentials" } });
        const { rows } = await pool.query("select id from auth.users where id = $1", [x.id]);
        if (!rows.length) return json(res, 200, { error: { code: "invalid_credentials", message: "Invalid login credentials" } });
        return json(res, 200, { user: { id: x.id, email: b.email } });
      }
      if (what === "password") { for (const [, x] of pw) if (x.id === uid) x.password = b.password; return json(res, 200, {}); }
      return json(res, 200, {});
    }
    if (u.pathname.startsWith("/fake/rpc/")) {
      const fn = u.pathname.slice(10);
      if (!/^[a-z_]+$/.test(fn)) return json(res, 400, {});
      const a = JSON.parse((await body(req)).toString() || "{}"), ks = Object.keys(a);
      const vals = ks.map((k) => (a[k] && typeof a[k] === "object" && !Array.isArray(a[k]) ? JSON.stringify(a[k]) : a[k]));
      try {
        const r = await asUser(uid, `select public.${fn}(${ks.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`, vals);
        return json(res, 200, { data: r.rows[0].r });
      } catch (e) { return json(res, 200, { error: { code: e.code, message: e.message } }); }
    }
    if (u.pathname.startsWith("/fake/storage/") && req.method === "PUT") {
      const p = decodeURIComponent(u.pathname.slice(14)); // fotos/uid/x.jpg
      const [bucket, folder] = p.split("/");
      if (bucket !== "fotos" || !uid || folder !== uid) { res.writeHead(403); return res.end("new row violates row-level security policy"); }
      const buf = await body(req);
      if (buf.length > 2097152) { res.writeHead(413); return res.end("too big"); }
      files.set(p, { type: req.headers["content-type"], buf }); return json(res, 200, { path: p });
    }
    if (u.pathname.startsWith("/fake/storage-list/")) {
      const { prefix } = JSON.parse((await body(req)).toString());
      return json(res, 200, [...files.keys()].filter((k) => k.startsWith(`fotos/${prefix}/`)).map((k) => ({ name: k.split("/").pop() })));
    }
    if (u.pathname.startsWith("/fake/storage-remove/")) {
      const { paths } = JSON.parse((await body(req)).toString());
      for (const p of paths) if (p.startsWith(`${uid}/`)) files.delete(`fotos/${p}`);
      return json(res, 200, []);
    }
    if (u.pathname.startsWith("/storage/v1/object/public/")) {
      const f = files.get(decodeURIComponent(u.pathname.slice(26)));
      if (!f) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": f.type }); return res.end(f.buf);
    }
    if (u.pathname === "/auth/v1/settings") return json(res, 200, { external: { email: true, google: true, apple: false } });
    if (u.pathname === "/fake/files") return json(res, 200, [...files.keys()]);
    let fp = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html");
    if (!fs.existsSync(fp)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": MIME[path.extname(fp)] ?? "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(fp).pipe(res);
  } catch (e) { console.error(e); json(res, 500, { error: { message: String(e) } }); }
}).listen(PORT, () => console.log("listo", PORT));
