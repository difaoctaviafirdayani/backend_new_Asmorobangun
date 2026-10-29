import pool from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Todo {
  id: number;
  user_id: string;
  task: string;
}

export const getTodosByUserId = async (userId: string): Promise<Todo[]> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM todos WHERE user_id = ? ORDER BY id DESC',
    [userId]
  );
  return rows as Todo[];
};

export const createTodo = async (userId: string, task: string): Promise<Todo> => {
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO todos (user_id, task) VALUES (?, ?)',
    [userId, task]
  );
  return { id: result.insertId, user_id: userId, task };
};