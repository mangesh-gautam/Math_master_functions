import * as functions from "firebase-functions/v2";
import "./config/firebase"; // Centralized initialization

// Import Express apps
import { authApp } from "./auth/index";
import { walletApp } from "./wallet/index";
import { referralApp } from "./referral/index";
import { coursesApp } from "./courses/index";
import { testsApp } from "./tests/index";
import { chatApp } from "./chat/index";
import { notifApp } from "./notifications/index";
import { adminApp } from "./admin/index";
import { booksApp } from "./books/index";
import { profileApp } from "./profile/index";
import { dbUrlSecret } from "./config/database";
import { adminAuthSecret, fbApiKeySecret } from "./config/params";
import { db } from "./config/firebase";
import { creditPoints } from "./utils/wallet";

const REGION = "asia-south1";
const GLOBAL_OPTIONS = {
  region: REGION,
  secrets: [dbUrlSecret, fbApiKeySecret, adminAuthSecret],
};

// Export HTTP services
exports.authService = functions.https.onRequest(GLOBAL_OPTIONS, authApp);
exports.walletService = functions.https.onRequest(
  GLOBAL_OPTIONS,
  walletApp,
);
exports.referralService = functions.https.onRequest(
  GLOBAL_OPTIONS,
  referralApp,
);
exports.coursesService = functions.https.onRequest(
  GLOBAL_OPTIONS,
  coursesApp,
);
exports.testsService = functions.https.onRequest(GLOBAL_OPTIONS, testsApp);
exports.chatService = functions.https.onRequest(GLOBAL_OPTIONS, chatApp);
exports.notifService = functions.https.onRequest(GLOBAL_OPTIONS, notifApp);
exports.adminService = functions.https.onRequest(GLOBAL_OPTIONS, adminApp);
exports.booksService = functions.https.onRequest(GLOBAL_OPTIONS, booksApp);
exports.profileService = functions.https.onRequest(GLOBAL_OPTIONS, profileApp);

// Stubs for triggers and pubsub
exports.onEnrollmentCreated = functions.firestore.onDocumentCreated(
  {
    document: "enrollments/{id}",
    ...GLOBAL_OPTIONS,
  },
  async (event) => {
    const enrollment = event.data?.data();
    if (!enrollment?.user_id) {
      return;
    }

    const userSnap = await db.collection("users").doc(enrollment.user_id).get();
    const referredBy = userSnap.data()?.referred_by;
    if (!referredBy) {
      return;
    }

    const referralSnap = await db
      .collection("referrals")
      .where("referred_id", "==", enrollment.user_id)
      .limit(1)
      .get();
    if (referralSnap.empty) {
      return;
    }

    const referralDoc = referralSnap.docs[0];
    const referral = referralDoc.data();
    const referrerId = referral.referrer_id;

    await creditPoints({
      userId: referrerId,
      activity: "REFERRAL_BONUS",
      points: 200,
      refId: referralDoc.id,
      description: "Referral enrollment bonus",
    });

    const existingEnrollments = await db
      .collection("enrollments")
      .where("user_id", "==", enrollment.user_id)
      .get();

    const updatePayload: Record<string, unknown> = {
      status: "enrolled",
      enrollment_bonus_credited: true,
      reward_credited_at: new Date(),
      updated_at: new Date(),
    };

    if (existingEnrollments.size === 1) {
      await creditPoints({
        userId: referrerId,
        activity: "FIRST_PURCHASE_BONUS",
        points: 100,
        refId: `${referralDoc.id}_fp`,
        description: "Referral first purchase bonus",
      });
      updatePayload.status = "rewarded";
      updatePayload.first_purchase_bonus_credited = true;
    }

    await referralDoc.ref.set(updatePayload, { merge: true });
  },
);

exports.expirePoints = functions.scheduler.onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "Asia/Kolkata",
    ...GLOBAL_OPTIONS,
  },
  async (event) => {
    console.log("Scheduled expirePoints triggered");
  },
);
