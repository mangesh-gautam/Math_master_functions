import express from 'express';
import cors from 'cors';
import { authMiddleware } from '../middleware/auth';
import { db } from '../config/firebase';
import { query } from '../config/database';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Mock course data
const MOCK_COURSES = [
  { id: 'math-101', title: 'Algebra Foundations', level: 'Beginner', price: 0 },
  { id: 'math-201', title: 'Calculus I', level: 'Intermediate', price: 99 },
  { id: 'math-301', title: 'Linear Algebra', level: 'Advanced', price: 149 },
];

// GET /list - Fetch all courses (Public)
app.get('/list', (req, res) => {
  res.status(200).json({ success: true, data: MOCK_COURSES });
});

// POST /enroll - Enroll current user in a course
app.post('/enroll', authMiddleware, async (req, res) => {
  const { uid } = (req as any).user;
  const { courseId } = req.body;

  if (!courseId) {
    return res.status(400).json({ success: false, error: 'Course ID is required' });
  }

  try {
    // 1. Check if course exists
    const course = MOCK_COURSES.find(c => c.id === courseId);
    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    // 2. Synchronize enrollment in Firestore
    const enrollmentId = `${uid}_${courseId}`;
    await db.collection('enrollments').doc(enrollmentId).set({
      uid,
      courseId,
      status: 'active',
      enrolledAt: new Date(),
    });

    // 3. Synchronize enrollment in Supabase (PostgreSQL)
    await query(
      'INSERT INTO enrollments (uid, course_id, status, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING',
      [uid, courseId, 'active']
    );

    return res.status(201).json({ 
      success: true, 
      message: 'Enrolled successfully',
      data: { enrollmentId }
    });

  } catch (error: any) {
    console.error('Enrollment Error:', error);
    return res.status(500).json({ success: false, error: 'Enrollment failed', message: error.message });
  }
});

export const coursesApp = app;
