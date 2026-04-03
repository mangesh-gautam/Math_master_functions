import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';

/**
 * Middleware to verify Firebase ID tokens.
 * Adds the decoded uid to the request object.
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized', 
      message: 'Missing or invalid Authorization header' 
    });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    (req as any).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    return next();
  } catch (error: any) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized', 
      message: 'Invalid or expired token' 
    });
  }
};
