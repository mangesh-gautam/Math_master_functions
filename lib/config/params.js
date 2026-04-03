"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fbApiKeySecret = void 0;
const params_1 = require("firebase-functions/params");
/**
 * Secret definition for the Firebase Web API Key.
 * Found in Firebase Console > Project Settings > General.
 * Set in production using: firebase functions:secrets:set FB_API_KEY
 */
exports.fbApiKeySecret = (0, params_1.defineSecret)('FB_API_KEY');
//# sourceMappingURL=params.js.map