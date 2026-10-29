import { Router } from 'express';
import { getTodos, createTodo } from '../controllers/todoController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateTodo } from '../middleware/validator';

const router = Router();

router.get('/', authMiddleware, getTodos);
router.post('/', authMiddleware, validateTodo, createTodo);

export default router;