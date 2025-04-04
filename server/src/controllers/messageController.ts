// server/src/controllers/messageController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get messages between current user and another user
export const getMessages = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Get total count of messages
    const totalCount = await prisma.message.count({
      where: {
        OR: [
          {
            senderId: req.user.id,
            receiverId: parseInt(userId)
          },
          {
            senderId: parseInt(userId),
            receiverId: req.user.id
          }
        ]
      }
    });

    // Get messages
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          {
            senderId: req.user.id,
            receiverId: parseInt(userId)
          },
          {
            senderId: parseInt(userId),
            receiverId: req.user.id
          }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Mark unread messages as read
    await prisma.message.updateMany({
      where: {
        senderId: parseInt(userId),
        receiverId: req.user.id,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.status(200).json({
      messages: messages.reverse(), // Return in ascending order
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error getting messages' });
  }
};

// Send a message
export const sendMessage = async (req: Request, res: Response) => {
  const { receiverId, content } = req.body;

  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Validate input
    if (!receiverId || !content) {
      return res.status(400).json({ message: 'Receiver ID and content are required' });
    }

    // Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: parseInt(receiverId) }
    });

    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Create message
    const newMessage = await prisma.message.create({
      data: {
        content,
        senderId: req.user.id,
        receiverId: parseInt(receiverId)
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error sending message' });
  }
};

// Upload attachment
export const uploadAttachment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver ID is required' });
    }

    const attachmentUrl = `/uploads/${req.file.filename}`;
    const attachmentType = req.file.mimetype;

    res.status(200).json({
      message: 'File uploaded successfully',
      data: {
        filename: req.file.originalname,
        attachmentUrl,
        attachmentType
      }
    });
  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ message: 'Server error uploading file' });
  }
};