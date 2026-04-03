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
import { dbUrlSecret } from "./config/database";
import { fbApiKeySecret } from "./config/params";

const REGION = "asia-south1";
const GLOBAL_OPTIONS = {
  region: REGION,
  secrets: [dbUrlSecret, fbApiKeySecret],
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

// Stubs for triggers and pubsub
exports.onEnrollmentCreated = functions.firestore.onDocumentCreated(
  {
    document: "enrollments/{id}",
    ...GLOBAL_OPTIONS,
  },
  async (event) => {
    console.log("Triggered onEnrollmentCreated for", event.params.id);
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
