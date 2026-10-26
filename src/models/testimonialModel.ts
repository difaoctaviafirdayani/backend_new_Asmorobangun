import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Testimonial {
  id?: number;
  user_id: string | null;
  name: string;
  message: string;
  created_at?: Date;
}

export interface TestimonialRow extends RowDataPacket, Testimonial {}

/** Semua testimoni milik satu user */
export const getTestimonialsByUserId = async (userId: string): Promise<Testimonial[]> => {
  const query =
    'SELECT id, user_id, name, message, created_at FROM testimonials WHERE user_id = ? ORDER BY id DESC';
  const [rows] = await pool.execute<TestimonialRow[]>(query, [userId]);
  return rows;
};

/** Simpan testimoni baru milik user tertentu */
export const createTestimonial = async (
  userId: string,
  name: string,
  message: string
): Promise<Testimonial> => {
  const query = 'INSERT INTO testimonials (user_id, name, message) VALUES (?, ?, ?)';
  const [result] = await pool.execute<ResultSetHeader>(query, [userId, name, message]);
  return { id: result.insertId, user_id: userId, name, message };
};