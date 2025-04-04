// server/src/socket/chatHandlers.ts
import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

interface Message {
  content: string;
  senderId: number;
  receiverId: number;
  attachmentUrl?: string;
  attachmentType?: string;
}

export const setupChatHandlers = (
  io: Server,
  socket: AuthenticatedSocket,
  onlineUsers: Map<number, string>
) => {
  // Handle sending a new message
  socket.on('sendMessage', async (messageData: Message) => {
    try {
      if (!socket.userId) {
        return socket.emit('error', { message: 'User not authenticated' });
      }

      // Ensure sender ID matches authenticated user
      if (messageData.senderId !== socket.userId) {
        return socket.emit('error', { message: 'Unauthorized sender ID' });
      }

      // Create new message in database
      const newMessage = await prisma.message.create({
        data: {
          content: messageData.content,
          senderId: messageData.senderId,
          receiverId: messageData.receiverId,
          attachmentUrl: messageData.attachmentUrl,
          attachmentType: messageData.attachmentType,
        },
        include: {
          sender: {
            select: { id: true, username: true, avatarUrl: true }
          }
        }
      });

      // Find receiver's socket if they're online
      const receiverSocketId = onlineUsers.get(messageData.receiverId);

      // Emit message to sender and receiver
      socket.emit('newMessage', newMessage);
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newMessage', newMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicator
  socket.on('typing', (data: { receiverId: number, isTyping: boolean }) => {
    if (!socket.userId) return;

    const receiverSocketId = onlineUsers.get(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userTyping', {
        userId: socket.userId,
        isTyping: data.isTyping
      });
    }
  });

  // Handle reading messages
  socket.on('markAsRead', async (data: { senderId: number, timestamp?: string }) => {
    try {
      if (!socket.userId) return;

      // Update all unread messages from the sender to this user
      await prisma.message.updateMany({
        where: {
          senderId: data.senderId,
          receiverId: socket.userId,
          isRead: false,
          ...(data.timestamp && { createdAt: { lte: new Date(data.timestamp) } })
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      // Notify the sender that their messages have been read
      const senderSocketId = onlineUsers.get(data.senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('messagesRead', {
          readBy: socket.userId,
          timestamp: data.timestamp || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });
};
