import "./config.js";
import { createClerkClient, verifyToken } from "@clerk/backend";
import type { Request } from "express";
import { webOrigin, ownerEmail } from "./config.js";
import { db } from "./service.js";
export async function isOwner(req: Request) {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .find((x) => x.trim().startsWith("__session="))
    ?.trim()
    .slice(10);
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") || cookie;
  if (!token || (!process.env.CLERK_SECRET_KEY && !process.env.CLERK_JWT_KEY))
    return false;
  try {
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      jwtKey: process.env.CLERK_JWT_KEY,
      authorizedParties: [webOrigin],
    });
    if (!claims.sub) return false;
    const owner = await db.owner.findUnique({ where: { id: "owner" } });
    if (!owner) return false;
    if (owner.clerkUserId) return owner.clerkUserId === claims.sub;
    if (process.env.CLERK_OWNER_USER_ID) {
      if (claims.sub !== process.env.CLERK_OWNER_USER_ID) return false;
    } else {
      if (!ownerEmail || !process.env.CLERK_SECRET_KEY) return false;
      const client = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      const user = await client.users.getUser(claims.sub);
      if (
        !user.emailAddresses.some(
          (email) =>
            email.emailAddress.toLowerCase() === ownerEmail &&
            email.verification?.status === "verified",
        )
      )
        return false;
    }
    await db.owner.updateMany({
      where: { id: "owner", clerkUserId: null },
      data: { clerkUserId: claims.sub },
    });
    return (
      (await db.owner.findUnique({ where: { id: "owner" } }))?.clerkUserId ===
      claims.sub
    );
  } catch {
    return false;
  }
}
