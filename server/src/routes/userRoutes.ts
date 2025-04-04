// server/src/routes/userRoutes.ts
import express from 'express';
import { upload } from '../middlewares/upload';
import * as userController from '../controllers/userController';
//import { Request, ParamsDictionary } from 'express-serve-static-core';
//import { ParsedQs } from 'qs';

const router = express.Router();

// Utilizziamo esplicitamente Request e Response da express
router.get('/', (req, res) => userController.getAllUsers(req, res));
router.get('/:id', (req, res) => userController.getUserById(req, res));
router.patch('/profile', (req, res) => userController.updateProfile(req, res));
router.patch('/avatar', upload.single('avatar'), (req, res) => userController.updateAvatar(req, res));

export default router;