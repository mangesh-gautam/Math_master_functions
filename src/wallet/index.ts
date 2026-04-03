import express from "express";
import cors from "cors";
import { authMiddleware } from "../middleware/auth";
import { query } from "../config/database";

const app = express();
app.use(express.json()); // 🔥 THIS IS REQUIRED

app.use(cors({ origin: true }));
// GET /balance - Fetch current wallet balance
app.get("/balance", authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;

  try {
    // 1. Check if user has a wallet in Supabase
    let result = await query("SELECT balance FROM wallets WHERE uid = $1", [
      uid,
    ]);

    // 2. If no wallet exists, create one with 0 balance (auto-provisioning)
    if (result.rows.length === 0) {
      await query(
        "INSERT INTO wallets (uid, balance, created_at, updated_at) VALUES ($1, 0, NOW(), NOW())",
        [uid],
      );
      result = await query("SELECT balance FROM wallets WHERE uid = $1", [uid]);
    }

    return res.status(200).json({
      success: true,
      data: { balance: result.rows[0].balance },
    });
  } catch (error: any) {
    console.error("Wallet Balance Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch balance",
      message: error.message,
    });
  }
});

// GET /transactions - Fetch transaction history
app.get("/transactions", authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;

  try {
    const result = await query(
      "SELECT * FROM transactions WHERE uid = $1 ORDER BY created_at DESC LIMIT 50",
      [uid],
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    console.error("Wallet Transactions Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch transactions",
      message: error.message,
    });
  }
});

export const walletApp = app;
