// server/src/services/messageService.ts
import { PrismaClient } from '@prisma/client';
import { SendMessageDto, MessagesPaginationResponse } from '../types/message';

const prisma = new PrismaClient();

export const messageService = {
  getMessages: async (
    currentUserId: number,
    otherUserId: number,
    page = 1,
    limit = 50
  ): Promise<MessagesPaginationResponse> => {
    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Get total count of messages
    const totalCount = await prisma.message.count({
      where: {
        OR: [
          {
            senderId: currentUserId,
            receiverId: otherUserId
          },
          {
            senderId: otherUserId,
            receiverId: currentUserId
          }
        ]
      }
    });

    // Get messages
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          {
            senderId: currentUserId,
            receiverId: otherUserId
          },
          {
            senderId: otherUserId,
            receiverId: currentUserId
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
        senderId: otherUserId,
        receiverId: currentUserId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return {
      messages: messages.reverse().map(msg => ({
        ...msg,
        readAt: msg.readAt === null ? undefined : msg.readAt,
        attachmentUrl: msg.attachmentUrl === null ? undefined : msg.attachmentUrl,
        attachmentType: msg.attachmentType === null ? undefined : msg.attachmentType,
        sender: {
          ...msg.sender,
          avatarUrl: msg.sender.avatarUrl === null ? undefined : msg.sender.avatarUrl
        }
      })), // Return in ascending order with null converted to undefined
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    };
  },

  sendMessage: async (currentUserId: number, messageData: SendMessageDto) => {
    const receiverId = typeof messageData.receiverId === 'string' 
      ? parseInt(messageData.receiverId) 
      : messageData.receiverId;

    // Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId }
    });

    if (!receiver) {
      throw new Error('Receiver not found');
    }

    // Create message
    const newMessage = await prisma.message.create({
      data: {
        content: messageData.content,
        senderId: currentUserId,
        receiverId: receiverId,
        attachmentUrl: messageData.attachmentUrl,
        attachmentType: messageData.attachmentType
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

    return { message: newMessage };
  }
};