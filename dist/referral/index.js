"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const zod_1 = require("zod");
const firebase_1 = require("../config/firebase");
const auth_1 = require("../middleware/auth");
const referral_1 = require("../utils/referral");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// GET /code
app.get("/code", auth_1.authMiddleware, async (req, res) => {
    const { uid } = req.user;
    const userSnap = await firebase_1.db.collection("users").doc(uid).get();
    const code = userSnap.data()?.referral_code ?? null;
    res.status(200).json({
        success: true,
        data: {
            code,
            referralLink: code ?
                `https://mathlearnpro.app/signup?ref=${code}` :
                null,
        },
    });
});
app.get("/list", auth_1.authMiddleware, async (req, res) => {
    const { uid } = req.user;
    const snap = await firebase_1.db
        .collection("referrals")
        .where("referrer_id", "==", uid)
        .orderBy("created_at", "desc")
        .get();
    res.status(200).json({
        success: true,
        data: snap.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                referred_at: typeof data.created_at?.toDate === "function" ?
                    data.created_at.toDate().toISOString() :
                    null,
            };
        }),
    });
});
app.get("/stats", auth_1.authMiddleware, async (req, res) => {
    const { uid } = req.user;
    const referrals = await firebase_1.db
        .collection("referrals")
        .where("referrer_id", "==", uid)
        .get();
    const ledger = await firebase_1.db
        .collection("points_ledger")
        .where("user_id", "==", uid)
        .where("activity", "in", ["REFERRAL_BONUS", "FIRST_PURCHASE_BONUS"])
        .get();
    const totalReferrals = referrals.size;
    const successful = referrals.docs.filter((doc) => ["enrolled", "rewarded"].includes(doc.data().status)).length;
    const pending = referrals.docs.filter((doc) => doc.data().status === "registered").length;
    const totalPointsEarned = ledger.docs.reduce((sum, doc) => sum + Number(doc.data().points ?? 0), 0);
    res.status(200).json({
        success: true,
        data: {
            total_referrals: totalReferrals,
            successful,
            pending,
            total_points_earned: totalPointsEarned,
        },
    });
});
app.post("/validate", async (req, res) => {
    try {
        const schema = zod_1.z.object({ code: zod_1.z.string().trim().length(8) });
        const payload = schema.parse(req.body);
        const userDoc = await (0, referral_1.findUserByReferralCode)(payload.code);
        res.status(200).json({
            success: true,
            data: {
                valid: Boolean(userDoc),
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
exports.referralApp = app;
//# sourceMappingURL=index.js.map