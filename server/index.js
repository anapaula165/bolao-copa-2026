import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import { pool, initDb } from "./db.js";
import { hashPassword, checkPassword, signToken, auth, requireAdmin } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
const emailOk = (e) => /^\S+@\S+\.\S+$/.test(e || "");

/* ---------------- AUTENTICAÇÃO ---------------- */
app.post("/api/auth/register", async (req, res) => {
  try {
    let { name, email, password } = req.body || {};
    name = (name || "").trim();
    email = (email || "").toLowerCase().trim();
    if (name.length < 2 || !emailOk(email) || (password || "").length < 6)
      return res.status(400).json({ error: "Informe nome, e-mail válido e senha de 6+ caracteres." });

    const exists = await pool.query("SELECT 1 FROM users WHERE email=$1", [email]);
    if (exists.rowCount) return res.status(409).json({ error: "Já existe uma conta com esse e-mail." });

    const hash = await hashPassword(password);
    const isAdmin = !!ADMIN_EMAIL && email === ADMIN_EMAIL;
    const r = await pool.query(
      "INSERT INTO users (name,email,password_hash,is_admin) VALUES ($1,$2,$3,$4) RETURNING id,name,email,is_admin",
      [name, email, hash, isAdmin]
    );
    const u = r.rows[0];
    await pool.query("INSERT INTO predictions (user_id, data) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING", [u.id]);
    res.json({ token: signToken(u), user: { id: u.id, name: u.name, email: u.email, isAdmin: u.is_admin } });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao criar conta." }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    email = (email || "").toLowerCase().trim();
    const r = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!r.rowCount) return res.status(401).json({ error: "E-mail ou senha incorretos." });
    const u = r.rows[0];
    if (!(await checkPassword(password || "", u.password_hash)))
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    res.json({ token: signToken(u), user: { id: u.id, name: u.name, email: u.email, isAdmin: u.is_admin } });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao entrar." }); }
});

app.get("/api/me", auth, async (req, res) => {
  const r = await pool.query("SELECT id,name,email,is_admin FROM users WHERE id=$1", [req.user.id]);
  if (!r.rowCount) return res.status(404).json({ error: "Usuário não encontrado." });
  const u = r.rows[0];
  res.json({ id: u.id, name: u.name, email: u.email, isAdmin: u.is_admin });
});

/* ---------------- ESTADO (config + resultados) ---------------- */
async function getState() {
  const r = await pool.query("SELECT config, results FROM app_state WHERE id=1");
  return r.rows[0] || { config: {}, results: {} };
}
app.get("/api/state", async (_req, res) => res.json(await getState()));

/* ---------------- PALPITES ---------------- */
app.get("/api/predictions/me", auth, async (req, res) => {
  const r = await pool.query("SELECT data, locked, locked_at FROM predictions WHERE user_id=$1", [req.user.id]);
  if (!r.rowCount) return res.json({ data: {}, locked: false });
  res.json(r.rows[0]);
});

app.put("/api/predictions/me", auth, async (req, res) => {
  try {
    const { config } = await getState();
    const past = config.deadline && Date.now() > new Date(config.deadline).getTime();
    const cur = await pool.query("SELECT locked FROM predictions WHERE user_id=$1", [req.user.id]);
    const selfLocked = cur.rowCount && cur.rows[0].locked;
    if (config.globalLock || past || selfLocked)
      return res.status(403).json({ error: "Palpites bloqueados (prazo encerrado ou trava ativa)." });
    const data = req.body?.data ?? {};
    await pool.query(
      `INSERT INTO predictions (user_id, data, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET data=$2::jsonb, updated_at=now()`,
      [req.user.id, JSON.stringify(data)]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao salvar." }); }
});

app.post("/api/predictions/lock", auth, async (req, res) => {
  await pool.query(
    `INSERT INTO predictions (user_id, locked, locked_at) VALUES ($1, TRUE, now())
     ON CONFLICT (user_id) DO UPDATE SET locked=TRUE, locked_at=now()`,
    [req.user.id]
  );
  res.json({ ok: true });
});

// Ranking — público: todos veem todos (palpites já são públicos por regra do bolão)
app.get("/api/predictions", async (_req, res) => {
  const r = await pool.query(`
    SELECT u.id, u.name, u.is_admin, p.data, p.locked
    FROM users u LEFT JOIN predictions p ON p.user_id = u.id
    ORDER BY u.created_at ASC
  `);
  res.json(r.rows.map((x) => ({ id: x.id, name: x.name, isAdmin: x.is_admin, data: x.data || {}, locked: !!x.locked })));
});

/* ---------------- ADMIN ---------------- */
app.put("/api/admin/config", auth, requireAdmin, async (req, res) => {
  await pool.query("UPDATE app_state SET config=$1::jsonb WHERE id=1", [JSON.stringify(req.body?.config || {})]);
  res.json({ ok: true });
});
app.put("/api/admin/results", auth, requireAdmin, async (req, res) => {
  await pool.query("UPDATE app_state SET results=$1::jsonb WHERE id=1", [JSON.stringify(req.body?.results || {})]);
  res.json({ ok: true });
});

/* ---------------- FRONTEND (produção) ---------------- */
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Rota não encontrada." });
  res.sendFile(path.join(clientDist, "index.html"));
});

const PORT = process.env.PORT || 3001;
initDb()
  .then(() => app.listen(PORT, () => console.log(`✅ Bolão rodando na porta ${PORT}`)))
  .catch((e) => { console.error("Falha ao iniciar o banco:", e); process.exit(1); });
