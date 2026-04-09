"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUniqueReferralCode = generateUniqueReferralCode;
exports.maskName = maskName;
exports.findUserByReferralCode = findUserByReferralCode;
const crypto_1 = __importDefault(require("crypto"));
const firebase_1 = require("../config/firebase");
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(length) {
    let code = "";
    for (let index = 0; index < length; index += 1) {
        const randomIndex = crypto_1.default.randomInt(0, CODE_ALPHABET.length);
        code += CODE_ALPHABET[randomIndex];
    }
    return code;
}
async function generateUniqueReferralCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = randomCode(8);
        const existing = await firebase_1.db
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
function maskName(name) {
    const trimmed = name.trim();
    if (trimmed.length <= 2) {
        return `${trimmed.charAt(0)}*`;
    }
    return `${trimmed.slice(0, 2)}${"*".repeat(trimmed.length - 2)}`;
}
async function findUserByReferralCode(code) {
    const trimmed = code.trim().toUpperCase();
    const snap = await firebase_1.db
        .collection("users")
        .where("referral_code", "==", trimmed)
        .limit(1)
        .get();
    return snap.empty ? null : snap.docs[0];
}
//# sourceMappingURL=referral.js.map