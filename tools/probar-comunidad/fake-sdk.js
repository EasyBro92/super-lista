// Imitación de @supabase/supabase-js con lo que usa la app, hablando con server.mjs.
export function createClient(url, key, opts = {}) {
  const base = url.replace(/\/+$/, "");
  const SK = opts.auth?.storageKey ?? "sb-fake", persist = opts.auth?.persistSession !== false;
  let session = null;
  try { session = persist ? JSON.parse(localStorage.getItem(SK) || "null") : null; } catch {}
  const subs = [];
  const emit = (ev) => subs.forEach((f) => f(ev, session));
  const save = () => { if (!persist) return; if (session) localStorage.setItem(SK, JSON.stringify(session)); else localStorage.removeItem(SK); };
  const H = () => (session ? { "x-uid": session.user.id } : {});
  const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json", ...H() }, body: JSON.stringify(b) }).then((r) => r.json());
  const enter = async (what, b) => {
    const r = await post(`/fake/auth/${what}`, b);
    if (r.error) return { data: { user: null, session: null }, error: r.error };
    session = { user: r.user, access_token: r.user.id }; save(); emit("SIGNED_IN");
    return { data: { user: r.user, session }, error: null };
  };
  const auth = {
    async getSession() { return { data: { session }, error: null }; },
    async getUser() { return { data: { user: session?.user ?? null }, error: null }; },
    onAuthStateChange(f) { subs.push(f); setTimeout(() => f("INITIAL_SESSION", session)); return { data: { subscription: { unsubscribe() {} } } }; },
    signUp: (b) => enter("signup", b),
    signInWithPassword: (b) => enter("login", b),
    // Imita volver de Google: crea la cuenta (con el nombre que da Google) y recarga con #access_token.
    async signInWithOAuth({ provider, options }) {
      window.__oauth = provider;
      const email = `${provider}.${Date.now()}@gmail.com`;
      const r = await post("/fake/auth/signup", { email, password: "oauth-123456" });
      session = { user: { ...r.user, user_metadata: { full_name: "Marta López" } }, access_token: r.user.id }; save();
      history.replaceState(null, "", `${options.redirectTo}#access_token=falso&token_type=bearer`); location.reload();
      return { data: {}, error: null };
    },
    async signOut() { session = null; save(); emit("SIGNED_OUT"); return { error: null }; },
    async resetPasswordForEmail(email) { window.__resetFor = email; return { data: {}, error: null }; },
    async updateUser({ password }) { await post("/fake/auth/password", { password }); emit("USER_UPDATED"); return { data: { user: session.user }, error: null }; },
  };
  async function rpc(fn, args) {
    try { const r = await post(`/fake/rpc/${fn}`, args ?? {}); return r.error ? { data: null, error: r.error } : { data: r.data, error: null }; }
    catch { return { data: null, error: { message: "TypeError: Failed to fetch" } }; }
  }
  const storage = { from(b) { return {
    async upload(p, blob, o = {}) {
      const r = await fetch(`${base}/fake/storage/${b}/${p}`, { method: "PUT", headers: { ...H(), "content-type": o.contentType ?? blob.type }, body: blob });
      return r.ok ? { data: { path: p }, error: null } : { data: null, error: { message: await r.text() } };
    },
    async remove(paths) { await post(`/fake/storage-remove/${b}`, { paths }); return { data: [], error: null }; },
    async list(prefix) { return { data: await post(`/fake/storage-list/${b}`, { prefix }), error: null }; },
    getPublicUrl(p) { return { data: { publicUrl: `${base}/storage/v1/object/public/${b}/${p}` } }; },
  }; } };
  function channel(name) {
    const bc = new BroadcastChannel(name), hs = [];
    bc.onmessage = (m) => hs.forEach((h) => h(m.data));
    const ch = { on(t, f, cb) { hs.push(cb); return ch; }, subscribe() { return ch; }, send(m) { bc.postMessage(m); return Promise.resolve("ok"); }, _bc: bc };
    return ch;
  }
  return { auth, rpc, storage, channel, removeChannel(ch) { ch?._bc?.close(); } };
}
