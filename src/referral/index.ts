import express from "express";
import cors from "cors";
import { z } from "zod";
import { db } from "../config/firebase";
import { authMiddleware } from "../middleware/auth";
import { findUserByReferralCode } from "../utils/referral";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// GET /code
app.get("/code", authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;
  const userSnap = await db.collection("users").doc(uid).get();
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

app.get("/list", authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;
  const snap = await db
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
        referred_at:
          typeof data.created_at?.toDate === "function" ?
            data.created_at.toDate().toISOString() :
            null,
      };
    }),
  });
});

app.get("/stats", authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;
  const referrals = await db
    .collection("referrals")
    .where("referrer_id", "==", uid)
    .get();
  const ledger = await db
    .collection("points_ledger")
    .where("user_id", "==", uid)
    .where("activity", "in", ["REFERRAL_BONUS", "FIRST_PURCHASE_BONUS"])
    .get();

  const totalReferrals = referrals.size;
  const successful = referrals.docs.filter((doc) =>
    ["enrolled", "rewarded"].includes(doc.data().status),
  ).length;
  const pending = referrals.docs.filter((doc) =>
    doc.data().status === "registered",
  ).length;
  const totalPointsEarned = ledger.docs.reduce(
    (sum, doc) => sum + Number(doc.data().points ?? 0),
    0,
  );

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
    const schema = z.object({ code: z.string().trim().length(8) });
    const payload = schema.parse(req.body);
    const userDoc = await findUserByReferralCode(payload.code);
    res.status(200).json({
      success: true,
      data: {
        valid: Boolean(userDoc),
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: "Validation failed",
      message: error.message,
    });
  }
});

export const referralApp = app;
