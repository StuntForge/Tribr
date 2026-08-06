import jwt from "jsonwebtoken";

// A distinct secret (not the regular user JWT_SECRET) so an admin token and
// a member token can never be confused for one another even structurally.
const SECRET = (process.env.JWT_SECRET ?? "dev-only-secret-change-before-production") + "::admin";

export interface AdminTokenPayload {
  adminId: string;
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "12h" });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, SECRET) as AdminTokenPayload;
}
