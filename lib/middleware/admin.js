"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMiddleware = adminMiddleware;
const firebase_1 = require("../config/firebase");
const auth_1 = require("./auth");
async function adminMiddleware(req, res, next) {
    await (0, auth_1.authMiddleware)(req, res, async () => {
        const user = req.user;
        if (!user?.uid) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const doc = await firebase_1.db.collection("users").doc(user.uid).get();
        const role = doc.data()?.role;
        if (role !== "admin") {
            res.status(403).json({ success: false, error: "Admin access required" });
            return;
        }
        next();
    });
}
//# sourceMappingURL=admin.js.map