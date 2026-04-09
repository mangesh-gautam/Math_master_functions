"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const firebase_1 = require("../config/firebase");
/**
 * Middleware to verify Firebase ID tokens.
 * Adds the decoded uid to the request object.
 */
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Missing or invalid Authorization header'
        });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await firebase_1.auth.verifyIdToken(idToken);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
        };
        return next();
    }
    catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid or expired token'
        });
    }
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.js.map