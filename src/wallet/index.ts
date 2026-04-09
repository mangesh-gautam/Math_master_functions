import express from "express";
import cors from "cors";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";
import { db } from "../config/firebase";
import {
  creditPoints,
  debitPoints,
  ensureWallet,
  getActivityPoints,
  mapLedgerDoc,
  maxRedeemablePoints,
  MIN_REDEMPTION_POINTS,
  pointsToRupees,
} from "../utils/wallet";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// GET /balance - Fetch current wallet balance
app.get("/balance", authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;

  try {
    const wallet = await ensureWallet(uid);

    return res.status(200).json({
      success: true,
      data: {
        balance: wallet.balance,
        total_earned: wallet.total_earned,
        total_redeemed: wallet.total_redeemed,
        rupee_value: pointsToRupees(wallet.balance),
      },
    });
  } catch (error: any) {
    console.error("Wallet Balance Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch balance",
      message: error.message,
    });
  }
});

// GET /transactions - Fetch transaction history
app.get("/transactions", authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;

  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 50);
    const offset = (page - 1) * limit;
    const result = await db
      .collection("points_ledger")
      .where("user_id", "==", uid)
      .orderBy("created_at", "desc")
      .offset(offset)
      .limit(limit)
      .get();

    return res.status(200).json({
      success: true,
      data: {
        items: result.docs.map(mapLedgerDoc),
        page,
        limit,
        has_more: result.size === limit,
      },
    });
  } catch (error: any) {
    console.error("Wallet Transactions Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch transactions",
      message: error.message,
    });
  }
});

app.post("/earn", authMiddleware, async (req, res) => {
  try {
    const schema = z.object({
      activity: z.string().min(1),
      refId: z.string().optional(),
      points: z.number().int().positive().optional(),
      description: z.string().optional(),
    });
    const { uid } = (req as any).user;
    const payload = schema.parse(req.body);
    const points = getActivityPoints(payload.activity, payload.points);

    if (!points) {
      res.status(400).json({
        success: false,
        error: "Unknown activity",
      });
      return;
    }

    const result = await creditPoints({
      userId: uid,
      activity: payload.activity,
      points,
      refId: payload.refId ?? null,
      description: payload.description ?? payload.activity,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: "Failed to earn points",
      message: error.message,
    });
  }
});

app.post("/redeem", authMiddleware, async (req, res) => {
  try {
    const schema = z.object({
      courseId: z.string().min(1),
      points: z.number().int().min(MIN_REDEMPTION_POINTS),
    });
    const payload = schema.parse(req.body);
    const { uid } = (req as any).user;
    const courseSnap = await db.collection("courses").doc(payload.courseId).get();

    if (!courseSnap.exists) {
      res.status(404).json({ success: false, error: "Course not found" });
      return;
    }

    const course = courseSnap.data() ?? {};
    const coursePrice = Number(
      course.discount_price ?? course.original_price ?? 0,
    );
    const cap = maxRedeemablePoints(coursePrice);

    if (payload.points > cap) {
      res.status(400).json({
        success: false,
        error: "Points exceed redemption cap",
        data: { max_points_allowed: cap },
      });
      return;
    }

    const discountRupees = pointsToRupees(payload.points);
    const remainingPayable = Number(
      Math.max(coursePrice - discountRupees, 0).toFixed(2),
    );
    const result = await debitPoints({
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
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: "Failed to redeem points",
      message: error.message,
    });
  }
});

app.get("/expiry-preview", authMiddleware, async (req, res) => {
  try {
    const { uid } = (req as any).user;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + 30);
    const result = await db
      .collection("points_ledger")
      .where("user_id", "==", uid)
      .where("txn_type", "==", "credit")
      .where("expires_at", "<=", threshold)
      .orderBy("expires_at", "asc")
      .get();

    res.status(200).json({
      success: true,
      data: result.docs.map(mapLedgerDoc),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to load expiry preview",
      message: error.message,
    });
  }
});

export const walletApp = app;
