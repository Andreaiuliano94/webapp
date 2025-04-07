// client/src/context/ChatContext.tsx
import { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { User, UserStatus } from '../types/user';
import { Message } from '../types/message';
import { AuthContext } from './AuthContext';
import { initializeSocket, disconnectSocket } from '../services/socket';
import axios from 'axios';

interface ChatContextType {
  selectedUser: User | null;
  users: User[];
  onlineUsers: number[];
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>; // Aggiungi questa riga
  socket: Socket | null;
  incomingCall: { from: number; username: string; signal: any } | null;
  isCallActive: boolean;
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  unreadCounts: Record<number, number>;
  setSelectedUser: (user: User | null) => void;
  sendMessage: (content: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  initiateCall: () => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  refreshUsers: () => Promise<void>;
  markMessagesAsRead: (senderId: number) => void;
}


export const ChatContext = createContext<ChatContextType>({
  selectedUser: null,
  users: [],
  onlineUsers: [],
  messages: [],
  setMessages: () => {}, // Aggiungi questa riga
  socket: null,
  incomingCall: null,
  isCallActive: false,
  loadingMessages: false,
  hasMoreMessages: false,
  unreadCounts: {},
  setSelectedUser: () => {},
  sendMessage: async () => {},
  loadMoreMessages: async () => {},
  initiateCall: () => {},
  acceptCall: () => {},
  rejectCall: () => {},
  endCall: () => {},
  refreshUsers: async () => {},
  markMessagesAsRead: () => {},
});

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user: currentUser, token } = useContext(AuthContext);
  const [selectedUser, setSelectedUserState] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ from: number; username: string; signal: any } | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  
  // Refs per gestire stati e prevenire loop
  const selectedUserRef = useRef<User | null>(null);
  const pendingMessagesRef = useRef<Record<string, boolean>>({});
  const sentMessagesRef = useRef<Set<string>>(new Set());
  const messageLoadedForUserRef = useRef<number | null>(null);
  const isFirstLoadRef = useRef(true);
  const isLoadingMessagesRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);
  const lastMessageMarkTimeRef = useRef<Record<number, number>>({});
  
  // Funzione sicura per impostare l'utente selezionato
  const setSelectedUser = useCallback((user: User | null) => {
    // Reset dello stato dei messaggi quando l'utente selezionato cambia
    if (user === null || (selectedUserRef.current && user && selectedUserRef.current.id !== user.id)) {
      setMessages([]);
      setPage(1);
      setHasMoreMessages(false);
      messageLoadedForUserRef.current = null;
    }
    
    selectedUserRef.current = user;
    setSelectedUserState(user);
  }, []);

  // Funzione per refresh utenti
  const refreshUsers = useCallback(async () => {
    // Previeni richieste troppo frequenti (minimo 5 secondi tra richieste)
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 5000) {
      return;
    }
    
    lastRefreshTimeRef.current = now;
    
    if (!token) return;

    try {
      const response = await axios.get('/api/users', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Preserva lo stato online degli utenti
      const updatedUsers = response.data.users.map((user: User) => ({
        ...user,
        status: onlineUsers.includes(user.id) ? UserStatus.ONLINE : UserStatus.OFFLINE
      }));
      
      setUsers(updatedUsers);
      
      // Aggiorna anche l'utente selezionato se necessario
      if (selectedUserRef.current) {
        const updatedSelectedUser = updatedUsers.find((u: User) => u.id === selectedUserRef.current?.id);
        if (updatedSelectedUser) {
          selectedUserRef.current = updatedSelectedUser;
          setSelectedUserState(updatedSelectedUser);
        }
      }
    } catch (error) {
      console.error('Error refreshing users:', error);
    }
  }, [token, onlineUsers]);

  // Inizializza socket
  useEffect(() => {
    if (!token) return;
    
    console.log('Initializing socket with token');
    const newSocket = initializeSocket(token);
    setSocket(newSocket);

    return () => {
      console.log('Disconnecting socket');
      disconnectSocket();
    };
  }, [token]);

  // Carica utenti all'inizio
  useEffect(() => {
    if (token && isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      refreshUsers();
    }
  }, [refreshUsers, token]);

  // Gestione utenti online
  useEffect(() => {
    if (!socket) return;

    const handleOnlineUsers = (userIds: number[]) => {
      setOnlineUsers(userIds);
      
      // Aggiorna stato utenti
      setUsers(prevUsers => 
        prevUsers.map(user => ({
          ...user,
          status: userIds.includes(user.id) ? UserStatus.ONLINE : UserStatus.OFFLINE,
        }))
      );
      
      // Aggiorna anche l'utente selezionato se necessario
      if (selectedUserRef.current) {
        const newStatus = userIds.includes(selectedUserRef.current.id) 
          ? UserStatus.ONLINE 
          : UserStatus.OFFLINE;
        
        if (selectedUserRef.current.status !== newStatus) {
          const updatedUser = {...selectedUserRef.current, status: newStatus};
          selectedUserRef.current = updatedUser;
          setSelectedUserState(updatedUser);
        }
      }
    };

    const handleUnreadCounts = (counts: Record<number, number>) => {
      setUnreadCounts(counts);
    };

    socket.on('onlineUsers', handleOnlineUsers);
    socket.on('unreadCounts', handleUnreadCounts);
    
    // Request unread counts on connect
    socket.emit('getUnreadCounts');
    
    return () => {
      socket.off('onlineUsers', handleOnlineUsers);
      socket.off('unreadCounts', handleUnreadCounts);
    };
  }, [socket]);

  // Carica messaggi quando l'utente selezionato cambia
  useEffect(() => {
    if (!selectedUser || !token) return;
    
    // Previeni caricamenti multipli per lo stesso utente
    if (selectedUser.id === messageLoadedForUserRef.current) return;
    
    const fetchMessages = async () => {
      if (isLoadingMessagesRef.current) return;
      
      isLoadingMessagesRef.current = true;
      setLoadingMessages(true);
      
      try {
        console.log(`Fetching messages with user ${selectedUser.id}`);
        const response = await axios.get(`/api/messages/${selectedUser.id}?page=1&limit=50`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        const messageData = response.data.messages || [];
        setMessages(messageData);
        
        setHasMoreMessages(
          response.data.pagination && 
          response.data.pagination.page < response.data.pagination.pages
        );
        
        // Aggiorna il riferimento all'utente di cui abbiamo caricato i messaggi
        messageLoadedForUserRef.current = selectedUser.id;
        
        // Segna messaggi come letti
        if (socket && socket.connected) {
          const now = Date.now();
          if (now - (lastMessageMarkTimeRef.current[selectedUser.id] || 0) > 3000) {
            lastMessageMarkTimeRef.current[selectedUser.id] = now;
            socket.emit('markAsRead', { senderId: selectedUser.id });
          }
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoadingMessages(false);
        isLoadingMessagesRef.current = false;
      }
    };
    
    fetchMessages();
  }, [selectedUser, token, socket]);

  // Funzione per segnare messaggi come letti
  const markMessagesAsRead = useCallback((senderId: number) => {
    if (!socket || !socket.connected) return;
    
    // Previeni richieste troppo frequenti per lo stesso utente
    const now = Date.now();
    if (now - (lastMessageMarkTimeRef.current[senderId] || 0) < 3000) {
      return;
    }
    
    lastMessageMarkTimeRef.current[senderId] = now;
    socket.emit('markAsRead', { senderId });
    
    // Aggiorna stato locale
    setUnreadCounts(prev => ({
      ...prev,
      [senderId]: 0
    }));
  }, [socket]);

  // Gestisci eventi socket per messaggi e chiamate
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      // Genera un ID univoco per questo messaggio
      const messageKey = `${message.senderId}-${message.receiverId}-${message.content}-${message.createdAt}`;
      
      // Se è un messaggio già gestito, non fare nulla
      if (sentMessagesRef.current.has(messageKey)) {
        return;
      }
      
      // Se il messaggio è da un altro utente, gestisci notifiche e contatori
      if (message.senderId !== currentUser?.id) {
        // Aggiorna contatori non letti se non è la conversazione corrente
        if (!selectedUserRef.current || selectedUserRef.current.id !== message.senderId) {
          setUnreadCounts(prev => ({
            ...prev,
            [message.senderId]: (prev[message.senderId] || 0) + 1
          }));
          
          // Suona notifica
          try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(e => console.log('Audio play error:', e));
          } catch (e) {
            console.log('Audio notification error:', e);
          }
        } else {
          // Se è la conversazione corrente, segna come letto
          markMessagesAsRead(message.senderId);
        }
      } else {
        // Se è un messaggio che ho inviato io, controlla se è un messaggio pendente
        const tempId = `temp-${Math.abs(message.id)}`;
        if (pendingMessagesRef.current[tempId]) {
          // Aggiorniamo il messaggio temporaneo con il messaggio reale dal server
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              (msg.id < 0 && msg.content === message.content && 
              msg.senderId === message.senderId && 
              msg.receiverId === message.receiverId)
                ? message 
                : msg
            )
          );
          
          // Rimuovi il messaggio dalla lista dei pendenti
          delete pendingMessagesRef.current[tempId];
          sentMessagesRef.current.add(messageKey);
          return; // Non aggiungere il messaggio di nuovo
        }
      }
      
      // Aggiungi solo se riguarda la conversazione corrente
      if (
        selectedUserRef.current &&
        ((message.senderId === currentUser?.id && message.receiverId === selectedUserRef.current.id) ||
        (message.senderId === selectedUserRef.current.id && message.receiverId === currentUser?.id))
      ) {
        setMessages(prevMessages => {
          // Controlla se il messaggio esiste già
          const exists = prevMessages.some(m => 
            m.id === message.id ||
            (m.content === message.content && 
            m.senderId === message.senderId && 
            m.receiverId === message.receiverId &&
            Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 1000)
          );
          
          if (exists) {
            return prevMessages;
          }
          
          // Aggiungi il messaggio
          sentMessagesRef.current.add(messageKey);
          return [...prevMessages, message];
        });
      }
    };

    const handleMessagesRead = (data: { by: number, timestamp: string }) => {
      // Aggiorna lo stato locale dei messaggi
      if (selectedUserRef.current && data.by === selectedUserRef.current.id) {
        setMessages(prev => prev.map(msg => 
          msg.senderId === currentUser?.id && !msg.isRead 
            ? { ...msg, isRead: true, readAt: data.timestamp }
            : msg
        ));
      }
    };

    const handleMessageDeleted = (data: { messageId: number }) => {
      // Rimuovi il messaggio eliminato dall'array di messaggi
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    };

    const handleIncomingCall = (data: { from: number; username: string; signal: any }) => {
      console.log('Incoming call from:', data.username);
      setIncomingCall(data);
      
      // Suona notifica per chiamata
      try {
        const audio = new Audio('/ringtone.mp3');
        audio.loop = true;
        audio.play().catch(e => console.log('Audio play error:', e));
        
        // Memorizza il riferimento audio per fermarlo quando la chiamata viene gestita
        window.incomingCallAudio = audio;
      } catch (e) {
        console.log('Audio notification error:', e);
      }
    };

    const handleCallRejected = (data: { userId: number, reason: string }) => {
      console.log('Call rejected:', data.reason);
      setIsCallActive(false);
      alert(`Call rejected: ${data.reason}`);
      
      // Ferma audio di chiamata se attivo
      if (window.incomingCallAudio) {
        window.incomingCallAudio.pause();
        window.incomingCallAudio = null;
      }
    };

    const handleCallEnded = () => {
      console.log('Call ended');
      setIsCallActive(false);
      
      // Ferma audio di chiamata se attivo
      if (window.incomingCallAudio) {
        window.incomingCallAudio.pause();
        window.incomingCallAudio = null;
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messagesRead', handleMessagesRead);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('incomingCall', handleIncomingCall);
    socket.on('callRejected', handleCallRejected);
    socket.on('callEnded', handleCallEnded);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('incomingCall', handleIncomingCall);
      socket.off('callRejected', handleCallRejected);
      socket.off('callEnded', handleCallEnded);
    };
  }, [socket, currentUser, markMessagesAsRead]);

  // Funzione per inviare messaggi
  const sendMessage = useCallback(async (content: string) => {
    if (!selectedUserRef.current || !currentUser || !token || !socket) {
      return;
    }

    // Generiamo un ID temporaneo unico
    const tempId = -Date.now();
    
    // Ottimisticamente aggiungi il messaggio alla UI
    const optimisticMessage: Message = {
      id: tempId,
      content,
      senderId: currentUser.id,
      receiverId: selectedUserRef.current.id,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: {
        id: currentUser.id,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl
      }
    };
    
    // Generare una chiave univoca per questo messaggio
    const messageKey = `${optimisticMessage.senderId}-${optimisticMessage.receiverId}-${content}-${optimisticMessage.createdAt}`;
    
    // Aggiungi il messaggio alla lista dei messaggi inviati per evitare duplicati
    sentMessagesRef.current.add(messageKey);
    
    // Aggiungi il messaggio ottimistico allo stato
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Registra il messaggio come pendente
    pendingMessagesRef.current[`temp-${Math.abs(tempId)}`] = true;
    
    try {
      // Invia tramite socket
      if (socket.connected) {
        socket.emit('sendMessage', {
          content,
          senderId: currentUser.id,
          receiverId: selectedUserRef.current.id
        });
      } else {
        throw new Error('Socket not connected');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Rimuovi messaggio ottimistico in caso di errore
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      delete pendingMessagesRef.current[`temp-${Math.abs(tempId)}`];
      sentMessagesRef.current.delete(messageKey);
      
      alert('Failed to send message. Please try again.');
    }
  }, [currentUser, socket, token]);

  // Nuova funzione per eliminare messaggi
  const deleteMessage = useCallback(async (messageId: number) => {
    if (!currentUser || !token || !socket || !socket.connected) {
      return;
    }

    try {
      // Aggiorna ottimisticamente l'UI rimuovendo il messaggio
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Invia richiesta di eliminazione al server
      const response = await axios.delete(`/api/messages/${messageId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Notifica altri utenti dell'eliminazione tramite socket
      socket.emit('deleteMessage', { messageId });
      
      console.log('Message deleted successfully', response.data);
    } catch (error) {
      console.error('Error deleting message:', error);
      
      // In caso di errore, recupera i messaggi
      if (selectedUserRef.current) {
        try {
          const response = await axios.get(`/api/messages/${selectedUserRef.current.id}?page=1&limit=50`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          setMessages(response.data.messages || []);
        } catch (err) {
          console.error('Error reloading messages:', err);
        }
      }
      
      alert('Failed to delete message. Please try again.');
    }
  }, [currentUser, socket, token]);

  // Carica altri messaggi
  const loadMoreMessages = useCallback(async () => {
    if (!selectedUserRef.current || !token || !hasMoreMessages || loadingMessages || isLoadingMessagesRef.current) {
      return;
    }

    isLoadingMessagesRef.current = true;
    setLoadingMessages(true);
    
    try {
      const nextPage = page + 1;
      
      const response = await axios.get(`/api/messages/${selectedUserRef.current.id}?page=${nextPage}&limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const newMessages = response.data.messages || [];
      
      setMessages(prevMessages => {
        // Filtra messaggi duplicati prima di aggiungerli
        const existingIds = new Set(prevMessages.map(m => m.id));
        const uniqueNewMessages = newMessages.filter((m: { id: number; }) => !existingIds.has(m.id));
        return [...uniqueNewMessages, ...prevMessages];
      });
      
      setPage(nextPage);
      setHasMoreMessages(
        response.data.pagination && 
        response.data.pagination.page < response.data.pagination.pages
      );
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMessages(false);
      isLoadingMessagesRef.current = false;
    }
  }, [token, hasMoreMessages, loadingMessages, page]);

  // Funzioni per videochiamate
  const initiateCall = useCallback(() => {
    if (!socket || !socket.connected || !selectedUserRef.current) {
      alert('Cannot initiate call: connection issue or no selected user');
      return;
    }
    
    if (selectedUserRef.current.status !== UserStatus.ONLINE) {
      alert('Cannot call: User is offline');
      return;
    }
    
    socket.emit('callUser', {
      to: selectedUserRef.current.id
    });
    
    setIsCallActive(true);
  }, [socket]);

  const acceptCall = useCallback(() => {
    if (!socket || !socket.connected || !incomingCall) {
      return;
    }
    
    // Ferma audio di chiamata in arrivo
    if (window.incomingCallAudio) {
      window.incomingCallAudio.pause();
      window.incomingCallAudio = null;
    }
    
    // Trova l'utente che sta chiamando
    const caller = users.find(u => u.id === incomingCall.from);
    if (caller) {
      selectedUserRef.current = caller;
      setSelectedUserState(caller);
    }
    
    setIsCallActive(true);
    setIncomingCall(null);
  }, [socket, incomingCall, users]);

  const rejectCall = useCallback(() => {
    if (!socket || !socket.connected || !incomingCall) {
      return;
    }
    
    // Ferma audio di chiamata in arrivo
    if (window.incomingCallAudio) {
      window.incomingCallAudio.pause();
      window.incomingCallAudio = null;
    }
    
    socket.emit('rejectCall', {
      to: incomingCall.from
    });
    
    setIncomingCall(null);
  }, [socket, incomingCall]);

  const endCall = useCallback(() => {
    if (!socket || !socket.connected || !selectedUserRef.current) {
      return;
    }
    
    socket.emit('endCall', {
      to: selectedUserRef.current.id
    });
    
    setIsCallActive(false);
  }, [socket]);

  return (
    <ChatContext.Provider
    value={{
      selectedUser,
      users,
      onlineUsers,
      messages,
      setMessages, // Aggiungi questa riga
      socket,
      incomingCall,
      isCallActive,
      loadingMessages,
      hasMoreMessages,
      unreadCounts,
      setSelectedUser,
      sendMessage,
      loadMoreMessages,
      initiateCall,
      acceptCall,
      rejectCall,
      endCall,
      refreshUsers,
      markMessagesAsRead,
    }}
  >
    {children}
  </ChatContext.Provider>
  );
};

// Aggiungi questa dichiarazione per l'audio della chiamata
declare global {
  interface Window {
    incomingCallAudio: HTMLAudioElement | null;
  }
}

// Custom hook per usare il chat context
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};