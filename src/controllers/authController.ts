import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, createUser } from '../models/userModel';

const { JWT_SECRET } = require("../config/env");

/**
 * Registrasi User Baru (Password dienkripsi dengan bcrypt)
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    // Cek apakah email sudah terdaftar
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar. Silakan gunakan email lain.',
      });
      return;
    }

    // Enkripsi password menggunakan bcrypt (salt rounds = 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan ke database via userModel (SQL murni)
    const newUserId = await createUser({
  name: username,      // sebelumnya: username,
  email,
  password: hashedPassword,
  });

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil!',
      data: {
        id: newUserId,
        username,
        email,
      },
    });
  } catch (error: any) {
    console.error('Error saat registrasi:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat registrasi.',
    });
  }
};

/**
 * Login User (Cocokkan password dengan bcrypt & terbitkan JWT token)
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Cari user di database berdasarkan email
    const user = await findUserByEmail(email);
    if (!user || !user.password) {
      res.status(401).json({
        success: false,
        message: 'Email atau kata sandi tidak cocok.',
      });
      return;
    }

    // Bandingkan password input dengan password hash menggunakan bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Email atau kata sandi tidak cocok.',
      });
      return;
    }

    // Buat token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login berhasil!',
      token,
      user: {
  id: user.id,
  username: user.name,   // sebelumnya: user.username
  email: user.email,
},
    });
  } catch (error: any) {
    console.error('Error saat login:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat login.',
    });
  }
};