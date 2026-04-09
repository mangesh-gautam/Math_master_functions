"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPasswordToHex = hashPasswordToHex;
exports.createAdminAccessToken = createAdminAccessToken;
exports.verifyAdminAccessToken = verifyAdminAccessToken;
const crypto_1 = __importDefault(require("crypto"));
const params_1 = require("../config/params");
function toBase64Url(value) {
    return Buffer.from(value)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}
function fromBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}
function hashPasswordToHex(password) {
    return crypto_1.default.createHash("sha256").update(password).digest("hex");
}
function signTokenPayload(encodedPayload) {
    return crypto_1.default
        .createHmac("sha256", params_1.adminAuthSecret.value())
        .update(encodedPayload)
        .digest("hex");
}
function createAdminAccessToken(input) {
    const payload = {
        admin_id: input.admin_id,
        email: input.email,
        role: "admin",
        exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? 60 * 60 * 24 * 7),
    };
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = signTokenPayload(encodedPayload);
    return `${encodedPayload}.${signature}`;
}
function verifyAdminAccessToken(token) {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) {
        throw new Error("Malformed admin token");
    }
    const expectedSignature = signTokenPayload(encodedPayload);
    if (signature !== expectedSignature) {
        throw new Error("Invalid admin token signature");
    }
    const payload = JSON.parse(fromBase64Url(encodedPayload));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error("Admin token expired");
    }
    return payload;
}
//# sourceMappingURL=adminAuth.js.map