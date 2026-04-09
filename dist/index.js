"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const functions = __importStar(require("firebase-functions/v2"));
require("./config/firebase"); // Centralized initialization
// Import Express apps
const index_1 = require("./auth/index");
const index_2 = require("./wallet/index");
const index_3 = require("./referral/index");
const index_4 = require("./courses/index");
const index_5 = require("./tests/index");
const index_6 = require("./chat/index");
const index_7 = require("./notifications/index");
const index_8 = require("./admin/index");
const index_9 = require("./books/index");
const index_10 = require("./profile/index");
const database_1 = require("./config/database");
const params_1 = require("./config/params");
const firebase_1 = require("./config/firebase");
const wallet_1 = require("./utils/wallet");
const REGION = "asia-south1";
const GLOBAL_OPTIONS = {
    region: REGION,
    secrets: [database_1.dbUrlSecret, params_1.fbApiKeySecret, params_1.adminAuthSecret],
};
// Export HTTP services
exports.authService = functions.https.onRequest(GLOBAL_OPTIONS, index_1.authApp);
exports.walletService = functions.https.onRequest(GLOBAL_OPTIONS, index_2.walletApp);
exports.referralService = functions.https.onRequest(GLOBAL_OPTIONS, index_3.referralApp);
exports.coursesService = functions.https.onRequest(GLOBAL_OPTIONS, index_4.coursesApp);
exports.testsService = functions.https.onRequest(GLOBAL_OPTIONS, index_5.testsApp);
exports.chatService = functions.https.onRequest(GLOBAL_OPTIONS, index_6.chatApp);
exports.notifService = functions.https.onRequest(GLOBAL_OPTIONS, index_7.notifApp);
exports.adminService = functions.https.onRequest(GLOBAL_OPTIONS, index_8.adminApp);
exports.booksService = functions.https.onRequest(GLOBAL_OPTIONS, index_9.booksApp);
exports.profileService = functions.https.onRequest(GLOBAL_OPTIONS, index_10.profileApp);
// Stubs for triggers and pubsub
exports.onEnrollmentCreated = functions.firestore.onDocumentCreated({
    document: "enrollments/{id}",
    ...GLOBAL_OPTIONS,
}, async (event) => {
    const enrollment = event.data?.data();
    if (!enrollment?.user_id) {
        return;
    }
    const userSnap = await firebase_1.db.collection("users").doc(enrollment.user_id).get();
    const referredBy = userSnap.data()?.referred_by;
    if (!referredBy) {
        return;
    }
    const referralSnap = await firebase_1.db
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
    await (0, wallet_1.creditPoints)({
        userId: referrerId,
        activity: "REFERRAL_BONUS",
        points: 200,
        refId: referralDoc.id,
        description: "Referral enrollment bonus",
    });
    const existingEnrollments = await firebase_1.db
        .collection("enrollments")
        .where("user_id", "==", enrollment.user_id)
        .get();
    const updatePayload = {
        status: "enrolled",
        enrollment_bonus_credited: true,
        reward_credited_at: new Date(),
        updated_at: new Date(),
    };
    if (existingEnrollments.size === 1) {
        await (0, wallet_1.creditPoints)({
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
});
exports.expirePoints = functions.scheduler.onSchedule({
    schedule: "every day 03:00",
    timeZone: "Asia/Kolkata",
    ...GLOBAL_OPTIONS,
}, async (event) => {
    console.log("Scheduled expirePoints triggered");
});
//# sourceMappingURL=index.js.map