import { Request, Response, NextFunction } from 'express';

/**
 * Validasi kelengkapan data registrasi
 */
export const validateRegister = (req: Request, res: Response, next: NextFunction): void => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({
      success: false,
      message: 'Field username, email, dan password wajib diisi!',
    });
    return;
  }

  next();
};

/**
 * Validasi kelengkapan data login
 */
export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      success: false,
      message: 'Email dan password wajib diisi!',
    });
    return;
  }

  next();
};

/**
 * Validasi kelengkapan data pembuatan Todo
 */
export const validateTodo = (req: Request, res: Response, next: NextFunction): void => {
  const { task } = req.body;

  if (!task || typeof task !== 'string' || task.trim() === '') {
    res.status(400).json({
      success: false,
      message: 'Field task tidak boleh kosong!',
    });
    return;
  }

  next();
};