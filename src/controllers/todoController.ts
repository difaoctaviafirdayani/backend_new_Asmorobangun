import { Request, Response } from 'express';
import { getTodosByUserId, createTodo as insertTodo } from '../models/todoModel';

/**
 * Mengambil daftar Todo milik user yang sedang terautentikasi
 */
export const getTodos = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ambil userId dari res.locals yang disimpan oleh authMiddleware
    const userId = res.locals.userId;

    const todos = await getTodosByUserId(String(userId));

    res.status(200).json({
      success: true,
      message: 'Berhasil mengambil daftar todo.',
      data: todos,
    });
  } catch (error: any) {
    console.error('Error saat get todos:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data todo.',
    });
  }
};

/**
 * Menyimpan Todo baru milik user yang sedang terautentikasi
 */
export const createTodo = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ambil userId dari res.locals
    const userId = res.locals.userId;
    const { task } = req.body;

    const newTodo = await insertTodo(String(userId), task);

    res.status(201).json({
      success: true,
      message: 'Berhasil membuat todo baru.',
      data: newTodo,
    });
  } catch (error: any) {
    console.error('Error saat create todo:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menyimpan todo baru.',
    });
  }
};