import express from "express";
import cors from "cors";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "../config/firebase";
import { authMiddleware } from "../middleware/auth";
import { creditPoints } from "../utils/wallet";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const profileUpdateSchema = z.object({
  first_name: z.string().min(2).optional(),
  last_name: z.string().min(2).optional(),
  father_name: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  school_name: z.string().min(2).optional(),
  class_standard: z.coerce.number().int().min(1).max(12).optional(),
  profile_image_url: z.string().url().optional(),
});

function isProfileComplete(data: Record<string, unknown>): boolean {
  return Boolean(
    data.first_name &&
      data.last_name &&
      data.father_name &&
      data.email &&
      data.phone &&
      data.school_name &&
      data.class_standard,
  );
}

app.get("/me", authMiddleware, async (req, res) => {
  const { uid } = (req as RequestWithUser).user;
  const snap = await db.collection("users").doc(uid).get();

  if (!snap.exists) {
    res.status(404).json({ success: false, error: "Profile not found" });
    return;
  }

  const walletSnap = await db.collection("wallets").doc(uid).get();
  res.status(200).json({
    success: true,
    data: {
      id: snap.id,
      ...snap.data(),
      wallet: walletSnap.exists ? walletSnap.data() : null,
    },
  });
});

app.put("/me", authMiddleware, async (req, res) => {
  try {
    const { uid } = (req as RequestWithUser).user;
    const payload = profileUpdateSchema.parse(req.body);
    const userRef = db.collection("users").doc(uid);
    const before = await userRef.get();

    if (!before.exists) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }

    const nextData = {
      ...before.data(),
      ...payload,
      updated_at: FieldValue.serverTimestamp(),
    };

    await userRef.set(nextData, { merge: true });

    if (!before.data()?.profile_complete && isProfileComplete(nextData)) {
      await userRef.set({ profile_complete: true }, { merge: true });
      await creditPoints({
        userId: uid,
        activity: "PROFILE_COMPLETE",
        points: 25,
        description: "Profile completion bonus",
      });
    }

    res.status(200).json({ success: true, data: nextData });
  } catch (error: unknown) {
    handleError(res, error, "Failed to update profile");
  }
});

app.put("/image", authMiddleware, async (req, res) => {
  try {
    const { uid } = (req as RequestWithUser).user;
    const schema = z.object({ profile_image_url: z.string().url() });
    const payload = schema.parse(req.body);

    await db.collection("users").doc(uid).set(
      {
        profile_image_url: payload.profile_image_url,
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    res.status(200).json({ success: true, data: payload });
  } catch (error: unknown) {
    handleError(res, error, "Failed to update image");
  }
});

type RequestWithUser = express.Request & {
  user: {
    uid: string;
  };
};

function handleError(
  res: express.Response,
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof z.ZodError) {
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

export const profileApp = app;
