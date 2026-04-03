import express from 'express';
import cors from 'cors';
import { db, auth } from '../config/firebase';
import { query, executeFunction } from '../config/database';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Example test route using consolidated services
app.get('/test-config', async (req, res) => {
  try {
    const collections = await db.listCollections();
    const users = await auth.listUsers(1);
    res.json({ 
      status: 'success', 
      firestoreCollections: collections.length,
      recentUsers: users.users.length 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 1. Raw SQL Query Example
app.get('/db-raw', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as current_time');
    res.json({ status: 'success', data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 2. Parameterized Query Example (Prevents SQL Injection)
app.get('/db-param', async (req, res) => {
  const { id } = req.query;
  try {
    // Using $1 as a placeholder for the first parameter
    const result = await query('SELECT * FROM users WHERE id = $1', [id || 1]);
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 3. Stored Procedure (PostgreSQL Function) Example
app.get('/db-proc', async (req, res) => {
  try {
    // Executes: SELECT * FROM get_user_stats($1, $2)
    const result = await executeFunction('get_user_stats', [1, '2024-01-01']);
    res.json({ status: 'success', data: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export const chatApp = app;
