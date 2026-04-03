import express from "express";
import cors from "cors";
import { z } from "zod";
import { db, auth } from "../config/firebase";
import { query } from "../config/database";
import axios from "axios";
import { fbApiKeySecret } from "../config/params";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const registerSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
    Mob: z.string().min(10), // Mobile Number
    schoolName: z.string().min(2),
    className: z.string().min(1),
    schoolMedium: z.string().min(2),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// POST /register
app.post("/register", async (req, res) => {
  try {
    // 1. Validate request body
    const validatedData = registerSchema.parse(req.body);
    const { email, password, name, Mob, schoolName, className, schoolMedium } =
      validatedData;

    // 2. Create Firebase Auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // 3. Store in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      name,
      email,
      mobile: Mob,
      schoolName,
      class: className,
      medium: schoolMedium,
      role: "student",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 4. Store in Supabase (PostgreSQL)
    // Mapping camelCase to snake_case for PostgreSQL best practices
    await query(
      `INSERT INTO Musers (uid, name, email, mobile, school_name, class_name, school_medium, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        userRecord.uid,
        name,
        email,
        Mob,
        schoolName,
        className,
        schoolMedium,
        "student",
      ],
    );

    return res.status(201).json({
      success: true,
      message: "User registered successfully in both Firestore and Supabase",
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
      },
    });
  } catch (error: any) {
    console.error("Registration Error:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: "Validation Error",
        details: error.errors.map((err) => ({
          field: err.path[0],
          message: err.message,
        })),
      });
      return;
    }

    // Handle Firebase Auth errors (e.g., email already exists)
    if (error.code === "auth/email-already-exists") {
      res.status(409).json({
        success: false,
        error: "Email already exists",
      });
      return;
    }

    return res.status(500).json({
      success: false,
      error: "Registration failed",
      message: error.message,
    });
  }
});

// POST /login
app.post("/login", async (req, res) => {
  try {
    // 1. Validate request
    const { email, password } = loginSchema.parse(req.body);

    // 2. Authenticate with Firebase Auth REST API
    // Since Firebase Admin SDK doesn't sign in, we use the REST endpoint.
    const apiKey = fbApiKeySecret.value();
    const loginResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      { email, password, returnSecureToken: true },
    );

    console.log(loginResponse.data);
    const { idToken, localId } = loginResponse.data;

    // 3. Fetch user profile from Firestore and Supabase
    // We try Firestore first, then fallback to common info
    const userDoc = await db.collection("users").doc(localId).get();
    const pgResult = await query("SELECT * FROM Musers WHERE uid = $1", [
      localId,
    ]);

    return res.status(200).json({
      success: true,
      data: {
        token: idToken,
        uid: localId,
        profile: userDoc.exists ? userDoc.data() : null,
        pgProfile: pgResult.rows[0] || null,
      },
    });
  } catch (error: any) {
    console.error("Login Error:", error);

    // Handle Zod Error
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation Error" });
      return;
    }

    // Handle Axios/Auth Error (Invalid Email/Password)
    if (axios.isAxiosError(error) && error.response) {
      const firebaseError = error.response.data.error;
      res.status(error.response.status).json({
        success: false,
        error: firebaseError.message,
      });
      return;
    }

    return res.status(500).json({
      success: false,
      error: "Login failed",
      message: error.message,
    });
  }
});

export const authApp = app;
