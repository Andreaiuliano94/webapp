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
    // Calcola skip per paginazione
    const skip = (page - 1) * limit;

    // Ottieni conteggio totale dei messaggi
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

    // Ottieni messaggi
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

    // Segna messaggi non letti come letti
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
      })), // Restituisce in ordine crescente con null convertito in undefined
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

    // Controlla se il ricevente esiste
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId }
    });

    if (!receiver) {
      throw new Error('Destinatario non trovato');
    }

    // Crea messaggio
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
  },

  deleteMessage: async (messageId: number, userId: number) => {
    // Verifica che il messaggio esista e appartenga all'utente
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId
      }
    });
    
    if (!message) {
      throw new Error('Messaggio non trovato o non sei autorizzato a eliminarlo');
    }
    
    // Elimina il messaggio
    await prisma.message.delete({
      where: { id: messageId }
    });
    
    return { success: true };
  }
};