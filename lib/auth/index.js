"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const axios_1 = __importDefault(require("axios"));
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const firebase_1 = require("../config/firebase");
const params_1 = require("../config/params");
const auth_1 = require("../middleware/auth");
const referral_1 = require("../utils/referral");
const wallet_1 = require("../utils/wallet");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
const registerSchema = zod_1.z
    .object({
    first_name: zod_1.z.string().min(2),
    last_name: zod_1.z.string().min(2),
    father_name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6).optional(),
    confirmPassword: zod_1.z.string().min(6).optional(),
    phone: zod_1.z.string().min(10),
    school_name: zod_1.z.string().min(2),
    class_standard: zod_1.z.coerce.number().int().min(1).max(12),
    school_medium: zod_1.z.string().min(2).optional(),
    referral_code: zod_1.z.string().trim().length(8).optional(),
})
    .refine((data) => !data.password || data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const validateReferralSchema = zod_1.z.object({
    code: zod_1.z.string().trim().length(8),
});
// POST /register
app.post("/register", async (req, res) => {
    try {
        const validatedData = registerSchema.parse(req.body);
        const { email, password, first_name, last_name, father_name, phone, school_name, class_standard, school_medium, referral_code, } = validatedData;
        if (!password) {
            res.status(400).json({
                success: false,
                error: "Password is required",
            });
            return;
        }
        const myReferralCode = await (0, referral_1.generateUniqueReferralCode)();
        const userRecord = await firebase_1.auth.createUser({
            email,
            password,
            displayName: `${first_name} ${last_name}`,
        });
        let referredBy = null;
        let referrerDocId = null;
        if (referral_code) {
            const referrerDoc = await (0, referral_1.findUserByReferralCode)(referral_code);
            if (!referrerDoc) {
                res.status(400).json({
                    success: false,
                    error: "Invalid referral code",
                });
                return;
            }
            referredBy = referral_code.trim().toUpperCase();
            referrerDocId = referrerDoc.id;
        }
        await firebase_1.db.collection("users").doc(userRecord.uid).set({
            uid: userRecord.uid,
            first_name,
            last_name,
            father_name,
            email,
            phone,
            school_name,
            class_standard,
            school_medium: school_medium ?? null,
            referral_code: myReferralCode,
            referred_by: referredBy,
            profile_complete: true,
            fcm_token: null,
            role: "student",
            created_at: firestore_1.FieldValue.serverTimestamp(),
            updated_at: firestore_1.FieldValue.serverTimestamp(),
        });
        await (0, wallet_1.ensureWallet)(userRecord.uid);
        if (referredBy && referrerDocId) {
            const referralRef = firebase_1.db.collection("referrals").doc();
            await referralRef.set({
                id: referralRef.id,
                referrer_id: referrerDocId,
                referred_id: userRecord.uid,
                referred_name: (0, referral_1.maskName)(`${first_name} ${last_name}`),
                status: "registered",
                referral_code: referredBy,
                registration_bonus_credited: false,
                enrollment_bonus_credited: false,
                first_purchase_bonus_credited: false,
                reward_credited_at: null,
                created_at: firestore_1.FieldValue.serverTimestamp(),
                updated_at: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        await (0, wallet_1.creditPoints)({
            userId: userRecord.uid,
            activity: "REGISTRATION",
            points: 50,
            description: "Registration welcome bonus",
            refId: userRecord.uid,
        });
        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                uid: userRecord.uid,
                email: userRecord.email,
                referral_code: myReferralCode,
            },
        });
    }
    catch (error) {
        console.error("Registration Error:", error);
        // Handle Zod validation errors
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                success: false,
                error: "Validation Error",
                details: error.errors.map((err) => ({
                    field: err.path[0],
                    message: err.message,
                })),
            });
            return;
        }
        // Handle Firebase Auth errors (e.g., email already exists)
        if (error.code === "auth/email-already-exists") {
            res.status(409).json({
                success: false,
                error: "Email already exists",
            });
            return;
        }
        return res.status(500).json({
            success: false,
            error: "Registration failed",
            message: error.message,
        });
    }
});
// POST /login
app.post("/login", async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const apiKey = params_1.fbApiKeySecret.value();
        const loginResponse = await axios_1.default.post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, { email, password, returnSecureToken: true });
        const { idToken, refreshToken, localId, expiresIn } = loginResponse.data;
        const userDoc = await firebase_1.db.collection("users").doc(localId).get();
        const walletDoc = await firebase_1.db.collection("wallets").doc(localId).get();
        return res.status(200).json({
            success: true,
            data: {
                token: idToken,
                refreshToken,
                expiresIn,
                uid: localId,
                profile: userDoc.exists ? userDoc.data() : null,
                wallet: walletDoc.exists ? walletDoc.data() : null,
            },
        });
    }
    catch (error) {
        console.error("Login Error:", error);
        // Handle Zod Error
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, error: "Validation Error" });
            return;
        }
        // Handle Axios/Auth Error (Invalid Email/Password)
        if (axios_1.default.isAxiosError(error) && error.response) {
            const firebaseError = error.response.data.error;
            res.status(error.response.status).json({
                success: false,
                error: firebaseError.message,
            });
            return;
        }
        return res.status(500).json({
            success: false,
            error: "Login failed",
            message: error.message,
        });
    }
});
app.post("/refresh", async (req, res) => {
    try {
        const schema = zod_1.z.object({ refreshToken: zod_1.z.string().min(10) });
        const { refreshToken } = schema.parse(req.body);
        const apiKey = params_1.fbApiKeySecret.value();
        const response = await axios_1.default.post(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, `grant_type=refresh_token&refresh_token=${refreshToken}`, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });
        res.status(200).json({
            success: true,
            data: {
                token: response.data.id_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in,
                uid: response.data.user_id,
            },
        });
    }
    catch (error) {
        console.error("Refresh Error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to refresh token",
            message: error.message,
        });
    }
});
app.post("/logout", auth_1.authMiddleware, async (req, res) => {
    try {
        const { uid } = req.user;
        await firebase_1.auth.revokeRefreshTokens(uid);
        await firebase_1.db.collection("users").doc(uid).set({
            fcm_token: null,
            updated_at: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        res.status(200).json({ success: true, message: "Logged out successfully" });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: "Logout failed",
            message: error.message,
        });
    }
});
app.post("/validate-referral", async (req, res) => {
    try {
        const { code } = validateReferralSchema.parse(req.body);
        const referrer = await (0, referral_1.findUserByReferralCode)(code);
        res.status(200).json({
            success: true,
            data: {
                valid: Boolean(referrer),
            },
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: "Validation failed",
            message: error.message,
        });
    }
});
app.put("/fcm-token", auth_1.authMiddleware, async (req, res) => {
    try {
        const schema = zod_1.z.object({ fcm_token: zod_1.z.string().min(10) });
        const { fcm_token } = schema.parse(req.body);
        const { uid } = req.user;
        await firebase_1.db.collection("users").doc(uid).set({
            fcm_token,
            updated_at: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        res.status(200).json({ success: true, data: { fcm_token } });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: "Failed to update FCM token",
            message: error.message,
        });
    }
});
exports.authApp = app;
//# sourceMappingURL=index.js.map