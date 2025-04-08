import express from 'express';
import * as authController from '../controllers/authController';
import { authenticateJWT } from '../middlewares/auth';

const router = express.Router();

// Utilizziamo esplicitamente Request e Response da express
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authenticateJWT, authController.logout);
router.get('/me', authenticateJWT, authController.getCurrentUser);

export default router;