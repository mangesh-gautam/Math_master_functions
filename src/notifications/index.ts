import express from "express";
import cors from "cors";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { db } from "../config/firebase";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/history", authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;
  const snap = await db
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

app.post("/mark-read", authMiddleware, async (req, res) => {
  try {
    const schema = z.object({ notification_id: z.string().min(1) });
    const payload = schema.parse(req.body);
    await db.collection("notifications").doc(payload.notification_id).set(
      {
        read: true,
      },
      { merge: true },
    );
    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: "Failed to mark notification as read",
      message: error.message,
    });
  }
});

export const notifApp = app;
