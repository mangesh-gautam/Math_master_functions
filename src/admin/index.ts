import express from "express";
import cors from "cors";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminMiddleware } from "../middleware/admin";
import { db } from "../config/firebase";
import { creditPoints } from "../utils/wallet";
import { supabaseQuery } from "../utils/supabaseQuery";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const parseJsonArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [trimmed];
    } catch {
      return trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const parseBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return fallback;
};

const pickFirst = (...values: unknown[]) => values.find((value) => value !== undefined && value !== null);

const courseSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  class_standard: z.coerce.number().int().min(1).max(12),
  subject: z.string().min(2).default("Mathematics"),
  medium: z.string().min(2).default("English"),
  tutor_name: z.string().min(2),
  thumbnail_url: z.string().url().optional(),
  original_price: z.coerce.number().nonnegative(),
  discount_price: z.coerce.number().nonnegative(),
  is_free: z.boolean().default(false),
  chapters: z.array(z.any()).default([]),
  videos: z.array(z.string()).default([]),
  pdfs: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  duration: z.string().default(""),
  students_enrolled: z.coerce.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true),
});

const normalizeCoursePayload = (body: Record<string, unknown>) => ({
  title: pickFirst(body.title, body.course_title, body.courseName, body.name),
  description: pickFirst(body.description, body.course_description, body.desc, body.details),
  class_standard: pickFirst(body.class_standard, body.class, body.standard),
  subject: pickFirst(body.subject, body.category),
  medium: pickFirst(body.medium, body.language),
  tutor_name: pickFirst(
    body.tutor_name,
    body.tutorName,
    body.teacher_name,
    body.teacherName,
    body.instructor_name,
    body.instructorName,
  ),
  thumbnail_url: pickFirst(
    body.thumbnail_url,
    body.thumbnail,
    body.image,
    body.image_url,
    body.banner,
    body.banner_url,
  ),
  original_price: pickFirst(body.original_price, body.price, body.mrp),
  discount_price: pickFirst(body.discount_price, body.sale_price, body.offer_price, body.final_price),
  is_free: parseBoolean(body.is_free, false),
  chapters: parseJsonArray(pickFirst(body.chapters, body.chapter_list, body.curriculum)),
  videos: parseJsonArray(pickFirst(body.videos, body.video_urls, body.videoLinks)),
  pdfs: parseJsonArray(pickFirst(body.pdfs, body.pdf_urls, body.pdfLinks)),
  images: parseJsonArray(pickFirst(body.images, body.image_urls, body.gallery)),
  notes: parseJsonArray(pickFirst(body.notes, body.note_urls, body.study_materials)),
  duration: String(pickFirst(body.duration, body.course_duration, "") ?? ""),
  students_enrolled: pickFirst(body.students_enrolled, body.total_students, 0),
  is_active: parseBoolean(pickFirst(body.is_active, body.active, true), true),
});

const createCourseHandler = async (req: express.Request, res: express.Response) => {
  try {
    const payload = courseSchema.parse(normalizeCoursePayload(req.body as Record<string, unknown>));
    const ref = db.collection("courses").doc();
    const firestorePayload = {
      id: ref.id,
      ...payload,
      rating: 0,
      total_ratings: 0,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    await ref.set(firestorePayload);

    let supabaseSynced = true;
    try {
      await supabaseQuery.insert("courses", {
        id: ref.id,
        title: payload.title,
        description: payload.description,
        class_standard: payload.class_standard,
        subject: payload.subject,
        medium: payload.medium,
        tutor_name: payload.tutor_name,
        thumbnail_url: payload.thumbnail_url ?? null,
        original_price: payload.original_price,
        discount_price: payload.discount_price,
        is_free: payload.is_free,
        chapters: payload.chapters,
        videos: payload.videos,
        pdfs: payload.pdfs,
        images: payload.images,
        notes: payload.notes,
        duration: payload.duration,
        students_enrolled: payload.students_enrolled,
        is_active: payload.is_active,
        rating: 0,
        total_ratings: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (supabaseError) {
      supabaseSynced = false;
      console.error("Supabase course sync failed", {
        courseId: ref.id,
        error: supabaseError,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: ref.id,
        ...payload,
      },
      message: supabaseSynced ?
        "Course created in Firestore and Supabase" :
        "Course created in Firestore",
      meta: {
        firestore_synced: true,
        supabase_synced: supabaseSynced,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: "Failed to create course",
      message: error.message,
    });
  }
};

app.post("/courses", adminMiddleware, createCourseHandler);
app.post("/courses/add", adminMiddleware, createCourseHandler);

app.put("/courses/:id", adminMiddleware, async (req, res) => {
  await db.collection("courses").doc(req.params.id).set(
    {
      ...req.body,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  res.status(200).json({ success: true });
});

app.post("/tests", adminMiddleware, async (req, res) => {
  const ref = db.collection("tests").doc();
  await ref.set({
    id: ref.id,
    ...req.body,
    created_at: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ success: true, data: { id: ref.id } });
});

app.post("/points/campaign", adminMiddleware, async (req, res) => {
  try {
    const schema = z.object({
      points: z.number().int().positive(),
      activity: z.string().min(1).default("PROMOTIONAL"),
      user_ids: z.array(z.string()).optional(),
    });
    const payload = schema.parse(req.body);
    const users = payload.user_ids?.length ?
      payload.user_ids :
      (await db.collection("users").get()).docs.map((doc) => doc.id);

    await Promise.all(
      users.map((userId) =>
        creditPoints({
          userId,
          activity: payload.activity,
          points: payload.points,
          refId: `${payload.activity}-${Date.now()}`,
          description: "Promotional points campaign",
          allowDuplicate: true,
        }),
      ),
    );

    res.status(200).json({
      success: true,
      data: { users_processed: users.length },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: "Failed to run campaign",
      message: error.message,
    });
  }
});

app.get("/analytics/referrals", adminMiddleware, async (_req, res) => {
  const referrals = await db.collection("referrals").get();
  const byStatus = referrals.docs.reduce<Record<string, number>>((acc, doc) => {
    const status = String(doc.data().status ?? "unknown");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  res.status(200).json({ success: true, data: byStatus });
});

app.get("/analytics/wallet", adminMiddleware, async (_req, res) => {
  const wallets = await db.collection("wallets").get();
  const data = wallets.docs.reduce(
    (acc, doc) => {
      const wallet = doc.data();
      acc.total_balance += Number(wallet.balance ?? 0);
      acc.total_earned += Number(wallet.total_earned ?? 0);
      acc.total_redeemed += Number(wallet.total_redeemed ?? 0);
      return acc;
    },
    { total_balance: 0, total_earned: 0, total_redeemed: 0 },
  );

  res.status(200).json({ success: true, data });
});

app.put("/referral-config", adminMiddleware, async (req, res) => {
  await db.collection("config").doc("referral").set(
    {
      ...req.body,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  res.status(200).json({ success: true });
});

export const adminApp = app;
