"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const supabaseQuery_1 = require("../utils/supabaseQuery");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const adminAuth_1 = require("../utils/adminAuth");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
app.post("/adminRegister", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        // ✅ 1. Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required",
            });
        }
        // ✅ 2. Check existing user (optimized)
        const existingUser = await (0, supabaseQuery_1.executeQuery)("SELECT id FROM admins WHERE email = $1 LIMIT 1", [email]);
        if (!existingUser.success) {
            return res.status(500).json({
                message: existingUser.error,
            });
        }
        if (existingUser.data?.length) {
            return res.status(400).json({
                message: "Email already registered",
            });
        }
        // ✅ 3. Hash password (VERY IMPORTANT)
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // ✅ 4. Insert user (with RETURNING)
        const insertRes = await (0, supabaseQuery_1.executeQuery)(`INSERT INTO admins (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`, [name, email, hashedPassword, role || "admin"]);
        if (!insertRes.success) {
            return res.status(500).json({
                message: insertRes.error,
            });
        }
        const accessToken = (0, adminAuth_1.createAdminAccessToken)({
            admin_id: insertRes.data?.[0].id,
            email,
        });
        // ✅ 5. Success response
        return res.status(201).json({
            message: "Admin registered successfully",
            data: {
                accessToken,
                token: accessToken,
                user: insertRes.data?.[0],
            },
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Server error",
        });
    }
});
app.post("/adminLogin", async (req, res) => {
    try {
        const { email, password } = req.body;
        // ✅ 1. Validation
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }
        // ✅ 2. Get user from DB
        const userRes = await (0, supabaseQuery_1.executeQuery)("SELECT id, name, email, password, role FROM admins WHERE email = $1 LIMIT 1", [email]);
        if (!userRes.success) {
            return res.status(500).json({
                message: userRes.error,
            });
        }
        const user = userRes.data?.[0];
        // ❌ 3. If user not found
        if (!user) {
            return res.status(400).json({
                message: "Invalid email or password",
            });
        }
        // ✅ 4. Compare password
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid email or password",
            });
        }
        const accessToken = (0, adminAuth_1.createAdminAccessToken)({
            admin_id: user.id,
            email: user.email,
        });
        // ✅ 5. Success response (without password)
        return res.status(200).json({
            message: "Login successful",
            data: {
                accessToken,
                token: accessToken,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Server error",
        });
    }
});
exports.authApp = app;
//# sourceMappingURL=index.js.map