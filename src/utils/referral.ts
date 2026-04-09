import crypto from "crypto";
import { db } from "../config/firebase";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length: number): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = crypto.randomInt(0, CODE_ALPHABET.length);
    code += CODE_ALPHABET[randomIndex];
  }
  return code;
}

export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomCode(8);
    const existing = await db
      .collection("users")
      .where("referral_code", "==", code)
      .limit(1)
      .get();

    if (existing.empty) {
      return code;
    }
  }

  throw new Error("Failed to generate a unique referral code");
}

export function maskName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 2) {
    return `${trimmed.charAt(0)}*`;
  }
  return `${trimmed.slice(0, 2)}${"*".repeat(trimmed.length - 2)}`;
}

export async function findUserByReferralCode(code: string) {
  const trimmed = code.trim().toUpperCase();
  const snap = await db
    .collection("users")
    .where("referral_code", "==", trimmed)
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0];
}
