import { getSocket, pingServer } from '../services/socket';
//import { UserStatus } from '../types/user';

// Rendi le funzioni disponibili nella console del browser
declare global {
  interface Window {
    debugChat: {
      pingServer: () => void;
      checkSocket: () => void;
      checkOnlineUsers: () => void;
      testSendMessage: (userId: number, message: string) => void;
      refreshUsers: () => void;
      forceOnlineStatus: (userId: number) => void;
    };
  }
}

// Controlla connessione socket
const checkSocket = () => {
  const socket = getSocket();
  if (!socket) {
    console.error('Socket non inizializzato');
    return;
  }

  console.log('Stato connessione socket:', {
    id: socket.id,
    connected: socket.connected,
    disconnected: socket.disconnected,
  });
};

// Invia un messaggio di test direttamente via socket
const testSendMessage = (userId: number, message: string) => {
  const socket = getSocket();
  if (!socket || !socket.connected) {
    console.error('Socket non connesso');
    return;
  }

  // Ottieni l'utente corrente da localStorage (questo è un hack per il debug)
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('Nessun token trovato, impossibile determinare l\'utente corrente');
    return;
  }

  try {
    const tokenParts = token.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    
    socket.emit('sendMessage', {
      content: message,
      senderId: payload.id,
      receiverId: userId
    });
    
    console.log(`Messaggio di test inviato all'utente ${userId}`);
  } catch (error) {
    console.error('Errore invio messaggio di test:', error);
  }
};

// Controlla quali utenti sono segnalati come online
const checkOnlineUsers = () => {
  const socket = getSocket();
  if (!socket || !socket.connected) {
    console.error('Socket non connesso');
    return;
  }

  // Richiedi lista utenti online
  socket.on('onlineUsers', (userIds) => {
    console.log('Utenti online:', userIds);
  });
  
  // Ping per attivare un aggiornamento
  pingServer();
};

// Forza un utente ad apparire online (solo per test)
const forceOnlineStatus = (userId: number) => {
  // Questa è solo una simulazione per il debug
  console.log(`Tentativo di forzare l'utente ${userId} online (funzione mock)`);
  
  // In un'app reale, avresti bisogno di modifiche lato server per ottenere questo
  const chatContext = document.querySelector('[data-testid="chat-context"]');
  if (chatContext) {
    // Questo è un hack e funzionerà solo se aggiungiamo un attributo data-testid al provider di contesto
    const event = new CustomEvent('forceUserOnline', { detail: { userId } });
    chatContext.dispatchEvent(event);
    console.log('Evento inviato');
  } else {
    console.log('Elemento contesto chat non trovato');
  }
};

// Aggiorna lista utenti
const refreshUsers = () => {
  // Questa è una simulazione che stampa solo sulla console
  console.log('Dovrebbe aggiornare la lista utenti (funzione mock)');
  // In un'app reale, chiameresti la funzione rilevante dal tuo contesto
};

// Inizializza strumenti di debug (chiamala una volta)
export const initDebugTools = () => {
  window.debugChat = {
    pingServer,
    checkSocket,
    checkOnlineUsers,
    testSendMessage,
    refreshUsers,
    forceOnlineStatus
  };
  
  console.log('Strumenti di debug inizializzati. Accedi tramite window.debugChat.*');
};

export default {
  initDebugTools,
};