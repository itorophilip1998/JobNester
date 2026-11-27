import nodemailer from "nodemailer";
import { db } from "../common/prisma.js";
export async function deliverInquiry(id: string) {
  const inquiry = await db.inquiry.findUniqueOrThrow({ where: { id } });
  if (inquiry.deliveryStatus === "delivered") return "Email already delivered.";
  const owner = await db.owner.findUniqueOrThrow({ where: { id: "owner" } });
  const to =
    owner.contactRecipient ||
    process.env.CONTACT_NOTIFY_EMAIL ||
    process.env.OWNER_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!to || !from)
    throw new Error(
      "Configure a personal recipient and verified sender for contact email.",
    );
  const subject = `Portfolio inquiry from ${inquiry.name.replace(/[\r\n]/g, " ")}`;
  const text = `Name: ${inquiry.name}\nEmail: ${inquiry.email}\n\n${inquiry.message}`;
  try {
    if (process.env.RESEND_API_KEY) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `inquiry-${id}`,
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: inquiry.email,
          subject,
          text,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(`Email provider returned HTTP ${response.status}`);
    } else if (process.env.SMTP_HOST) {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        ...(process.env.SMTP_USER
          ? {
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              },
            }
          : {}),
        connectionTimeout: 15000,
      });
      await transport.sendMail({
        from,
        to,
        replyTo: inquiry.email,
        subject,
        text,
        messageId: `<inquiry-${id}@jobnester.local>`,
      });
    } else
      throw new Error(
        "Configure SMTP or Resend before accepting portfolio inquiries.",
      );
    await db.inquiry.update({
      where: { id },
      data: { deliveryStatus: "delivered", deliveredAt: new Date() },
    });
    return "Inquiry delivered to your personal email.";
  } catch (error) {
    await db.inquiry.update({
      where: { id },
      data: { deliveryStatus: "failed" },
    });
    throw error;
  }
}
