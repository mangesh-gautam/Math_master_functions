"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const admin_1 = require("../middleware/admin");
const firebase_1 = require("../config/firebase");
const wallet_1 = require("../utils/wallet");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
app.post("/courses", admin_1.adminMiddleware, async (req, res) => {
    try {
        const schema = zod_1.z.object({
            title: zod_1.z.string().min(2),
            description: zod_1.z.string().min(2),
            class_standard: zod_1.z.number().int().min(1).max(12),
            tutor_name: zod_1.z.string().min(2),
            thumbnail_url: zod_1.z.string().url().optional(),
            original_price: zod_1.z.number().nonnegative(),
            discount_price: zod_1.z.number().nonnegative(),
            is_free: zod_1.z.boolean().default(false),
            chapters: zod_1.z.array(zod_1.z.any()).default([]),
            is_active: zod_1.z.boolean().default(true),
        });
        const payload = schema.parse(req.body);
        const ref = firebase_1.db.collection("courses").doc();
        await ref.set({
            id: ref.id,
            ...payload,
            rating: 0,
            total_ratings: 0,
            created_at: firestore_1.FieldValue.serverTimestamp(),
            updated_at: firestore_1.FieldValue.serverTimestamp(),
        });
        res.status(201).json({ success: true, data: { id: ref.id, ...payload } });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: "Failed to create course",
            message: error.message,
        });
    }
});
app.put("/courses/:id", admin_1.adminMiddleware, async (req, res) => {
    await firebase_1.db.collection("courses").doc(req.params.id).set({
        ...req.body,
        updated_at: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.status(200).json({ success: true });
});
app.post("/tests", admin_1.adminMiddleware, async (req, res) => {
    const ref = firebase_1.db.collection("tests").doc();
    await ref.set({
        id: ref.id,
        ...req.body,
        created_at: firestore_1.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ success: true, data: { id: ref.id } });
});
app.post("/points/campaign", admin_1.adminMiddleware, async (req, res) => {
    try {
        const schema = zod_1.z.object({
            points: zod_1.z.number().int().positive(),
            activity: zod_1.z.string().min(1).default("PROMOTIONAL"),
            user_ids: zod_1.z.array(zod_1.z.string()).optional(),
        });
        const payload = schema.parse(req.body);
        const users = payload.user_ids?.length ?
            payload.user_ids :
            (await firebase_1.db.collection("users").get()).docs.map((doc) => doc.id);
        await Promise.all(users.map((userId) => (0, wallet_1.creditPoints)({
            userId,
            activity: payload.activity,
            points: payload.points,
            refId: `${payload.activity}-${Date.now()}`,
            description: "Promotional points campaign",
            allowDuplicate: true,
        })));
        res.status(200).json({
            success: true,
            data: { users_processed: users.length },
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: "Failed to run campaign",
            message: error.message,
        });
    }
});
app.get("/analytics/referrals", admin_1.adminMiddleware, async (_req, res) => {
    const referrals = await firebase_1.db.collection("referrals").get();
    const byStatus = referrals.docs.reduce((acc, doc) => {
        const status = String(doc.data().status ?? "unknown");
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
    }, {});
    res.status(200).json({ success: true, data: byStatus });
});
app.get("/analytics/wallet", admin_1.adminMiddleware, async (_req, res) => {
    const wallets = await firebase_1.db.collection("wallets").get();
    const data = wallets.docs.reduce((acc, doc) => {
        const wallet = doc.data();
        acc.total_balance += Number(wallet.balance ?? 0);
        acc.total_earned += Number(wallet.total_earned ?? 0);
        acc.total_redeemed += Number(wallet.total_redeemed ?? 0);
        return acc;
    }, { total_balance: 0, total_earned: 0, total_redeemed: 0 });
    res.status(200).json({ success: true, data });
});
app.put("/referral-config", admin_1.adminMiddleware, async (req, res) => {
    await firebase_1.db.collection("config").doc("referral").set({
        ...req.body,
        updated_at: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.status(200).json({ success: true });
});
exports.adminApp = app;
//# sourceMappingURL=index.js.map