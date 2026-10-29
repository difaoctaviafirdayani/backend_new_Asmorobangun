import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
const { JWT_SECRET } = require('../config/env');

interface JwtPayload {
  userId: number;
  email: string;
}

/**
 * Middleware untuk mengekstrak token JWT dan menyimpan userId ke res.locals.userId
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      message: 'Akses ditolak. Token tidak ditemukan di header Authorization.',
    });
    return;
  }

  // Format header Bearer: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      success: false,
      message: 'Format token salah. Gunakan format "Bearer <token>".',
    });
    return;
  }

  const token = parts[1];
  const secretKey: string = JWT_SECRET;

  try {
    const decoded = jwt.verify(token, secretKey) as JwtPayload;

    // Simpan ID pengguna ke dalam res.locals.userId sesuai instruksi
    res.locals.userId = decoded.userId;
    res.locals.user = decoded;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token tidak valid atau sudah kedaluwarsa.',
    });
    return;
  }
  };