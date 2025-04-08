import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Interfaccia personalizzata per socket con utente autenticato
interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
  activeChat?: number | null; // Tiene traccia della chat attiva per evitare loop
}

// Mappa per tenere traccia degli utenti online e dei loro ID socket
const onlineUsers = new Map<number, string>();
// Mappa per tenere traccia dei messaggi non letti per utente
const unreadMessages = new Map<number, Map<number, number>>();

export const setupSocketHandlers = (io: Server) => {
  // Middleware di autenticazione
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        logger.warn('Tentativo di connessione socket senza token');
        return next(new Error('Errore di autenticazione: Token mancante'));
      }

      // Verifica token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'fallback_secret'
      ) as { id: number; email: string };

      // Controlla se l'utente esiste
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true }
      });

      if (!user) {
        logger.warn(`Autenticazione socket fallita: Utente ID ${decoded.id} non trovato`);
        return next(new Error('Errore di autenticazione: Utente non trovato'));
      }

      // Allega informazioni utente al socket
      socket.userId = user.id;
      socket.username = user.username;
      socket.activeChat = null; // Inizializza senza chat attiva
      logger.info(`Socket autenticato: Utente ${user.username} (${user.id})`);
      next();
    } catch (error) {
      logger.error('Errore autenticazione socket:', error);
      next(new Error('Errore di autenticazione: Token non valido'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`Socket connesso: ${socket.id}`);

    if (socket.userId) {
      // Aggiorna stato utente a online nel database
      prisma.user.update({
        where: { id: socket.userId },
        data: { status: 'ONLINE', lastSeen: new Date() }
      }).then(() => {
        logger.info(`Utente ${socket.username} (${socket.userId}) è ora ONLINE`);
      }).catch(err => {
        logger.error('Impossibile aggiornare lo stato dell\'utente:', err);
      });

      // Aggiungi utente alla mappa degli utenti online
      onlineUsers.set(socket.userId, socket.id);

      // Inizializza la mappa dei messaggi non letti per questo utente se necessario
      if (!unreadMessages.has(socket.userId)) {
        unreadMessages.set(socket.userId, new Map<number, number>());
      }

      // Trasmetti la lista aggiornata degli utenti online a tutti i client
      const onlineUserIds = Array.from(onlineUsers.keys());
      logger.debug(`Trasmissione utenti online: ${onlineUserIds.join(', ')}`);
      io.emit('onlineUsers', onlineUserIds);
    }

    // Gestione invio nuovo messaggio - MODIFICATA PER RISOLVERE IL PROBLEMA DEI DUPLICATI
    socket.on('sendMessage', async (messageData: {
      content: string;
      senderId: number;
      receiverId: number;
      attachmentUrl?: string;
      attachmentType?: string;
    }) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Utente non autenticato' });
          return;
        }

        // Assicura che l'ID del mittente corrisponda all'utente autenticato
        if (messageData.senderId !== socket.userId) {
          socket.emit('error', { message: 'ID mittente non autorizzato' });
          return;
        }

        logger.info(`Nuovo messaggio da ${socket.username} a utente ${messageData.receiverId}`);

        // Crea nuovo messaggio nel database - Lo facciamo una sola volta
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

        // Trova il socket del destinatario se è online
        const receiverSocketId = onlineUsers.get(messageData.receiverId);

        // Invia il messaggio al mittente
        socket.emit('newMessage', newMessage);
        
        // Invia il messaggio al destinatario se è online
        if (receiverSocketId) {
          const receiverSocket = io.sockets.sockets.get(receiverSocketId) as AuthenticatedSocket;
          if (receiverSocket) {
            // Controlla se il destinatario ha questa chat attiva
            const isActiveChat = receiverSocket.activeChat === messageData.senderId;
            
            io.to(receiverSocketId).emit('newMessage', newMessage);
            
            // Aggiorna il conteggio dei messaggi non letti solo se il destinatario 
            // non ha questa chat attiva
            if (!isActiveChat) {
              // Ottieni o inizializza la mappa dei messaggi non letti del destinatario
              let receiverUnreadMap = unreadMessages.get(messageData.receiverId);
              if (!receiverUnreadMap) {
                receiverUnreadMap = new Map<number, number>();
                unreadMessages.set(messageData.receiverId, receiverUnreadMap);
              }
              
              // Incrementa il conteggio non letto da questo mittente
              const currentCount = receiverUnreadMap.get(messageData.senderId) || 0;
              receiverUnreadMap.set(messageData.senderId, currentCount + 1);
              
              // Notifica al destinatario l'aggiornamento del conteggio non letto
              io.to(receiverSocketId).emit('unreadUpdate', {
                from: messageData.senderId, 
                count: currentCount + 1
              });
            }
          }
        } else {
          // Il destinatario è offline, incrementa il conteggio dei messaggi non letti
          let receiverUnreadMap = unreadMessages.get(messageData.receiverId);
          if (!receiverUnreadMap) {
            receiverUnreadMap = new Map<number, number>();
            unreadMessages.set(messageData.receiverId, receiverUnreadMap);
          }
          
          const currentCount = receiverUnreadMap.get(messageData.senderId) || 0;
          receiverUnreadMap.set(messageData.senderId, currentCount + 1);
        }
      } catch (error) {
        logger.error('Errore invio messaggio:', error);
        socket.emit('error', { message: 'Impossibile inviare il messaggio' });
      }
    });

    // Gestione evento apertura chat - quando un utente apre una chat con un altro utente
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
        
        logger.info(`Utente ${socket.userId} ha aperto la chat con l'utente ${data.withUserId}`);
        
        // Segna i messaggi come letti
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
        
        // Resetta il conteggio non letto per questo mittente
        const userUnreadMap = unreadMessages.get(socket.userId);
        if (userUnreadMap) {
          userUnreadMap.set(data.withUserId, 0);
          
          // Emetti verso se stesso per aggiornare l'interfaccia
          socket.emit('unreadUpdate', {
            from: data.withUserId,
            count: 0
          });
          
          // Notifica al mittente che i messaggi sono stati letti
          const senderSocketId = onlineUsers.get(data.withUserId);
          if (senderSocketId) {
            io.to(senderSocketId).emit('messagesRead', {
              by: socket.userId,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        logger.error('Errore nella gestione dell\'apertura chat:', error);
      }
    });

    // Gestione marcatura messaggi come letti
    socket.on('markAsRead', async (data: { senderId: number }) => {
      try {
        if (!socket.userId) return;
        
        logger.info(`Utente ${socket.userId} sta segnando i messaggi da ${data.senderId} come letti`);
        
        // Aggiorna tutti i messaggi non letti dal mittente a questo utente
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
        
        // Resetta il conteggio non letto per questo mittente
        const userUnreadMap = unreadMessages.get(socket.userId);
        if (userUnreadMap) {
          userUnreadMap.set(data.senderId, 0);
          
          // Emetti verso se stesso per aggiornare l'interfaccia
          socket.emit('unreadUpdate', {
            from: data.senderId,
            count: 0
          });
        }
        
        // Notifica al mittente che i suoi messaggi sono stati letti
        const senderSocketId = onlineUsers.get(data.senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('messagesRead', {
            by: socket.userId,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.error('Errore nella marcatura dei messaggi come letti:', error);
      }
    });

    // Ottieni conteggio messaggi non letti
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
        logger.error('Errore nel recupero dei conteggi non letti:', error);
      }
    });

    // Gestione richieste videochiamata
    socket.on('callUser', (data: { to: number; signal?: any }) => {
      if (!socket.userId || !socket.username) return;

      // Assicura che l'ID del chiamante corrisponda all'utente autenticato
      if (!socket.userId) {
        return socket.emit('error', { message: 'Chiamante non autorizzato' });
      }

      const receiverSocketId = onlineUsers.get(data.to);
      if (receiverSocketId) {
        logger.info(`Richiesta chiamata da ${socket.username} all'utente ${data.to}`);
        io.to(receiverSocketId).emit('incomingCall', {
          from: socket.userId,
          username: socket.username,
          signal: data.signal
        });
      } else {
        // L'utente è offline, notifica al chiamante
        logger.debug(`Chiamata fallita: L'utente ${data.to} è offline`);
        socket.emit('callRejected', {
          userId: data.to,
          reason: 'L\'utente è offline'
        });
      }
    });

    // Gestione accettazione chiamata
    socket.on('acceptCall', (data: { to: number; signal?: any }) => {
      if (!socket.userId) return;
      
      const callerSocketId = onlineUsers.get(data.to);
      if (callerSocketId) {
        logger.info(`Chiamata accettata da ${socket.username} per l'utente ${data.to}`);
        io.to(callerSocketId).emit('callAccepted', {
          from: socket.userId,
          signal: data.signal
        });
      }
    });

    // Gestione rifiuto chiamata
    socket.on('rejectCall', (data: { to: number }) => {
      if (!socket.userId) return;
      
      const callerSocketId = onlineUsers.get(data.to);
      if (callerSocketId) {
        logger.info(`Chiamata rifiutata da ${socket.username} per l'utente ${data.to}`);
        io.to(callerSocketId).emit('callRejected', {
          userId: socket.userId,
          reason: 'La chiamata è stata rifiutata'
        });
      }
    });

    // Gestione fine chiamata
    socket.on('endCall', (data: { to: number }) => {
      if (!socket.userId) return;
      
      const otherSocketId = onlineUsers.get(data.to);
      if (otherSocketId) {
        logger.info(`Chiamata terminata da ${socket.username} con l'utente ${data.to}`);
        io.to(otherSocketId).emit('callEnded', {
          userId: socket.userId
        });
      }
    });

    // Gestione candidati ICE
    socket.on('ice-candidate', (data: { to: number; candidate: any }) => {
      if (!socket.userId) return;
      
      const otherSocketId = onlineUsers.get(data.to);
      if (otherSocketId) {
        logger.debug(`Candidato ICE da ${socket.userId} a ${data.to}`);
        io.to(otherSocketId).emit('ice-candidate', {
          from: socket.userId,
          candidate: data.candidate
        });
      }
    });
    
    // Attività utente/ping per mantenere lo stato aggiornato
    socket.on('userActivity', () => {
      if (socket.userId) {
        // Aggiorna solo lastSeen, lo stato è già ONLINE
        prisma.user.update({
          where: { id: socket.userId },
          data: { lastSeen: new Date() }
        }).catch(err => {
          logger.error('Impossibile aggiornare lastSeen:', err);
        });
      }
    });
    
    // Gestione disconnessione
    socket.on('disconnect', async () => {
      logger.info(`Socket disconnesso: ${socket.id}`);
    
      if (socket.userId) {
        // Aggiorna stato utente a offline
        await prisma.user.update({
          where: { id: socket.userId },
          data: { status: 'OFFLINE', lastSeen: new Date() }
        }).catch(err => {
          logger.error('Impossibile aggiornare lo stato dell\'utente:', err);
        });
    
        // Rimuovi utente dalla mappa degli utenti online
        onlineUsers.delete(socket.userId);
    
        // Trasmetti lista aggiornata degli utenti online a tutti i client
        io.emit('onlineUsers', Array.from(onlineUsers.keys()));
        logger.info(`Utente ${socket.username} (${socket.userId}) è ora OFFLINE`);
      }
    });
  });
};