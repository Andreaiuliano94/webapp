
//import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { corsOptions } from './corsConfig';
import { logger } from '../utils/logger';
import http from 'http';

//const prisma = new PrismaClient();

export const configureSocket = (server: http.Server) => {
  logger.info('Configurazione Socket.io');
  
  const io = new Server(server, {
    cors: corsOptions,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minuti
      skipMiddlewares: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  });
  
  // Log quando il server Socket.io inizia
  logger.info('Socket.io inizializzato e pronto per le connessioni');

  return io;
};