import { NextFunction, Request, Response } from "express";
import { verifyAdminAccessToken } from "../utils/adminAuth";

export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    const token = authHeader.split("Bearer ")[1];
    const payload = verifyAdminAccessToken(token);
    (req as Request & { admin?: unknown }).admin = payload;
    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: "Admin authentication failed",
      message: error.message,
    });
  }
}
