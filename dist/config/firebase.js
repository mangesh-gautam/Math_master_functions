"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rtdb = exports.storage = exports.db = exports.auth = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const database_1 = require("firebase-admin/database");
// Initialize the app if it hasn't been initialized already
// In firebase-admin v13, initializeApp is idempotent if called with the same arguments,
// but checking getApps() is a safe and standard pattern for Cloud Functions.
const app = (0, app_1.getApps)().length === 0 ? (0, app_1.initializeApp)() : (0, app_1.getApp)();
exports.auth = (0, auth_1.getAuth)(app);
exports.db = (0, firestore_1.getFirestore)(app);
exports.storage = (0, storage_1.getStorage)(app);
exports.rtdb = (0, database_1.getDatabase)(app);
exports.default = app;
//# sourceMappingURL=firebase.js.map