import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ottieni tutti gli utenti
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Utente non autenticato' });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id } // Escludi utente corrente
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        lastSeen: true
      },
      orderBy: {
        username: 'asc'
      }
    });

    res.status(200).json({ users });
  } catch (error) {
    console.error('Errore nel recupero di tutti gli utenti:', error);
    res.status(500).json({ message: 'Errore del server nel recupero degli utenti' });
  }
};

// Ottieni utente per ID
export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Utente non autenticato' });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        lastSeen: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('Errore nel recupero dell\'utente per ID:', error);
    res.status(500).json({ message: 'Errore del server nel recupero dell\'utente' });
  }
};

// Aggiorna profilo utente
export const updateProfile = async (req: Request, res: Response) => {
  const { displayName, bio } = req.body;

  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Utente non autenticato' });
    }

    // Aggiorna utente
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        displayName,
        bio
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        lastSeen: true
      }
    });

    res.status(200).json({
      message: 'Profilo aggiornato con successo',
      user: updatedUser
    });
  } catch (error) {
    console.error('Errore aggiornamento profilo:', error);
    res.status(500).json({ message: 'Errore del server nell\'aggiornamento del profilo' });
  }
};

// Aggiorna avatar
export const updateAvatar = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Utente non autenticato' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Nessun file immagine fornito' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;

    // Aggiorna utente
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl },
      select: {
        id: true,
        username: true,
        avatarUrl: true
      }
    });

    res.status(200).json({
      message: 'Avatar aggiornato con successo',
      user: updatedUser
    });
  } catch (error) {
    console.error('Errore aggiornamento avatar:', error);
    res.status(500).json({ message: 'Errore del server nell\'aggiornamento dell\'avatar' });
  }
};