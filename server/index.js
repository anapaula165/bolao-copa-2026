import express from "express";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import { pool, initDb } from "./db.js";
import { hashPassword, checkPassword, signToken, auth, requireAdmin } from "./auth.js";
import { sendResetEmail, emailConfigured } from "./mailer.js";
import { KICKOFFS, MATCH_LOCK_MIN } from "./schedule.js";
import { mergeAllowed } from "./merge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
const emailOk = (e) => /^\S+@\S+\.\S+$/.test(e || "");
const baseUrl = (req) => process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

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

// atualizar o nome (nickname que aparece no ranking)
app.put("/api/me", auth, async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (name.length < 2) return res.status(400).json({ error: "O nome precisa ter ao menos 2 caracteres." });
  const r = await pool.query("UPDATE users SET name=$1 WHERE id=$2 RETURNING id,name,email,is_admin", [name, req.user.id]);
  const u = r.rows[0];
  res.json({ id: u.id, name: u.name, email: u.email, isAdmin: u.is_admin });
});

/* ---------------- RECUPERAÇÃO DE SENHA ---------------- */
async function createResetToken(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
  await pool.query("UPDATE users SET reset_token=$1, reset_expires=$2 WHERE id=$3", [token, expires, userId]);
  return token;
}

// self-service: pessoa informa o e-mail e recebe o link (se SMTP configurado)
app.post("/api/auth/forgot", async (req, res) => {
  try {
    const email = (req.body?.email || "").toLowerCase().trim();
    const r = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (r.rowCount) {
      const token = await createResetToken(r.rows[0].id);
      const link = `${baseUrl(req)}/?reset=${token}`;
      await sendResetEmail(email, link);
    }
    // resposta genérica (não revela se o e-mail existe)
    res.json({ ok: true, emailConfigured });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao processar." }); }
});

// conclui a redefinição com o token do link
app.post("/api/auth/reset", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if ((password || "").length < 6) return res.status(400).json({ error: "A nova senha precisa ter 6+ caracteres." });
    const r = await pool.query("SELECT id FROM users WHERE reset_token=$1 AND reset_expires > now()", [token || ""]);
    if (!r.rowCount) return res.status(400).json({ error: "Link inválido ou expirado. Peça um novo." });
    const hash = await hashPassword(password);
    await pool.query("UPDATE users SET password_hash=$1, reset_token=NULL, reset_expires=NULL WHERE id=$2", [hash, r.rows[0].id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao redefinir." }); }
});

// admin gera link de redefinição para alguém (funciona sem e-mail configurado)
app.post("/api/admin/reset-link", auth, requireAdmin, async (req, res) => {
  const email = (req.body?.email || "").toLowerCase().trim();
  const r = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
  if (!r.rowCount) return res.status(404).json({ error: "Participante não encontrado." });
  const token = await createResetToken(r.rows[0].id);
  res.json({ resetUrl: `${baseUrl(req)}/?reset=${token}` });
});

/* ---------------- ESTADO (config + resultados) ---------------- */
async function getState() {
  const r = await pool.query("SELECT config, results FROM app_state WHERE id=1");
  return r.rows[0] || { config: {}, results: {} };
}
app.get("/api/state", async (_req, res) => res.json(await getState()));

/* ---------------- PALPITES ---------------- */
app.get("/api/predictions/me", auth, async (req, res) => {
  const r = await pool.query("SELECT data FROM predictions WHERE user_id=$1", [req.user.id]);
  if (!r.rowCount) return res.json({ data: {} });
  res.json({ data: r.rows[0].data || {} });
});

app.put("/api/predictions/me", auth, async (req, res) => {
  try {
    const { config } = await getState();
    const cur = await pool.query("SELECT data FROM predictions WHERE user_id=$1", [req.user.id]);
    const base = (cur.rowCount && cur.rows[0].data) || {};
    const merged = mergeAllowed(base, req.body?.data || {}, config, Date.now(), KICKOFFS, MATCH_LOCK_MIN);
    await pool.query(
      `INSERT INTO predictions (user_id, data, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET data=$2::jsonb, updated_at=now()`,
      [req.user.id, JSON.stringify(merged)]
    );
    res.json({ ok: true, data: merged });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao salvar." }); }
});

// Ranking — público
app.get("/api/predictions", async (_req, res) => {
  const r = await pool.query(`
    SELECT u.id, u.name, u.is_admin, u.email, p.data
    FROM users u LEFT JOIN predictions p ON p.user_id = u.id
    ORDER BY u.created_at ASC
  `);
  res.json(r.rows.map((x) => ({ id: x.id, name: x.name, isAdmin: x.is_admin, email: x.email, data: x.data || {} })));
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
  .then(() => app.listen(PORT, () => console.log(`✅ Bolão rodando na porta ${PORT}${emailConfigured ? " (e-mail ativo)" : " (e-mail não configurado — links de reset vão para o log)"}`)))
  .catch((e) => { console.error("Falha ao iniciar o banco:", e); process.exit(1); });
