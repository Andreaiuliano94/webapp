import express from 'express';
import { upload } from '../middlewares/upload';
import * as messageController from '../controllers/messageController';

const router = express.Router();

// Utilizziamo esplicitamente Request e Response da express
router.get('/:userId', (req, res) => messageController.getMessages(req, res));
router.post('/', (req, res) => messageController.sendMessage(req, res));
router.post('/attachment', upload.single('file'), (req, res) => messageController.uploadAttachment(req, res));
router.delete('/:id', (req, res) => messageController.deleteMessage(req, res));
router.delete('/conversation/:userId', (req, res) => messageController.deleteConversation(req, res));

export default router;