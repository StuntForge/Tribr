import { NextFunction, Request, Response } from "express";
import { verifyAdminToken } from "../services/adminJwt";
import { prisma } from "../db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminId?: string;
    }
  }
}

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header." });
  }
  try {
    const payload = verifyAdminToken(header.slice("Bearer ".length));
    const admin = await prisma.adminUser.findUnique({ where: { id: payload.adminId } });
    if (!admin) return res.status(401).json({ error: "Admin account no longer exists." });
    req.adminId = admin.id;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

// 8.11 - administrative actions are logged with timestamps for an audit trail.
export async function logAdminAction(
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: string
) {
  await prisma.adminAuditLog.create({ data: { adminId, action, targetType, targetId, details } });
}
