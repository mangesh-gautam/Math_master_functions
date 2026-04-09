"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const firebase_1 = require("../config/firebase");
const wallet_1 = require("../utils/wallet");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// GET /balance - Fetch current wallet balance
app.get("/balance", auth_1.authMiddleware, async (req, res) => {
    const { uid } = req.user;
    try {
        const wallet = await (0, wallet_1.ensureWallet)(uid);
        return res.status(200).json({
            success: true,
            data: {
                balance: wallet.balance,
                total_earned: wallet.total_earned,
                total_redeemed: wallet.total_redeemed,
                rupee_value: (0, wallet_1.pointsToRupees)(wallet.balance),
            },
        });
    }
    catch (error) {
        console.error("Wallet Balance Error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch balance",
            message: error.message,
        });
    }
});
// GET /transactions - Fetch transaction history
app.get("/transactions", auth_1.authMiddleware, async (req, res) => {
    const { uid } = req.user;
    try {
        const page = Math.max(Number(req.query.page ?? 1), 1);
        const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 50);
        const offset = (page - 1) * limit;
        const result = await firebase_1.db
            .collection("points_ledger")
            .where("user_id", "==", uid)
            .orderBy("created_at", "desc")
            .offset(offset)
            .limit(limit)
            .get();
        return res.status(200).json({
            success: true,
            data: {
                items: result.docs.map(wallet_1.mapLedgerDoc),
                page,
                limit,
                has_more: result.size === limit,
            },
        });
    }
    catch (error) {
        console.error("Wallet Transactions Error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch transactions",
            message: error.message,
        });
    }
});
app.post("/earn", auth_1.authMiddleware, async (req, res) => {
    try {
        const schema = zod_1.z.object({
            activity: zod_1.z.string().min(1),
            refId: zod_1.z.string().optional(),
            points: zod_1.z.number().int().positive().optional(),
            description: zod_1.z.string().optional(),
        });
        const { uid } = req.user;
        const payload = schema.parse(req.body);
        const points = (0, wallet_1.getActivityPoints)(payload.activity, payload.points);
        if (!points) {
            res.status(400).json({
                success: false,
                error: "Unknown activity",
            });
            return;
        }
        const result = await (0, wallet_1.creditPoints)({
            userId: uid,
            activity: payload.activity,
            points,
            refId: payload.refId ?? null,
            description: payload.description ?? payload.activity,
        });
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: "Failed to earn points",
            message: error.message,
        });
    }
});
app.post("/redeem", auth_1.authMiddleware, async (req, res) => {
    try {
        const schema = zod_1.z.object({
            courseId: zod_1.z.string().min(1),
            points: zod_1.z.number().int().min(wallet_1.MIN_REDEMPTION_POINTS),
        });
        const payload = schema.parse(req.body);
        const { uid } = req.user;
        const courseSnap = await firebase_1.db.collection("courses").doc(payload.courseId).get();
        if (!courseSnap.exists) {
            res.status(404).json({ success: false, error: "Course not found" });
            return;
        }
        const course = courseSnap.data() ?? {};
        const coursePrice = Number(course.discount_price ?? course.original_price ?? 0);
        const cap = (0, wallet_1.maxRedeemablePoints)(coursePrice);
        if (payload.points > cap) {
            res.status(400).json({
                success: false,
                error: "Points exceed redemption cap",
                data: { max_points_allowed: cap },
            });
            return;
        }
        const discountRupees = (0, wallet_1.pointsToRupees)(payload.points);
        const remainingPayable = Number(Math.max(coursePrice - discountRupees, 0).toFixed(2));
        const result = await (0, wallet_1.debitPoints)({
            userId: uid,
            points: payload.points,
            refId: payload.courseId,
            description: `Redeemed for course ${payload.courseId}`,
        });
        res.status(200).json({
            success: true,
            data: {
                discount_rupees: discountRupees,
                remaining_payable: remainingPayable,
                new_balance: result.balance,
                transaction_id: result.transactionId,
            },
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: "Failed to redeem points",
            message: error.message,
        });
    }
});
app.get("/expiry-preview", auth_1.authMiddleware, async (req, res) => {
    try {
        const { uid } = req.user;
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + 30);
        const result = await firebase_1.db
            .collection("points_ledger")
            .where("user_id", "==", uid)
            .where("txn_type", "==", "credit")
            .where("expires_at", "<=", threshold)
            .orderBy("expires_at", "asc")
            .get();
        res.status(200).json({
            success: true,
            data: result.docs.map(wallet_1.mapLedgerDoc),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to load expiry preview",
            message: error.message,
        });
    }
});
exports.walletApp = app;
//# sourceMappingURL=index.js.map