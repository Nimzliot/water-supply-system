import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// SMTP when a host is configured, otherwise Brevo's HTTP API when a key is configured.
const provider = env.smtpHost ? "smtp" : env.brevoApiKey ? "brevo" : null;

const transport =
  provider === "smtp"
    ? nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined
      })
    : null;

if (!provider) {
  console.warn("[mail] Email is not configured (set SMTP_HOST or BREVO_API_KEY). Messages will be skipped.");
}

export function emailStatus() {
  return { configured: Boolean(provider && env.mailFrom), provider, from: env.mailFrom || null };
}

// "Name <address>" or a bare address -> { name, email }
function parseSender(value) {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || "Water Distribution", email: match[2] } : { name: "Water Distribution", email: value.trim() };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

// One layout for every message: a heading, a few lines, an optional table of facts, an optional button.
function render({ heading, lines = [], facts = [], action }) {
  const text = [heading, "", ...lines, "", ...facts.map(([label, value]) => `${label}: ${value}`), action ? `\n${action.label}: ${action.url}` : ""]
    .join("\n")
    .trim();

  const factRows = facts
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;color:#696969;font-size:14px;">${escapeHtml(label)}</td><td style="padding:8px 0;color:#1c1c1c;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#e23744;padding:18px 24px;color:#ffffff;font-size:16px;font-weight:700;">Water Distribution</td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 12px;font-size:20px;color:#1c1c1c;">${escapeHtml(heading)}</h1>
${lines.map((line) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#4f4f4f;">${escapeHtml(line)}</p>`).join("")}
${factRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid #ececec;">${factRows}</table>` : ""}
${action ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#e23744;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 20px;border-radius:10px;">${escapeHtml(action.label)}</a></p>` : ""}
</td></tr></table>
<p style="margin:14px 0 0;font-size:12px;color:#9c9c9c;">Sent automatically by the village water distribution system.</p>
</td></tr></table></body></html>`;

  return { text, html };
}

// Sends one message. Resolves to { sent, reason? } and only throws when the provider rejects it.
export async function sendEmail({ to, subject, ...content }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return { sent: false, reason: "No recipient address" };
  if (!emailStatus().configured) return { sent: false, reason: "Email is not configured on the server" };

  const { text, html } = render(content);

  if (provider === "smtp") {
    await transport.sendMail({ from: env.mailFrom, to: recipients.join(", "), subject, text, html });
    return { sent: true };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.brevoApiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: parseSender(env.mailFrom),
      to: recipients.map((email) => ({ email })),
      subject,
      htmlContent: html,
      textContent: text
    })
  });

  if (!response.ok) {
    throw new Error(`Brevo rejected the message (${response.status}): ${(await response.text()).slice(0, 200)}`);
  }
  return { sent: true };
}

// For messages triggered by another action: never delays or fails that action.
export function sendEmailInBackground(message) {
  sendEmail(message)
    .then((result) => {
      if (!result.sent && emailStatus().configured) console.warn(`[mail] "${message.subject}" not sent: ${result.reason}`);
    })
    .catch((error) => console.error(`[mail] "${message.subject}" failed:`, error.message));
}
