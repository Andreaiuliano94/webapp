import { io, Socket } from 'socket.io-client';
import { Message } from '../types/message';

let socket: Socket;

export const initializeSocket = (token: string): Socket => {
  if (socket) {
    console.log('Disconnessione del socket esistente prima di crearne uno nuovo');
    socket.disconnect();
  }

  console.log('Inizializzazione connessione socket con token');
  
  // Per lo sviluppo utilizzando il proxy
  socket = io({
    auth: { token },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    forceNew: true, // Forza una nuova connessione
    autoConnect: true
  });

  socket.on('connect', () => {
    console.log(`Socket connesso con successo con ID: ${socket.id}`);
    
    // Imposta un ping regolare per mantenere aggiornato lo stato online dell'utente
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('userActivity');
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Ogni 30 secondi
    
    // Cancella intervallo quando il socket si disconnette
    socket.on('disconnect', () => {
      clearInterval(pingInterval);
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnesso. Motivo: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error('Errore connessione socket:', error);
  });

  socket.on('error', (error) => {
    console.error('Errore socket dal server:', error);
  });

  // Debug per eventi utenti online
  socket.on('onlineUsers', (userIds) => {
    console.log('Utenti online aggiornati:', userIds);
  });

  return socket;
};

export const getSocket = (): Socket | null => {
  if (!socket) {
    console.warn('Socket non inizializzato. Chiama initializeSocket prima.');
    return null;
  }
  
  if (!socket.connected) {
    console.warn('Il socket esiste ma non è connesso. Stato attuale:', socket.connected ? 'connesso' : 'disconnesso');
  }
  
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    console.log('Disconnessione manuale del socket');
    socket.disconnect();
  } else {
    console.log('Nessun socket da disconnettere');
  }
};

export const sendMessage = (
  message: { content: string; receiverId: number },
  callback?: (message: Message) => void
): void => {
  if (!socket || !socket.connected) {
    console.warn(`Socket non inizializzato o non connesso. Stato connessione: ${socket?.connected}`);
    return;
  }
  
  console.log(`Invio messaggio all'utente ${message.receiverId}: ${message.content.substring(0, 20)}...`);
  socket.emit('sendMessage', message, callback);
};

export const startTyping = (receiverId: number): void => {
  if (!socket || !socket.connected) return;
  socket.emit('typing', { receiverId, isTyping: true });
};

export const stopTyping = (receiverId: number): void => {
  if (!socket || !socket.connected) return;
  socket.emit('typing', { receiverId, isTyping: false });
};

export const markMessagesAsRead = (senderId: number): void => {
  if (!socket || !socket.connected) return;
  console.log(`Marcatura messaggi dall'utente ${senderId} come letti`);
  socket.emit('markAsRead', { senderId });
};

export const callUser = (to: number, signal?: any): void => {
  if (!socket || !socket.connected) {
    console.warn('Impossibile iniziare chiamata: Socket non connesso');
    return;
  }
  
  console.log(`Avvio chiamata all'utente ${to}`);
  socket.emit('callUser', { to, signal });
};

export const acceptCall = (to: number, signal?: any): void => {
  if (!socket || !socket.connected) return;
  console.log(`Accettazione chiamata dall'utente ${to}`);
  socket.emit('acceptCall', { to, signal });
};

export const rejectCall = (to: number): void => {
  if (!socket || !socket.connected) return;
  console.log(`Rifiuto chiamata dall'utente ${to}`);
  socket.emit('rejectCall', { to });
};

export const endCall = (to: number): void => {
  if (!socket || !socket.connected) return;
  console.log(`Terminazione chiamata con l'utente ${to}`);
  socket.emit('endCall', { to });
};

export const sendIceCandidate = (to: number, candidate: any): void => {
  if (!socket || !socket.connected) return;
  socket.emit('ice-candidate', { to, candidate });
};

// Crea una funzione ping per testare manualmente la connessione
export const pingServer = (): void => {
  if (!socket || !socket.connected) {
    console.warn('Impossibile fare ping: Socket non connesso');
    return;
  }
  
  console.log('Ping al server...');
  socket.emit('userActivity');
  console.log('Ping inviato');
};