import express from "express";
import cors from "cors";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "../config/firebase";
import { authMiddleware } from "../middleware/auth";
import { creditPoints, scoreToTestPoints } from "../utils/wallet";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/list", authMiddleware, async (req, res) => {
  let query = db.collection("tests").where("is_active", "==", true);
  if (typeof req.query.class === "string") {
    query = query.where("class_standard", "==", Number(req.query.class));
  }
  if (typeof req.query.subject === "string") {
    query = query.where("subject", "==", req.query.subject);
  }

  const snap = await query.get();
  res.status(200).json({
    success: true,
    data: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  });
});

app.get("/:testId", authMiddleware, async (req, res) => {
  const snap = await db.collection("tests").doc(req.params.testId).get();
  if (!snap.exists) {
    res.status(404).json({ success: false, error: "Test not found" });
    return;
  }
  res.status(200).json({ success: true, data: { id: snap.id, ...snap.data() } });
});

app.post("/:testId/submit", authMiddleware, async (req, res) => {
  try {
    const schema = z.object({
      answers: z.record(z.string(), z.string()),
      time_taken_seconds: z.number().int().nonnegative().default(0),
    });
    const payload = schema.parse(req.body);
    const { uid } = (req as any).user;
    const testId = req.params.testId;
    const testSnap = await db.collection("tests").doc(testId).get();

    if (!testSnap.exists) {
      res.status(404).json({ success: false, error: "Test not found" });
      return;
    }

    const test = testSnap.data() ?? {};
    const questions = Array.isArray(test.questions) ? test.questions : [];
    const correctCount = questions.reduce((count: number, question: any) => {
      return count + (payload.answers[question.id] === question.correct_answer ? 1 : 0);
    }, 0);
    const totalQuestions = questions.length || 1;
    const scorePercentage = (correctCount / totalQuestions) * 100;
    const score = Number(
      ((correctCount / totalQuestions) * Number(test.total_marks ?? totalQuestions)).toFixed(2),
    );
    const pointsAwarded = scoreToTestPoints(scorePercentage);

    const existingAttempts = await db
      .collection("test_attempts")
      .where("test_id", "==", testId)
      .orderBy("score", "desc")
      .get();

    let rank = 1;
    for (const doc of existingAttempts.docs) {
      if (Number(doc.data().score ?? 0) > score) {
        rank += 1;
      }
    }

    const attemptRef = db.collection("test_attempts").doc();
    await attemptRef.set({
      id: attemptRef.id,
      test_id: testId,
      user_id: uid,
      answers: payload.answers,
      score,
      rank,
      points_awarded: pointsAwarded,
      rank_bonus_credited: rank === 1,
      time_taken_seconds: payload.time_taken_seconds,
      submitted_at: FieldValue.serverTimestamp(),
    });

    await creditPoints({
      userId: uid,
      activity: "TEST_COMPLETE",
      points: pointsAwarded,
      refId: attemptRef.id,
      description: `Test completion reward for ${testId}`,
    });

    if (rank === 1) {
      await creditPoints({
        userId: uid,
        activity: "RANK_FIRST",
        points: 100,
        refId: testId,
        description: `Top rank reward for ${testId}`,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        attempt_id: attemptRef.id,
        score,
        rank,
        points_awarded: pointsAwarded,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: "Failed to submit test",
      message: error.message,
    });
  }
});

app.get("/:testId/result", authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;
  const snap = await db
    .collection("test_attempts")
    .where("test_id", "==", req.params.testId)
    .where("user_id", "==", uid)
    .orderBy("submitted_at", "desc")
    .limit(1)
    .get();

  if (snap.empty) {
    res.status(404).json({ success: false, error: "Result not found" });
    return;
  }

  res.status(200).json({
    success: true,
    data: { id: snap.docs[0].id, ...snap.docs[0].data() },
  });
});

app.get("/:testId/leaderboard", authMiddleware, async (req, res) => {
  const snap = await db
    .collection("test_attempts")
    .where("test_id", "==", req.params.testId)
    .orderBy("score", "desc")
    .limit(10)
    .get();

  res.status(200).json({
    success: true,
    data: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  });
});

export const testsApp = app;
