import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ottieni messaggi tra l'utente corrente e un altro utente
export const getMessages = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Utente non autenticato' });
    }

    // Calcola skip per paginazione
    const skip = (page - 1) * limit;

    // Ottieni conteggio totale dei messaggi
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

    // Ottieni messaggi
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

    // Segna i messaggi non letti come letti
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
      messages: messages.reverse(), // Restituisci in ordine ascendente
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Errore nel recupero dei messaggi:', error);
    res.status(500).json({ message: 'Errore del server nel recupero dei messaggi' });
  }
};

// Invia un messaggio
export const sendMessage = async (req: Request, res: Response) => {
  const { receiverId, content } = req.body;

  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Utente non autenticato' });
    }

    // Valida input
    if (!receiverId || !content) {
      return res.status(400).json({ message: 'ID destinatario e contenuto sono obbligatori' });
    }

    // Controlla se il destinatario esiste
    const receiver = await prisma.user.findUnique({
      where: { id: parseInt(receiverId) }
    });

    if (!receiver) {
      return res.status(404).json({ message: 'Destinatario non trovato' });
    }

    // Crea messaggio
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
      message: 'Messaggio inviato con successo',
      data: newMessage
    });
  } catch (error) {
    console.error('Errore invio messaggio:', error);
    res.status(500).json({ message: 'Errore del server nell\'invio del messaggio' });
  }
};

// Carica allegato
export const uploadAttachment = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Utente non autenticato' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Nessun file caricato' });
    }

    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ message: 'ID destinatario obbligatorio' });
    }

    const attachmentUrl = `/uploads/${req.file.filename}`;
    const attachmentType = req.file.mimetype;

    res.status(200).json({
      message: 'File caricato con successo',
      data: {
        filename: req.file.originalname,
        attachmentUrl,
        attachmentType
      }
    });
  } catch (error) {
    console.error('Errore caricamento allegato:', error);
    res.status(500).json({ message: 'Errore del server nel caricamento del file' });
  }
};


// Aggiungi questa nuova funzione in fondo al file, prima dell'ultima parentesi di chiusura
export const deleteMessage = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Utente non autenticato' });
    }
    
    // Trova il messaggio per verificare che l'utente corrente sia il mittente
    const message = await prisma.message.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!message) {
      return res.status(404).json({ message: 'Messaggio non trovato' });
    }
    
    // Verifica che l'utente corrente sia il mittente del messaggio
    if (message.senderId !== req.user.id) {
      return res.status(403).json({ message: 'Puoi eliminare solo i tuoi messaggi' });
    }
    
    // Elimina il messaggio
    await prisma.message.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(200).json({ message: 'Messaggio eliminato con successo' });
  } catch (error) {
    console.error('Errore eliminazione messaggio:', error);
    res.status(500).json({ message: 'Errore del server nell\'eliminazione del messaggio' });
  }
};
export const deleteConversation = async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Utente non autenticato' });
    }

    // Elimina tutti i messaggi tra l'utente corrente e l'utente specificato
    await prisma.message.deleteMany({
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

    res.status(200).json({ message: 'Conversazione eliminata con successo' });
  } catch (error) {
    console.error('Errore eliminazione conversazione:', error);
    res.status(500).json({ message: 'Errore del server nell\'eliminazione della conversazione' });
  }
};