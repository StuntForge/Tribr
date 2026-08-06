import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { sendVerificationCode, isDevBypassCode } from "../services/sms";
import { signToken } from "../services/jwt";

const router = Router();

const CODE_TTL_MINUTES = 10;

const requestCodeSchema = z.object({
  phone: z.string().min(6, "Enter a valid mobile number."),
});

// 2.2 Registration - request a one-time SMS code for a phone number.
router.post("/request-code", async (req, res) => {
  const parsed = requestCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { phone } = parsed.data;

  const code = await sendVerificationCode(phone);

  await prisma.phoneVerification.create({
    data: {
      phone,
      code,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
  });

  res.json({ ok: true });
});

const verifyCodeSchema = z.object({
  phone: z.string().min(6),
  code: z.string().min(4),
  acceptedTerms: z.boolean().optional(),
});

// 2.2 Verification - confirm the code, activate/find the account, issue a session.
router.post("/verify-code", async (req, res) => {
  const parsed = verifyCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { phone, code, acceptedTerms } = parsed.data;

  const devBypass = isDevBypassCode(code);

  if (!devBypass) {
    const verification = await prisma.phoneVerification.findFirst({
      where: { phone, code, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!verification) {
      return res.status(400).json({ error: "That code is incorrect or has expired." });
    }
    await prisma.phoneVerification.update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    });
  }

  if (!acceptedTerms) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (!existing?.acceptedTermsAt) {
      return res.status(400).json({ error: "You must accept the Terms & Conditions and Privacy Policy to continue." });
    }
  }

  // 2.2 One verified mobile number may only have one active account.
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        acceptedTermsAt: acceptedTerms ? new Date() : null,
      },
    });
  } else if (!user.phoneVerifiedAt) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneVerifiedAt: new Date(),
        acceptedTermsAt: user.acceptedTermsAt ?? (acceptedTerms ? new Date() : null),
      },
    });
  }

  if (user.status === "BANNED" || user.status === "SUSPENDED") {
    return res.status(403).json({ error: "This account has been suspended." });
  }

  const token = signToken({ userId: user.id });
  res.json({
    token,
    user: {
      id: user.id,
      phone: user.phone,
      profileComplete: user.profileComplete,
    },
  });
});

export default router;
