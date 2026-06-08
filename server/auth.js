import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "troque-este-segredo-em-producao";

export const hashPassword = (p) => bcrypt.hash(p, 10);
export const checkPassword = (p, h) => bcrypt.compare(p, h);

export const signToken = (u) =>
  jwt.sign({ id: u.id, email: u.email, isAdmin: !!u.is_admin }, SECRET, { expiresIn: "60d" });

export function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado." });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { return res.status(401).json({ error: "Sessão expirada. Entre novamente." }); }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: "Acesso restrito ao administrador." });
  next();
}
