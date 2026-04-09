import express from "express";
import cors from "cors";
import { executeQuery } from "../utils/supabaseQuery";
import bcrypt from "bcryptjs";
import { createAdminAccessToken } from "../utils/adminAuth";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

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
    const existingUser = await executeQuery(
      "SELECT id FROM admins WHERE email = $1 LIMIT 1",
      [email],
    );

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
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ 4. Insert user (with RETURNING)
    const insertRes = await executeQuery(
      `INSERT INTO admins (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, hashedPassword, role || "admin"],
    );

    if (!insertRes.success) {
      return res.status(500).json({
        message: insertRes.error,
      });
    }

    const accessToken = createAdminAccessToken({
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
  } catch (error) {
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
    const userRes = await executeQuery(
      "SELECT id, name, email, password, role FROM admins WHERE email = $1 LIMIT 1",
      [email],
    );

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
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const accessToken = createAdminAccessToken({
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
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
    });
  }
});

export const authApp = app;
