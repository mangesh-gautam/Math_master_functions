"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("../middleware/auth");
const database_1 = require("../config/database");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// GET /balance - Fetch current wallet balance
app.get('/balance', auth_1.authMiddleware, async (req, res) => {
    const { uid } = req.user;
    try {
        // 1. Check if user has a wallet in Supabase
        let result = await (0, database_1.query)('SELECT balance FROM wallets WHERE uid = $1', [uid]);
        // 2. If no wallet exists, create one with 0 balance (auto-provisioning)
        if (result.rows.length === 0) {
            await (0, database_1.query)('INSERT INTO wallets (uid, balance, created_at, updated_at) VALUES ($1, 0, NOW(), NOW())', [uid]);
            result = await (0, database_1.query)('SELECT balance FROM wallets WHERE uid = $1', [uid]);
        }
        return res.status(200).json({
            success: true,
            data: { balance: result.rows[0].balance }
        });
    }
    catch (error) {
        console.error('Wallet Balance Error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch balance', message: error.message });
    }
});
// GET /transactions - Fetch transaction history
app.get('/transactions', auth_1.authMiddleware, async (req, res) => {
    const { uid } = req.user;
    try {
        const result = await (0, database_1.query)('SELECT * FROM transactions WHERE uid = $1 ORDER BY created_at DESC LIMIT 50', [uid]);
        return res.status(200).json({
            success: true,
            data: result.rows
        });
    }
    catch (error) {
        console.error('Wallet Transactions Error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch transactions', message: error.message });
    }
});
exports.walletApp = app;
//# sourceMappingURL=index.js.map