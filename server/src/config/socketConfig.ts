// server/src/config/socketConfig.ts
//import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { corsOptions } from './corsConfig';
import { logger } from '../utils/logger';
import http from 'http';

//const prisma = new PrismaClient();

export const configureSocket = (server: http.Server) => {
  logger.info('Configuring Socket.io');
  
  const io = new Server(server, {
    cors: corsOptions,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  });
  
  // Log when Socket.io server starts
  logger.info('Socket.io initialized and ready for connections');

  return io;
};