// server/src/server.ts

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

// Load environment variables
dotenv.config();

// Create Prisma client
const prisma = new PrismaClient();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Verifica connessione al database prima di avviare il server
async function startServer() {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    await prisma.$connect();
    logger.info('Database connection successful! ✅');

    // Initialize Socket.io
    const io = configureSocket(server);

    // Middleware
    app.use(cors(corsOptions));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // Make sure uploads directory exists
    const uploadDir = path.join(__dirname, '../uploads');
    app.use('/uploads', express.static(uploadDir));

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/users', authenticateJWT, userRoutes);
    app.use('/api/messages', authenticateJWT, messageRoutes);

    // Health check
    app.get('/health', (_req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        environment: process.env.NODE_ENV || 'development',
        dbConnected: true,
        timestamp: new Date().toISOString()
      });
    });

    // 404 handler
    app.use((_req, res) => {
      res.status(404).json({ message: 'Route not found' });
    });

    // Error handler
    app.use(errorHandler);

    // Set up socket handlers
    setupSocketHandlers(io);

    // Start server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      const env = process.env.NODE_ENV || 'development';
      const boxWidth = 50;
      
      // Crea un box ASCII con le informazioni di avvio
      const divider = '═'.repeat(boxWidth);
      console.log('\n┌' + divider + '┐');
      console.log('│' + ' '.repeat(boxWidth) + '│');
      
      const messages = [
        `🚀 Server running on port ${PORT}`,
        `🌍 Environment: ${env}`,
        `🗄️  Database connected successfully`,
        `🔌 Socket.IO initialized`,
        `📅 ${new Date().toLocaleString()}`
      ];
      
      messages.forEach(msg => {
        const padding = ' '.repeat(Math.max(0, boxWidth - msg.length));
        console.log('│ ' + msg + padding + '│');
      });
      
      console.log('│' + ' '.repeat(boxWidth) + '│');
      console.log('└' + divider + '┘\n');
      
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Environment: ${env}`);
    });
  } catch (error) {
    logger.error('Failed to connect to the database:', error);
    console.error('\n❌ Database connection failed!');
    console.error('Please make sure your database is running and credentials are correct.');
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    // Disconnect Prisma client when done with connection test
    await prisma.$disconnect();
  }
}

// Start the server with database connection check
startServer();

export { app, server };