"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const firebase_1 = require("../config/firebase");
const auth_1 = require("../middleware/auth");
const wallet_1 = require("../utils/wallet");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
const profileUpdateSchema = zod_1.z.object({
    first_name: zod_1.z.string().min(2).optional(),
    last_name: zod_1.z.string().min(2).optional(),
    father_name: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().min(10).optional(),
    school_name: zod_1.z.string().min(2).optional(),
    class_standard: zod_1.z.coerce.number().int().min(1).max(12).optional(),
    profile_image_url: zod_1.z.string().url().optional(),
});
function isProfileComplete(data) {
    return Boolean(data.first_name &&
        data.last_name &&
        data.father_name &&
        data.email &&
        data.phone &&
        data.school_name &&
        data.class_standard);
}
app.get("/me", auth_1.authMiddleware, async (req, res) => {
    const { uid } = req.user;
    const snap = await firebase_1.db.collection("users").doc(uid).get();
    if (!snap.exists) {
        res.status(404).json({ success: false, error: "Profile not found" });
        return;
    }
    const walletSnap = await firebase_1.db.collection("wallets").doc(uid).get();
    res.status(200).json({
        success: true,
        data: {
            id: snap.id,
            ...snap.data(),
            wallet: walletSnap.exists ? walletSnap.data() : null,
        },
    });
});
app.put("/me", auth_1.authMiddleware, async (req, res) => {
    try {
        const { uid } = req.user;
        const payload = profileUpdateSchema.parse(req.body);
        const userRef = firebase_1.db.collection("users").doc(uid);
        const before = await userRef.get();
        if (!before.exists) {
            res.status(404).json({ success: false, error: "Profile not found" });
            return;
        }
        const nextData = {
            ...before.data(),
            ...payload,
            updated_at: firestore_1.FieldValue.serverTimestamp(),
        };
        await userRef.set(nextData, { merge: true });
        if (!before.data()?.profile_complete && isProfileComplete(nextData)) {
            await userRef.set({ profile_complete: true }, { merge: true });
            await (0, wallet_1.creditPoints)({
                userId: uid,
                activity: "PROFILE_COMPLETE",
                points: 25,
                description: "Profile completion bonus",
            });
        }
        res.status(200).json({ success: true, data: nextData });
    }
    catch (error) {
        handleError(res, error, "Failed to update profile");
    }
});
app.put("/image", auth_1.authMiddleware, async (req, res) => {
    try {
        const { uid } = req.user;
        const schema = zod_1.z.object({ profile_image_url: zod_1.z.string().url() });
        const payload = schema.parse(req.body);
        await firebase_1.db.collection("users").doc(uid).set({
            profile_image_url: payload.profile_image_url,
            updated_at: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        res.status(200).json({ success: true, data: payload });
    }
    catch (error) {
        handleError(res, error, "Failed to update image");
    }
});
function handleError(res, error, fallbackMessage) {
    if (error instanceof zod_1.z.ZodError) {
        res.status(400).json({
            success: false,
            error: "Validation error",
            details: error.errors,
        });
        return;
    }
    const message = error instanceof Error ? error.message : fallbackMessage;
    res.status(500).json({ success: false, error: fallbackMessage, message });
}
exports.profileApp = app;
//# sourceMappingURL=index.js.map