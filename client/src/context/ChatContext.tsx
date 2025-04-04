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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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
  
  // Usa un ref per tenere traccia dell'ultimo user selezionato senza causare loop
  const lastSelectedUserRef = useRef<number | null>(null);
  // Usa un ref per tenere traccia se l'effetto di caricamento messaggi è già in esecuzione
  const isLoadingMessagesRef = useRef(false);

  // Funzione per refresh utenti
  const refreshUsers = useCallback(async () => {
    if (!token) return;

    try {
      console.log('Refreshing users list');
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
      
      // Se abbiamo un utente selezionato, aggiorniamo i suoi dati
      if (selectedUser) {
        const updatedSelectedUser = updatedUsers.find((u: { id: number; }) => u.id === selectedUser.id);
        if (updatedSelectedUser) {
          setSelectedUser(updatedSelectedUser);
        }
      }
    } catch (error) {
      console.error('Error refreshing users:', error);
    }
  }, [token, onlineUsers, selectedUser]);

  // Inizializza socket
  useEffect(() => {
    if (token) {
      console.log('Initializing socket with token');
      const newSocket = initializeSocket(token);
      setSocket(newSocket);

      return () => {
        console.log('Disconnecting socket');
        disconnectSocket();
      };
    }
  }, [token]);

  // Carica utenti
  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

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
      if (selectedUser && !userIds.includes(selectedUser.id) && selectedUser.status === UserStatus.ONLINE) {
        setSelectedUser(prev => {
          if (!prev) return null;
          return { ...prev, status: UserStatus.OFFLINE };
        });
      } else if (selectedUser && userIds.includes(selectedUser.id) && selectedUser.status === UserStatus.OFFLINE) {
        setSelectedUser(prev => {
          if (!prev) return null;
          return { ...prev, status: UserStatus.ONLINE };
        });
      }
    };

    const handleUnreadCounts = (counts: Record<number, number>) => {
      console.log('Received unread counts:', counts);
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
  }, [socket, selectedUser]);

  // Marca messaggi come letti quando si seleziona un utente
  useEffect(() => {
    if (!selectedUser || !socket || !socket.connected) return;
    
    console.log(`Marking messages from ${selectedUser.username} as read`);
    socket.emit('chat_open', {
      userId: currentUser?.id,
      withUserId: selectedUser.id
    });
    
    // Aggiorna stato locale dei messaggi non letti
    setUnreadCounts(prev => ({
      ...prev,
      [selectedUser.id]: 0
    }));
    
  }, [selectedUser, socket, currentUser]);

  // Carica messaggi quando l'utente selezionato cambia
  useEffect(() => {
    // Evita loop e caricamenti duplicati
    if (!selectedUser || !token) return;
  
    // Memorizza l'ID dell'utente selezionato per evitare ricaricamenti inutili
    const selectedUserId = selectedUser.id;
    
    const fetchMessages = async () => {
      if (loadingMessages) return; // Previene chiamate simultanee
      
      setLoadingMessages(true);
      setPage(1);
      try {
        console.log(`Fetching messages with user ${selectedUserId}`);
        const response = await axios.get(`/api/messages/${selectedUserId}?page=1&limit=50`, {
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
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoadingMessages(false);
      }
    };
  
    fetchMessages();
    
    // Segna i messaggi come letti SOLO UNA VOLTA quando si seleziona un utente
    if (socket && socket.connected) {
      console.log(`Marking messages from ${selectedUser.username} as read`);
      socket.emit('markAsRead', { senderId: selectedUserId });
      
      // Richiedi gli unread counts
      socket.emit('getUnreadCounts');
    }
    
    // Importante: questa funzione non deve essere eseguita ad ogni render
  }, [selectedUser?.id, token]);

  // Funzione per segnare messaggi come letti
  const markMessagesAsRead = useCallback((senderId: number) => {
    if (!socket || !socket.connected) return;
    
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
      console.log('New message received:', message);
      
      // Se il messaggio è da un altro utente, incrementa contatore non letti
      if (message.senderId !== currentUser?.id) {
        // Aggiorna contatori non letti se non è la conversazione corrente
        if (!selectedUser || selectedUser.id !== message.senderId) {
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
      }
      
      // Aggiungi solo se riguarda la conversazione corrente
      if (
        selectedUser &&
        ((message.senderId === currentUser?.id && message.receiverId === selectedUser.id) ||
        (message.senderId === selectedUser.id && message.receiverId === currentUser?.id))
      ) {
        setMessages(prevMessages => {
          // Controlla se il messaggio esiste già
          const exists = prevMessages.some(m => m.id === message.id);
          if (exists) {
            return prevMessages;
          }
          return [...prevMessages, message];
        });
      }
    };

    const handleMessagesRead = (data: { by: number, timestamp: string }) => {
      console.log('Messages read by:', data.by);
      
      // Aggiorna lo stato locale dei messaggi
      if (selectedUser && data.by === selectedUser.id) {
        setMessages(prev => prev.map(msg => 
          msg.senderId === currentUser?.id && !msg.isRead 
            ? { ...msg, isRead: true, readAt: data.timestamp }
            : msg
        ));
      }
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
    socket.on('incomingCall', handleIncomingCall);
    socket.on('callRejected', handleCallRejected);
    socket.on('callEnded', handleCallEnded);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('incomingCall', handleIncomingCall);
      socket.off('callRejected', handleCallRejected);
      socket.off('callEnded', handleCallEnded);
    };
  }, [socket, selectedUser, currentUser, markMessagesAsRead]);

  // Funzione per inviare messaggi
  const sendMessage = useCallback(async (content: string) => {
    if (!selectedUser || !currentUser || !token) {
      return;
    }

    // Ottimisticamente aggiungi il messaggio alla UI
    const optimisticMessage: Message = {
      id: -Date.now(),
      content,
      senderId: currentUser.id,
      receiverId: selectedUser.id,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: {
        id: currentUser.id,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl
      }
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      // Invia tramite socket se possibile
      if (socket && socket.connected) {
        socket.emit('sendMessage', {
          content,
          senderId: currentUser.id,
          receiverId: selectedUser.id
        });
      }
      
      // Salva tramite API
      const response = await axios.post('/api/messages', {
        content,
        receiverId: selectedUser.id
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Sostituisci il messaggio ottimistico
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === optimisticMessage.id ? response.data.data : msg
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Rimuovi messaggio ottimistico in caso di errore
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      
      alert('Failed to send message. Please try again.');
    }
  }, [currentUser, selectedUser, socket, token]);

  // Carica altri messaggi
  const loadMoreMessages = useCallback(async () => {
    if (!selectedUser || !token || !hasMoreMessages || loadingMessages || isLoadingMessagesRef.current) {
      return;
    }

    isLoadingMessagesRef.current = true;
    setLoadingMessages(true);
    
    try {
      const nextPage = page + 1;
      
      const response = await axios.get(`/api/messages/${selectedUser.id}?page=${nextPage}&limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const newMessages = response.data.messages || [];
      
      setMessages(prevMessages => [...newMessages, ...prevMessages]);
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
  }, [selectedUser, token, hasMoreMessages, loadingMessages, page]);

  // Funzioni per videochiamate
  const initiateCall = useCallback(() => {
    if (!socket || !socket.connected || !selectedUser) {
      alert('Cannot initiate call: connection issue or no selected user');
      return;
    }
    
    if (selectedUser.status !== UserStatus.ONLINE) {
      alert('Cannot call: User is offline');
      return;
    }
    
    socket.emit('callUser', {
      to: selectedUser.id
    });
    
    setIsCallActive(true);
  }, [socket, selectedUser]);

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
      setSelectedUser(caller);
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
    if (!socket || !socket.connected || !selectedUser) {
      return;
    }
    
    socket.emit('endCall', {
      to: selectedUser.id
    });
    
    setIsCallActive(false);
  }, [socket, selectedUser]);

  return (
    <ChatContext.Provider
      value={{
        selectedUser,
        users,
        onlineUsers,
        messages,
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