"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.coursesApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const firebase_1 = require("../config/firebase");
const wallet_1 = require("../utils/wallet");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// GET /list - Fetch all courses (Public)
app.get("/list", auth_1.authMiddleware, async (req, res) => {
    let query = firebase_1.db.collection("courses").where("is_active", "==", true);
    if (typeof req.query.class === "string") {
        query = query.where("class_standard", "==", Number(req.query.class));
    }
    if (typeof req.query.is_free === "string") {
        query = query.where("is_free", "==", req.query.is_free === "true");
    }
    const snap = await query.get();
    const search = typeof req.query.search === "string" ? req.query.search.toLowerCase() : "";
    const items = snap.docs
        .map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
        };
    })
        .filter((course) => {
        const item = course;
        return (!search ||
            `${String(item.title ?? "")} ${String(item.description ?? "")}`
                .toLowerCase()
                .includes(search));
    });
    res.status(200).json({ success: true, data: items });
});
app.get("/enrolled", auth_1.authMiddleware, async (req, res) => {
    const { uid } = req.user;
    const enrollmentSnap = await firebase_1.db
        .collection("enrollments")
        .where("user_id", "==", uid)
        .get();
    const courseIds = enrollmentSnap.docs.map((doc) => doc.data().course_id).filter(Boolean);
    const items = await Promise.all(courseIds.map(async (courseId) => {
        const courseDoc = await firebase_1.db.collection("courses").doc(String(courseId)).get();
        return courseDoc.exists ? { id: courseDoc.id, ...courseDoc.data() } : null;
    }));
    res.status(200).json({
        success: true,
        data: items.filter(Boolean),
    });
});
app.get("/:courseId", auth_1.authMiddleware, async (req, res) => {
    const snap = await firebase_1.db.collection("courses").doc(req.params.courseId).get();
    if (!snap.exists) {
        res.status(404).json({ success: false, error: "Course not found" });
        return;
    }
    res.status(200).json({ success: true, data: { id: snap.id, ...snap.data() } });
});
app.post("/:courseId/enroll", auth_1.authMiddleware, async (req, res) => {
    try {
        const { uid } = req.user;
        const schema = zod_1.z.object({
            points_to_redeem: zod_1.z.number().int().min(0).default(0),
            razorpay_payment_id: zod_1.z.string().optional(),
            razorpay_order_id: zod_1.z.string().optional(),
        });
        const payload = schema.parse(req.body);
        const courseId = req.params.courseId;
        const [courseSnap, existingEnrollment] = await Promise.all([
            firebase_1.db.collection("courses").doc(courseId).get(),
            firebase_1.db
                .collection("enrollments")
                .where("user_id", "==", uid)
                .where("course_id", "==", courseId)
                .limit(1)
                .get(),
        ]);
        if (!courseSnap.exists) {
            res.status(404).json({ success: false, error: "Course not found" });
            return;
        }
        if (!existingEnrollment.empty) {
            res.status(409).json({ success: false, error: "Already enrolled" });
            return;
        }
        const course = courseSnap.data() ?? {};
        const payablePrice = Number(course.discount_price ?? course.original_price ?? 0);
        let pointsDiscount = 0;
        let newWalletBalance = null;
        if (payload.points_to_redeem > 0) {
            const maxAllowed = (0, wallet_1.maxRedeemablePoints)(payablePrice);
            if (payload.points_to_redeem > maxAllowed) {
                res.status(400).json({
                    success: false,
                    error: "Points exceed redemption cap",
                    data: { max_points_allowed: maxAllowed },
                });
                return;
            }
            const debitResult = await (0, wallet_1.debitPoints)({
                userId: uid,
                points: payload.points_to_redeem,
                refId: courseId,
                description: `Redeemed on course ${courseId}`,
            });
            pointsDiscount = (0, wallet_1.pointsToRupees)(payload.points_to_redeem);
            newWalletBalance = debitResult.balance;
        }
        const remainingPayment = Math.max(payablePrice - pointsDiscount, 0);
        if (remainingPayment > 0 && !payload.razorpay_payment_id) {
            res.status(400).json({
                success: false,
                error: "Payment reference required for partial cash payment",
            });
            return;
        }
        const enrollmentRef = firebase_1.db.collection("enrollments").doc();
        await enrollmentRef.set({
            id: enrollmentRef.id,
            user_id: uid,
            course_id: courseId,
            payment_amount: remainingPayment,
            points_redeemed: payload.points_to_redeem,
            points_discount: pointsDiscount,
            total_original_price: Number(course.original_price ?? payablePrice),
            payment_method: remainingPayment > 0 ? "razorpay" : "points_only",
            razorpay_order_id: payload.razorpay_order_id ?? null,
            razorpay_payment_id: payload.razorpay_payment_id ?? null,
            completed_chapters: [],
            is_course_completed: false,
            completion_points_credited: false,
            enrolled_at: firestore_1.FieldValue.serverTimestamp(),
        });
        res.status(201).json({
            success: true,
            data: {
                enrollment_id: enrollmentRef.id,
                remaining_payable: remainingPayment,
                new_wallet_balance: newWalletBalance,
            },
        });
    }
    catch (error) {
        console.error("Enrollment Error:", error);
        res.status(500).json({
            success: false,
            error: "Enrollment failed",
            message: error.message,
        });
    }
});
app.post("/:courseId/complete-chapter", auth_1.authMiddleware, async (req, res) => {
    try {
        const schema = zod_1.z.object({ chapter_id: zod_1.z.string().min(1) });
        const payload = schema.parse(req.body);
        const { uid } = req.user;
        const courseId = req.params.courseId;
        const enrollmentSnap = await firebase_1.db
            .collection("enrollments")
            .where("user_id", "==", uid)
            .where("course_id", "==", courseId)
            .limit(1)
            .get();
        if (enrollmentSnap.empty) {
            res.status(404).json({ success: false, error: "Enrollment not found" });
            return;
        }
        const enrollmentDoc = enrollmentSnap.docs[0];
        const enrollment = enrollmentDoc.data();
        const completed = new Set(enrollment.completed_chapters ?? []);
        completed.add(payload.chapter_id);
        await enrollmentDoc.ref.set({
            completed_chapters: Array.from(completed),
        }, { merge: true });
        await (0, wallet_1.creditPoints)({
            userId: uid,
            activity: "CHAPTER_COMPLETE",
            points: 15,
            refId: `${courseId}:${payload.chapter_id}`,
            description: "Course chapter completion",
        });
        const courseDoc = await firebase_1.db.collection("courses").doc(courseId).get();
        const chapters = Array.isArray(courseDoc.data()?.chapters) ?
            courseDoc.data()?.chapters :
            [];
        if (chapters.length > 0 &&
            completed.size >= chapters.length &&
            !enrollment.is_course_completed) {
            await enrollmentDoc.ref.set({
                is_course_completed: true,
                completion_points_credited: true,
            }, { merge: true });
            await (0, wallet_1.creditPoints)({
                userId: uid,
                activity: "COURSE_COMPLETE",
                points: 150,
                refId: courseId,
                description: "Full course completion bonus",
            });
        }
        res.status(200).json({
            success: true,
            data: { completed_chapters: Array.from(completed) },
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: "Failed to complete chapter",
            message: error.message,
        });
    }
});
app.post("/:courseId/rate", auth_1.authMiddleware, async (req, res) => {
    try {
        const { uid } = req.user;
        const schema = zod_1.z.object({ rating: zod_1.z.number().min(1).max(5) });
        const payload = schema.parse(req.body);
        const courseRef = firebase_1.db.collection("courses").doc(req.params.courseId);
        const courseSnap = await courseRef.get();
        if (!courseSnap.exists) {
            res.status(404).json({ success: false, error: "Course not found" });
            return;
        }
        const course = courseSnap.data() ?? {};
        const totalRatings = Number(course.total_ratings ?? 0);
        const currentRating = Number(course.rating ?? 0);
        const nextTotalRatings = totalRatings + 1;
        const nextRating = (currentRating * totalRatings + payload.rating) / nextTotalRatings;
        await courseRef.set({
            rating: Number(nextRating.toFixed(2)),
            total_ratings: nextTotalRatings,
            updated_at: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        await (0, wallet_1.creditPoints)({
            userId: uid,
            activity: "COURSE_RATING",
            points: 10,
            refId: req.params.courseId,
            description: "Course rating reward",
        });
        res.status(200).json({ success: true, data: { rating: nextRating } });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: "Failed to rate course",
            message: error.message,
        });
    }
});
app.post("/live-class/:classId/attend", auth_1.authMiddleware, async (req, res) => {
    try {
        const { uid } = req.user;
        const schema = zod_1.z.object({ session_minutes: zod_1.z.number().min(10) });
        const payload = schema.parse(req.body);
        const attendanceRef = firebase_1.db.collection("live_attendance").doc();
        await attendanceRef.set({
            id: attendanceRef.id,
            user_id: uid,
            class_id: req.params.classId,
            session_minutes: payload.session_minutes,
            created_at: firestore_1.FieldValue.serverTimestamp(),
        });
        await (0, wallet_1.creditPoints)({
            userId: uid,
            activity: "LIVE_CLASS",
            points: 20,
            refId: attendanceRef.id,
            description: "Live class attendance reward",
        });
        res.status(201).json({ success: true, data: { attendance_id: attendanceRef.id } });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: "Failed to record attendance",
            message: error.message,
        });
    }
});
exports.coursesApp = app;
//# sourceMappingURL=index.js.map