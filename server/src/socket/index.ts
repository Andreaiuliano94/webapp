// server/src/socket/index.ts
import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Custom interface for socket with authenticated user
interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
  activeChat?: number | null; // Tieni traccia della chat attiva per evitare loop
}

// Map to keep track of online users and their socket IDs
const onlineUsers = new Map<number, string>();
// Map to keep track of unread messages count per user
const unreadMessages = new Map<number, Map<number, number>>();

export const setupSocketHandlers = (io: Server) => {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        logger.warn('Socket connection attempt without token');
        return next(new Error('Authentication error: Token missing'));
      }

      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'fallback_secret'
      ) as { id: number; email: string };

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true }
      });

      if (!user) {
        logger.warn(`Socket auth failed: User ID ${decoded.id} not found`);
        return next(new Error('Authentication error: User not found'));
      }

      // Attach user info to socket
      socket.userId = user.id;
      socket.username = user.username;
      socket.activeChat = null; // Inizializza senza chat attiva
      logger.info(`Socket authenticated: User ${user.username} (${user.id})`);
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`Socket connected: ${socket.id}`);

    if (socket.userId) {
      // Update user status to online in database
      prisma.user.update({
        where: { id: socket.userId },
        data: { status: 'ONLINE', lastSeen: new Date() }
      }).then(() => {
        logger.info(`User ${socket.username} (${socket.userId}) is now ONLINE`);
      }).catch(err => {
        logger.error('Failed to update user status:', err);
      });

      // Add user to online users map
      onlineUsers.set(socket.userId, socket.id);

      // Initialize unread messages map for this user if needed
      if (!unreadMessages.has(socket.userId)) {
        unreadMessages.set(socket.userId, new Map<number, number>());
      }

      // Broadcast updated online users list to all clients
      const onlineUserIds = Array.from(onlineUsers.keys());
      logger.debug(`Broadcasting online users: ${onlineUserIds.join(', ')}`);
      io.emit('onlineUsers', onlineUserIds);
    }

    // Handle sending a new message - MODIFICATA PER RISOLVERE IL PROBLEMA DEI DUPLICATI
    socket.on('sendMessage', async (messageData: {
      content: string;
      senderId: number;
      receiverId: number;
      attachmentUrl?: string;
      attachmentType?: string;
    }) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        // Ensure sender ID matches authenticated user
        if (messageData.senderId !== socket.userId) {
          socket.emit('error', { message: 'Unauthorized sender ID' });
          return;
        }

        logger.info(`New message from ${socket.username} to user ${messageData.receiverId}`);

        // Create new message in database - Lo facciamo una sola volta
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

        // Emit message to sender
        socket.emit('newMessage', newMessage);
        
        // Emit message to receiver if online
        if (receiverSocketId) {
          const receiverSocket = io.sockets.sockets.get(receiverSocketId) as AuthenticatedSocket;
          if (receiverSocket) {
            // Controlla se il ricevente ha questa chat attiva
            const isActiveChat = receiverSocket.activeChat === messageData.senderId;
            
            io.to(receiverSocketId).emit('newMessage', newMessage);
            
            // Aggiorna il conteggio dei messaggi non letti solo se il ricevente 
            // non ha questa chat attiva
            if (!isActiveChat) {
              // Get or initialize receiver's unread messages map
              let receiverUnreadMap = unreadMessages.get(messageData.receiverId);
              if (!receiverUnreadMap) {
                receiverUnreadMap = new Map<number, number>();
                unreadMessages.set(messageData.receiverId, receiverUnreadMap);
              }
              
              // Increment unread count from this sender
              const currentCount = receiverUnreadMap.get(messageData.senderId) || 0;
              receiverUnreadMap.set(messageData.senderId, currentCount + 1);
              
              // Notify receiver of unread count update
              io.to(receiverSocketId).emit('unreadUpdate', {
                from: messageData.senderId, 
                count: currentCount + 1
              });
            }
          }
        } else {
          // Il ricevente è offline, incrementa il conteggio dei messaggi non letti
          let receiverUnreadMap = unreadMessages.get(messageData.receiverId);
          if (!receiverUnreadMap) {
            receiverUnreadMap = new Map<number, number>();
            unreadMessages.set(messageData.receiverId, receiverUnreadMap);
          }
          
          const currentCount = receiverUnreadMap.get(messageData.senderId) || 0;
          receiverUnreadMap.set(messageData.senderId, currentCount + 1);
        }
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle chat open event - when a user opens a chat with another user
    socket.on('chat_open', async (data: { userId: number, withUserId: number }) => {
      try {
        if (!socket.userId || data.userId !== socket.userId) {
          return;
        }
        
        // Evita loop controllando se questa chat è già attiva
        if (socket.activeChat === data.withUserId) {
          return;
        }
        
        // Aggiorna la chat attiva
        socket.activeChat = data.withUserId;
        
        logger.info(`User ${socket.userId} opened chat with user ${data.withUserId}`);
        
        // Mark messages as read
        await prisma.message.updateMany({
          where: {
            senderId: data.withUserId,
            receiverId: socket.userId,
            isRead: false
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });
        
        // Reset unread count for this sender
        const userUnreadMap = unreadMessages.get(socket.userId);
        if (userUnreadMap) {
          userUnreadMap.set(data.withUserId, 0);
          
          // Emit to self to update UI
          socket.emit('unreadUpdate', {
            from: data.withUserId,
            count: 0
          });
          
          // Notify sender that messages were read
          const senderSocketId = onlineUsers.get(data.withUserId);
          if (senderSocketId) {
            io.to(senderSocketId).emit('messagesRead', {
              by: socket.userId,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        logger.error('Error handling chat open:', error);
      }
    });

    // Handle mark messages as read
    socket.on('markAsRead', async (data: { senderId: number }) => {
      try {
        if (!socket.userId) return;
        
        logger.info(`User ${socket.userId} marking messages from user ${data.senderId} as read`);
        
        // Update all unread messages from the sender to this user
        await prisma.message.updateMany({
          where: {
            senderId: data.senderId,
            receiverId: socket.userId,
            isRead: false
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });
        
        // Reset unread count for this sender
        const userUnreadMap = unreadMessages.get(socket.userId);
        if (userUnreadMap) {
          userUnreadMap.set(data.senderId, 0);
          
          // Emit to self to update UI
          socket.emit('unreadUpdate', {
            from: data.senderId,
            count: 0
          });
        }
        
        // Notify the sender that their messages have been read
        const senderSocketId = onlineUsers.get(data.senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('messagesRead', {
            by: socket.userId,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.error('Error marking messages as read:', error);
      }
    });

    // Get unread messages count
    socket.on('getUnreadCounts', async () => {
      try {
        if (!socket.userId) return;
        
        // Aggiorniamo le unread counts dal database
        const unreadMessagesFromDB = await prisma.message.groupBy({
          by: ['senderId'],
          where: {
            receiverId: socket.userId,
            isRead: false
          },
          _count: {
            id: true
          }
        });

        // Aggiorniamo la mappa locale con i dati dal database
        const userUnreadMap = unreadMessages.get(socket.userId) || new Map<number, number>();
        unreadMessagesFromDB.forEach(item => {
          userUnreadMap.set(item.senderId, item._count.id);
        });
        unreadMessages.set(socket.userId, userUnreadMap);
        
        // Convertiamo la mappa in un oggetto per inviarla via socket
        const unreadCounts: Record<number, number> = {};
        userUnreadMap.forEach((count, senderId) => {
          unreadCounts[senderId] = count;
        });
        
        socket.emit('unreadCounts', unreadCounts);
      } catch (error) {
        logger.error('Error getting unread counts:', error);
      }
    });

    // Handle video call requests
    socket.on('callUser', (data: { to: number; signal?: any }) => {
      if (!socket.userId || !socket.username) return;

      // Ensure caller ID matches authenticated user
      if (!socket.userId) {
        return socket.emit('error', { message: 'Unauthorized caller' });
      }

      const receiverSocketId = onlineUsers.get(data.to);
      if (receiverSocketId) {
        logger.info(`Call request from ${socket.username} to user ${data.to}`);
        io.to(receiverSocketId).emit('incomingCall', {
          from: socket.userId,
          username: socket.username,
          signal: data.signal
        });
      } else {
        // User is offline, notify caller
        logger.debug(`Call failed: User ${data.to} is offline`);
        socket.emit('callRejected', {
          userId: data.to,
          reason: 'User is offline'
        });
      }
    });

    // Handle accepting a call
    socket.on('acceptCall', (data: { to: number; signal?: any }) => {
      if (!socket.userId) return;
      
      const callerSocketId = onlineUsers.get(data.to);
      if (callerSocketId) {
        logger.info(`Call accepted by ${socket.username} for user ${data.to}`);
        io.to(callerSocketId).emit('callAccepted', {
          from: socket.userId,
          signal: data.signal
        });
      }
    });

    // Handle rejecting a call
    socket.on('rejectCall', (data: { to: number }) => {
      if (!socket.userId) return;
      
      const callerSocketId = onlineUsers.get(data.to);
      if (callerSocketId) {
        logger.info(`Call rejected by ${socket.username} for user ${data.to}`);
        io.to(callerSocketId).emit('callRejected', {
          userId: socket.userId,
          reason: 'Call was rejected'
        });
      }
    });

    // Handle ending a call
    socket.on('endCall', (data: { to: number }) => {
      if (!socket.userId) return;
      
      const otherSocketId = onlineUsers.get(data.to);
      if (otherSocketId) {
        logger.info(`Call ended by ${socket.username} with user ${data.to}`);
        io.to(otherSocketId).emit('callEnded', {
          userId: socket.userId
        });
      }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (data: { to: number; candidate: any }) => {
      if (!socket.userId) return;
      
      const otherSocketId = onlineUsers.get(data.to);
      if (otherSocketId) {
        logger.debug(`ICE candidate from ${socket.userId} to ${data.to}`);
        io.to(otherSocketId).emit('ice-candidate', {
          from: socket.userId,
          candidate: data.candidate
        });
      }
    });
    
    // User activity/ping to keep status updated
    socket.on('userActivity', () => {
      if (socket.userId) {
        // Just update lastSeen, status is already ONLINE
        prisma.user.update({
          where: { id: socket.userId },
          data: { lastSeen: new Date() }
        }).catch(err => {
          logger.error('Failed to update last seen:', err);
        });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    
      if (socket.userId) {
        // Update user status to offline
        await prisma.user.update({
          where: { id: socket.userId },
          data: { status: 'OFFLINE', lastSeen: new Date() }
        }).catch(err => {
          logger.error('Failed to update user status:', err);
        });
    
        // Remove user from online users map
        onlineUsers.delete(socket.userId);
    
        // Broadcast updated online users list to all clients
        io.emit('onlineUsers', Array.from(onlineUsers.keys()));
        logger.info(`User ${socket.username} (${socket.userId}) is now OFFLINE`);
      }
    });
  });
};