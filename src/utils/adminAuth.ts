import crypto from "crypto";
import { adminAuthSecret } from "../config/params";

export type AdminTokenPayload = {
  admin_id: string;
  email: string;
  role: "admin";
  exp: number;
};

function toBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

export function hashPasswordToHex(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function signTokenPayload(encodedPayload: string) {
  return crypto
    .createHmac("sha256", adminAuthSecret.value())
    .update(encodedPayload)
    .digest("hex");
}

export function createAdminAccessToken(input: {
  admin_id: string;
  email: string;
  expiresInSeconds?: number;
}) {
  const payload: AdminTokenPayload = {
    admin_id: input.admin_id,
    email: input.email,
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? 60 * 60 * 24),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminAccessToken(token: string) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    throw new Error("Malformed admin token");
  }

  const expectedSignature = signTokenPayload(encodedPayload);
  if (signature !== expectedSignature) {
    throw new Error("Invalid admin token signature");
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload)) as AdminTokenPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Admin token expired");
  }

  return payload;
}
