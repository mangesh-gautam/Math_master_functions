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
const database_1 = require("./config/database");
const params_1 = require("./config/params");
const REGION = "asia-south1";
const GLOBAL_OPTIONS = {
    region: REGION,
    secrets: [database_1.dbUrlSecret, params_1.fbApiKeySecret],
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
// Stubs for triggers and pubsub
exports.onEnrollmentCreated = functions.firestore.onDocumentCreated({
    document: "enrollments/{id}",
    ...GLOBAL_OPTIONS,
}, async (event) => {
    console.log("Triggered onEnrollmentCreated for", event.params.id);
});
exports.expirePoints = functions.scheduler.onSchedule({
    schedule: "every day 03:00",
    timeZone: "Asia/Kolkata",
    ...GLOBAL_OPTIONS,
}, async (event) => {
    console.log("Scheduled expirePoints triggered");
});
//# sourceMappingURL=index.js.map