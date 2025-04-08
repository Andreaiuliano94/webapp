import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import { errorHandler } from './middlewares/error';
import { corsOptions } from './config/corsConfig';
import { configureSocket } from './config/socketConfig';
import { setupSocketHandlers } from './socket';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import messageRoutes from './routes/messageRoutes';
import { authenticateJWT } from './middlewares/auth';
import { logger } from './utils/logger';
import { PrismaClient } from '@prisma/client';

// Carica variabili d'ambiente
dotenv.config();

// Crea client Prisma
const prisma = new PrismaClient();

// Inizializza app Express
const app = express();
const server = http.createServer(app);

// Verifica connessione al database prima di avviare il server
async function startServer() {
  try {
    // Test connessione database
    logger.info('Verifica connessione al database...');
    await prisma.$connect();
    logger.info('Connessione al database riuscita! ✅');

    // Inizializza Socket.io
    const io = configureSocket(server);
    // Middleware
    app.use(cors(corsOptions));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // Assicurati che la directory uploads esista
    const uploadDir = path.join(__dirname, '../uploads');
    app.use('/uploads', express.static(uploadDir));

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/users', authenticateJWT, userRoutes);
    app.use('/api/messages', authenticateJWT, messageRoutes);

    // Controllo salute
    app.get('/health', (_req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        environment: process.env.NODE_ENV || 'development',
        dbConnected: true,
        timestamp: new Date().toISOString()
      });
    });

    // Gestore 404
    app.use((_req, res) => {
      res.status(404).json({ message: 'Percorso non trovato' });
    });

    // Gestore errori
    app.use(errorHandler);

    // Configura gestori socket
    setupSocketHandlers(io);

    // Avvia server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      const env = process.env.NODE_ENV || 'development';
      const boxWidth = 50;
      
      // Crea un box ASCII con le informazioni di avvio
      const divider = '═'.repeat(boxWidth);
      console.log('\n┌' + divider + '┐');
      console.log('│' + ' '.repeat(boxWidth) + '│');
      
      const messages = [
        `🚀 Server in esecuzione sulla porta ${PORT}`,
        `🌍 Ambiente: ${env}`,
        `🗄️  Database connesso con successo`,
        `🔌 Socket.IO inizializzato`,
        `📅 ${new Date().toLocaleString()}`
      ];
      
      messages.forEach(msg => {
        const padding = ' '.repeat(Math.max(0, boxWidth - msg.length));
        console.log('│ ' + msg + padding + '│');
      });
      
      console.log('│' + ' '.repeat(boxWidth) + '│');
      console.log('└' + divider + '┘\n');
      
      logger.info(`Il server è in esecuzione sulla porta ${PORT}`);
      logger.info(`Ambiente: ${env}`);
    });
  } catch (error) {
    logger.error('Impossibile connettersi al database:', error);
    console.error('\n❌ Connessione al database fallita!');
    console.error('Assicurati che il database sia in esecuzione e le credenziali siano corrette.');
    console.error('Dettagli errore:', error);
    process.exit(1);
  } finally {
    // Disconnetti client Prisma dopo aver terminato il test di connessione
    await prisma.$disconnect();
  }
}

// Avvia il server con controllo di connessione al database
startServer();

export { app, server };