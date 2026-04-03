"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const firebase_1 = require("../config/firebase");
const database_1 = require("../config/database");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// Example test route using consolidated services
app.get('/test-config', async (req, res) => {
    try {
        const collections = await firebase_1.db.listCollections();
        const users = await firebase_1.auth.listUsers(1);
        res.json({
            status: 'success',
            firestoreCollections: collections.length,
            recentUsers: users.users.length
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 1. Raw SQL Query Example
app.get('/db-raw', async (req, res) => {
    try {
        const result = await (0, database_1.query)('SELECT NOW() as current_time');
        res.json({ status: 'success', data: result.rows[0] });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
// 2. Parameterized Query Example (Prevents SQL Injection)
app.get('/db-param', async (req, res) => {
    const { id } = req.query;
    try {
        // Using $1 as a placeholder for the first parameter
        const result = await (0, database_1.query)('SELECT * FROM users WHERE id = $1', [id || 1]);
        res.json({ status: 'success', data: result.rows });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
// 3. Stored Procedure (PostgreSQL Function) Example
app.get('/db-proc', async (req, res) => {
    try {
        // Executes: SELECT * FROM get_user_stats($1, $2)
        const result = await (0, database_1.executeFunction)('get_user_stats', [1, '2024-01-01']);
        res.json({ status: 'success', data: result.rows });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
exports.chatApp = app;
//# sourceMappingURL=index.js.map