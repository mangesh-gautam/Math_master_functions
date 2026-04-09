"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMiddleware = adminMiddleware;
const adminAuth_1 = require("../utils/adminAuth");
async function adminMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
    }
    try {
        const token = authHeader.split("Bearer ")[1];
        const payload = (0, adminAuth_1.verifyAdminAccessToken)(token);
        req.admin = payload;
        next();
    }
    catch (error) {
        res.status(401).json({
            success: false,
            error: "Admin authentication failed",
            message: error.message,
        });
    }
}
//# sourceMappingURL=admin.js.map