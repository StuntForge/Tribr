import { apiFetch } from "./client";

export function requestCode(phone: string) {
  return apiFetch<{ ok: true }>("/api/auth/request-code", { method: "POST", body: { phone } });
}

export interface VerifyCodeResponse {
  token: string;
  user: { id: string; phone: string; profileComplete: boolean };
}

export function verifyCode(phone: string, code: string, acceptedTerms: boolean) {
  return apiFetch<VerifyCodeResponse>("/api/auth/verify-code", {
    method: "POST",
    body: { phone, code, acceptedTerms },
  });
}
