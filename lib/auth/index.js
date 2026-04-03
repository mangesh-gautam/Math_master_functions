"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const zod_1 = require("zod");
const firebase_1 = require("../config/firebase");
const database_1 = require("../config/database");
const axios_1 = __importDefault(require("axios"));
const params_1 = require("../config/params");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    confirmPassword: zod_1.z.string().min(6),
    Mob: zod_1.z.string().min(10), // Mobile Number
    schoolName: zod_1.z.string().min(2),
    className: zod_1.z.string().min(1),
    schoolMedium: zod_1.z.string().min(2),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
// POST /register
app.post('/register', async (req, res) => {
    try {
        // 1. Validate request body
        const validatedData = registerSchema.parse(req.body);
        const { email, password, name, Mob, schoolName, className, schoolMedium } = validatedData;
        // 2. Create Firebase Auth user
        const userRecord = await firebase_1.auth.createUser({
            email,
            password,
            displayName: name,
        });
        // 3. Store in Firestore
        await firebase_1.db.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            name,
            email,
            mobile: Mob,
            schoolName,
            class: className,
            medium: schoolMedium,
            role: 'student',
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        // 4. Store in Supabase (PostgreSQL)
        // Mapping camelCase to snake_case for PostgreSQL best practices
        await (0, database_1.query)(`INSERT INTO Musers (uid, name, email, mobile, school_name, class_name, school_medium, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`, [userRecord.uid, name, email, Mob, schoolName, className, schoolMedium, 'student']);
        res.status(201).json({
            success: true,
            message: "User registered successfully in both Firestore and Supabase",
            data: {
                uid: userRecord.uid,
                email: userRecord.email
            }
        });
    }
    catch (error) {
        console.error('Registration Error:', error);
        // Handle Zod validation errors
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                success: false,
                error: 'Validation Error',
                details: error.errors.map(err => ({ field: err.path[0], message: err.message }))
            });
            return;
        }
        // Handle Firebase Auth errors (e.g., email already exists)
        if (error.code === 'auth/email-already-exists') {
            res.status(409).json({
                success: false,
                error: 'Email already exists'
            });
            return;
        }
        res.status(500).json({
            success: false,
            error: 'Registration failed',
            message: error.message
        });
    }
});
// POST /login
app.post('/login', async (req, res) => {
    try {
        // 1. Validate request
        const { email, password } = loginSchema.parse(req.body);
        // 2. Authenticate with Firebase Auth REST API
        // Since Firebase Admin SDK doesn't sign in, we use the REST endpoint.
        const apiKey = params_1.fbApiKeySecret.value();
        const loginResponse = await axios_1.default.post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, { email, password, returnSecureToken: true });
        const { idToken, localId } = loginResponse.data;
        // 3. Fetch user profile from Firestore and Supabase
        // We try Firestore first, then fallback to common info
        const userDoc = await firebase_1.db.collection('users').doc(localId).get();
        const pgResult = await (0, database_1.query)('SELECT * FROM Musers WHERE uid = $1', [localId]);
        res.status(200).json({
            success: true,
            data: {
                token: idToken,
                uid: localId,
                profile: userDoc.exists ? userDoc.data() : null,
                pgProfile: pgResult.rows[0] || null
            }
        });
    }
    catch (error) {
        console.error('Login Error:', error);
        // Handle Zod Error
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation Error' });
            return;
        }
        // Handle Axios/Auth Error (Invalid Email/Password)
        if (axios_1.default.isAxiosError(error) && error.response) {
            const firebaseError = error.response.data.error;
            res.status(error.response.status).json({
                success: false,
                error: firebaseError.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            error: 'Login failed',
            message: error.message
        });
    }
});
exports.authApp = app;
//# sourceMappingURL=index.js.map