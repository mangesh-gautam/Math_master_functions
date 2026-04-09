"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const firebase_1 = require("../config/firebase");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
app.get("/history", auth_1.authMiddleware, async (req, res) => {
    const { uid } = req.user;
    const snap = await firebase_1.db
        .collection("notifications")
        .where("user_id", "==", uid)
        .orderBy("created_at", "desc")
        .limit(50)
        .get();
    res.status(200).json({
        success: true,
        data: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
});
app.post("/mark-read", auth_1.authMiddleware, async (req, res) => {
    try {
        const schema = zod_1.z.object({ notification_id: zod_1.z.string().min(1) });
        const payload = schema.parse(req.body);
        await firebase_1.db.collection("notifications").doc(payload.notification_id).set({
            read: true,
        }, { merge: true });
        res.status(200).json({ success: true });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: "Failed to mark notification as read",
            message: error.message,
        });
    }
});
exports.notifApp = app;
//# sourceMappingURL=index.js.map