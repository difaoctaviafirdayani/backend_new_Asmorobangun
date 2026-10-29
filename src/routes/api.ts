import { Router } from 'express';
import { register, login } from '../controllers/authController';
import { getTodos, createTodo } from '../controllers/todoController';
import { validateRegister, validateLogin, validateTodo } from '../middleware/validator';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// RUTE AUTENTIKASI (Public)
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);

// RUTE TODO (Protected via authMiddleware)
router.get('/todos', authMiddleware, getTodos);
router.post('/todos', authMiddleware, validateTodo, createTodo);

export default router;