import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../services/jwt";
import { prisma } from "../db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header." });
  }

  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(401).json({ error: "Account no longer exists." });
    }
    if (user.status === "BANNED" || user.status === "SUSPENDED") {
      return res.status(403).json({ error: "This account has been suspended." });
    }
    if (user.status === "DELETED") {
      return res.status(403).json({ error: "This account has been deleted." });
    }
    req.userId = user.id;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}
