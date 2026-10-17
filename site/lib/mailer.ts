import nodemailer from "nodemailer";

import { logger } from "@/lib/logger";

function getTransporter() {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = process.env.EMAIL_SERVER_PORT;
  const user = process.env.EMAIL_SERVER_USER;
  const password = process.env.EMAIL_SERVER_PASSWORD;

  if (!host || !port) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: password ? { user, pass: password } : undefined,
  });
}

type SendMailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendMail({ to, subject, html }: SendMailParams) {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM ?? process.env.EMAIL_SERVER_USER;

  if (!transporter || !from) {
    await logger.warn("E-mail não enviado: EMAIL_SERVER_* não configurado no .env", { to, subject });
    return false;
  }

  try {
    await transporter.sendMail({ from, to, subject, html });
    return true;
  } catch (error) {
    await logger.error("Falha ao enviar e-mail", {
      to,
      subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
