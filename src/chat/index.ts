import express from "express";
import cors from "cors";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { db, storage } from "../config/firebase";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/rooms", authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;
  const enrollments = await db
    .collection("enrollments")
    .where("user_id", "==", uid)
    .get();

  const rooms = await Promise.all(
    enrollments.docs.map(async (doc) => {
      const courseId = doc.data().course_id;
      const courseDoc = await db.collection("courses").doc(courseId).get();
      const lastMessageSnap = await db
        .collection("chat_messages")
        .where("room_id", "==", courseId)
        .orderBy("created_at", "desc")
        .limit(1)
        .get();
      const lastMessage = lastMessageSnap.empty ? null : lastMessageSnap.docs[0].data();

      return {
        id: courseId,
        course_name: courseDoc.data()?.title ?? "Course Chat",
        thumbnail: courseDoc.data()?.thumbnail_url ?? null,
        last_message: lastMessage?.content ?? "",
        last_message_at:
          typeof lastMessage?.created_at?.toDate === "function" ?
            lastMessage.created_at.toDate().toISOString() :
            null,
        unread_count: 0,
        members_count: 0,
        is_muted: false,
      };
    }),
  );

  res.status(200).json({ success: true, data: rooms });
});

app.get("/messages", authMiddleware, async (req, res) => {
  const roomId = String(req.query.room_id ?? "");
  const limit = Math.min(Math.max(Number(req.query.limit ?? 30), 1), 50);
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const offset = (page - 1) * limit;

  const snap = await db
    .collection("chat_messages")
    .where("room_id", "==", roomId)
    .orderBy("created_at", "desc")
    .offset(offset)
    .limit(limit)
    .get();

  res.status(200).json({
    success: true,
    messages: snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .reverse(),
    has_more: snap.size === limit,
  });
});

app.post("/messages", authMiddleware, async (req, res) => {
  try {
    const schema = z.object({
      room_id: z.string().min(1),
      content: z.string().min(1),
      type: z.enum(["text", "image", "announcement", "system"]).default("text"),
      reply_to: z.string().nullable().optional(),
    });
    const payload = schema.parse(req.body);
    const { uid } = (req as any).user;
    const userSnap = await db.collection("users").doc(uid).get();
    const messageRef = db.collection("chat_messages").doc();
    await messageRef.set({
      id: messageRef.id,
      room_id: payload.room_id,
      sender_id: uid,
      sender_name:
        `${userSnap.data()?.first_name ?? ""} ${userSnap.data()?.last_name ?? ""}`.trim() ||
        "Student",
      sender_avatar: userSnap.data()?.profile_image_url ?? null,
      sender_role: userSnap.data()?.role ?? "student",
      type: payload.type,
      content: payload.content,
      reply_to: payload.reply_to ?? null,
      is_deleted: false,
      reactions: [],
      read_by: [uid],
      created_at: FieldValue.serverTimestamp(),
    });

    const saved = await messageRef.get();
    res.status(201).json({ success: true, data: { id: saved.id, ...saved.data() } });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: "Failed to post message",
      message: error.message,
    });
  }
});

app.delete("/messages/:messageId", authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;
  const ref = db.collection("chat_messages").doc(req.params.messageId);
  const snap = await ref.get();

  if (!snap.exists) {
    res.status(404).json({ success: false, error: "Message not found" });
    return;
  }
  if (snap.data()?.sender_id !== uid) {
    res.status(403).json({ success: false, error: "Cannot delete this message" });
    return;
  }

  await ref.set(
    {
      is_deleted: true,
      content: "This message was deleted",
    },
    { merge: true },
  );

  res.status(200).json({ success: true });
});

app.post("/upload", authMiddleware, async (req, res) => {
  try {
    const schema = z.object({
      fileName: z.string().min(1),
      contentType: z.string().min(1),
      base64: z.string().min(10),
    });
    const payload = schema.parse(req.body);
    const { uid } = (req as any).user;
    const bucket = storage.bucket();
    const path = `chat/${uid}/${Date.now()}-${payload.fileName}`;
    const file = bucket.file(path);
    await file.save(Buffer.from(payload.base64, "base64"), {
      metadata: { contentType: payload.contentType },
      resumable: false,
    });
    await file.makePublic();

    res.status(201).json({
      success: true,
      data: { url: `https://storage.googleapis.com/${bucket.name}/${path}` },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: "Failed to upload image",
      message: error.message,
    });
  }
});

app.post("/reactions", authMiddleware, async (req, res) => {
  try {
    const schema = z.object({
      message_id: z.string().min(1),
      emoji: z.string().min(1),
    });
    const payload = schema.parse(req.body);
    const { uid } = (req as any).user;
    const messageRef = db.collection("chat_messages").doc(payload.message_id);
    const messageSnap = await messageRef.get();

    if (!messageSnap.exists) {
      res.status(404).json({ success: false, error: "Message not found" });
      return;
    }

    const message = messageSnap.data() ?? {};
    const reactions = Array.isArray(message.reactions) ? [...message.reactions] : [];
    const index = reactions.findIndex((reaction) => reaction.emoji === payload.emoji);

    if (index === -1) {
      reactions.push({ emoji: payload.emoji, user_ids: [uid], count: 1 });
    } else {
      const reaction = reactions[index];
      const users: string[] = Array.isArray(reaction.user_ids) ? reaction.user_ids : [];
      if (users.includes(uid)) {
        const filteredUsers = users.filter((value) => value !== uid);
        if (filteredUsers.length === 0) {
          reactions.splice(index, 1);
        } else {
          reactions[index] = {
            ...reaction,
            user_ids: filteredUsers,
            count: filteredUsers.length,
          };
        }
      } else {
        reactions[index] = {
          ...reaction,
          user_ids: [...users, uid],
          count: users.length + 1,
        };
      }
    }

    await messageRef.set({ reactions }, { merge: true });
    res.status(200).json({ success: true, data: reactions });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: "Failed to toggle reaction",
      message: error.message,
    });
  }
});

export const chatApp = app;
