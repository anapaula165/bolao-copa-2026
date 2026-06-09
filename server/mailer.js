import nodemailer from "nodemailer";

// Configuração via variáveis de ambiente. Se não houver SMTP configurado,
// o link de redefinição é apenas registrado no log do servidor (o admin pode
// pegar lá ou usar o botão "gerar link" no painel).
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
const smtpReady = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (smtpReady) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export const emailConfigured = smtpReady;

export async function sendResetEmail(to, link) {
  if (!transporter) {
    console.log(`[RESET] SMTP não configurado. Link de redefinição para ${to}: ${link}`);
    return false;
  }
  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to,
    subject: "Redefinição de senha — Bolão da Copa 2026",
    text: `Você pediu para redefinir sua senha do Bolão da Copa 2026.\n\nAbra o link abaixo para criar uma nova senha (válido por 1 hora):\n${link}\n\nSe não foi você, ignore este e-mail.`,
    html: `<p>Você pediu para redefinir sua senha do <b>Bolão da Copa 2026</b>.</p>
           <p>Clique no link abaixo para criar uma nova senha (válido por 1 hora):</p>
           <p><a href="${link}">${link}</a></p>
           <p style="color:#888">Se não foi você, ignore este e-mail.</p>`,
  });
  return true;
}
