// SMS verification. Defaults to a "dev" provider that never actually sends a
// text - codes are logged to the server console and "123456" always works -
// so the whole app is testable before a Twilio account exists. Switch
// SMS_PROVIDER=twilio and fill in the Twilio env vars to go live.

const DEV_BYPASS_CODE = "123456";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendVerificationCode(phone: string): Promise<string> {
  const provider = process.env.SMS_PROVIDER ?? "dev";
  const code = generateCode();

  if (provider === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!sid || !token || !verifyServiceSid) {
      throw new Error(
        "SMS_PROVIDER is set to twilio but TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SERVICE_SID are not configured."
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require("twilio")(sid, token);
    await twilio.verify.v2.services(verifyServiceSid).verifications.create({
      to: phone,
      channel: "sms",
    });
    // Twilio Verify manages the code itself; we don't need our own record for it,
    // but we still return a marker so calling code has a consistent shape.
    return "TWILIO_MANAGED";
  }

  // dev provider
  console.log(`[dev SMS] Verification code for ${phone}: ${code} (or use ${DEV_BYPASS_CODE})`);
  return code;
}

export function isDevBypassCode(code: string): boolean {
  return (process.env.SMS_PROVIDER ?? "dev") === "dev" && code === DEV_BYPASS_CODE;
}
