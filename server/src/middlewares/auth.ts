import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DecodedToken {
  id: number;
  email: string;
  iat?: number;
  exp?: number;
}

// Estende l'interfaccia Request di Express per includere la proprietà user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
      };
    }
  }
}

export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Ottieni token dall'header di autorizzazione o dai cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1] || req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'Nessun token fornito' });
    }

    // Verifica token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret'
    ) as DecodedToken;

    // Controlla se l'utente esiste
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true }
    });

    if (!user) {
      return res.status(401).json({ message: 'Utente non trovato' });
    }

    // Allega utente alla richiesta
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token non valido' });
  }
};