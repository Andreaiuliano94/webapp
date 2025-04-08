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
  // Gestisce l'invio di un nuovo messaggio
  socket.on('sendMessage', async (messageData: Message) => {
    try {
      if (!socket.userId) {
        return socket.emit('error', { message: 'Utente non autenticato' });
      }

      // Assicura che l'ID del mittente corrisponda all'utente autenticato
      if (messageData.senderId !== socket.userId) {
        return socket.emit('error', { message: 'ID mittente non autorizzato' });
      }

      // Crea un nuovo messaggio nel database
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

     // Trova il socket ID del destinatario se è online
     const receiverSocketId = onlineUsers.get(messageData.receiverId);

     // Invia il messaggio al mittente e al destinatario
     socket.emit('newMessage', newMessage);
     
     if (receiverSocketId) {
       io.to(receiverSocketId).emit('newMessage', newMessage);
     }
   } catch (error) {
     console.error('Errore invio messaggio:', error);
     socket.emit('error', { message: 'Impossibile inviare il messaggio' });
   }
 });

 // Gestione indicatore di digitazione
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

 // Gestione lettura messaggi
 socket.on('markAsRead', async (data: { senderId: number, timestamp?: string }) => {
   try {
     if (!socket.userId) return;

     // Aggiorna tutti i messaggi non letti dal mittente a questo utente
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

     // Notifica al mittente che i suoi messaggi sono stati letti
     const senderSocketId = onlineUsers.get(data.senderId);
     if (senderSocketId) {
       io.to(senderSocketId).emit('messagesRead', {
         readBy: socket.userId,
         timestamp: data.timestamp || new Date().toISOString()
       });
     }
   } catch (error) {
     console.error('Errore nella marcatura dei messaggi come letti:', error);
   }
 });
};