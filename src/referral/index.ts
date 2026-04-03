import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// GET /code
app.get('/code', (req, res) => {
  res.status(200).json({ success: true, data: { code: "STUBCODE" } });
});

export const referralApp = app;
