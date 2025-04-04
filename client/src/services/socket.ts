// client/src/services/socket.ts
import { io, Socket } from 'socket.io-client';
import { Message } from '../types/message';

let socket: Socket;

export const initializeSocket = (token: string): Socket => {
  if (socket) {
    console.log('Disconnecting existing socket before creating a new one');
    socket.disconnect();
  }

  console.log('Initializing socket connection with token');
  
  // For development using proxy
  socket = io({
    auth: { token },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    forceNew: true, // Force a new connection
    autoConnect: true
  });

  socket.on('connect', () => {
    console.log(`Socket connected successfully with ID: ${socket.id}`);
    
    // Set up a regular ping to keep the user's online status updated
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('userActivity');
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Every 30 seconds
    
    // Clear interval when socket disconnects
    socket.on('disconnect', () => {
      clearInterval(pingInterval);
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected. Reason: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  socket.on('error', (error) => {
    console.error('Socket error from server:', error);
  });

  // Debug for online users events
  socket.on('onlineUsers', (userIds) => {
    console.log('Online users updated:', userIds);
  });

  return socket;
};

export const getSocket = (): Socket | null => {
  if (!socket) {
    console.warn('Socket not initialized. Call initializeSocket first.');
    return null;
  }
  
  if (!socket.connected) {
    console.warn('Socket exists but is not connected. Current state:', socket.connected ? 'connected' : 'disconnected');
  }
  
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    console.log('Manually disconnecting socket');
    socket.disconnect();
  } else {
    console.log('No socket to disconnect');
  }
};

export const sendMessage = (
  message: { content: string; receiverId: number },
  callback?: (message: Message) => void
): void => {
  if (!socket || !socket.connected) {
    console.warn(`Socket not initialized or not connected. Connected status: ${socket?.connected}`);
    return;
  }
  
  console.log(`Sending message to user ${message.receiverId}: ${message.content.substring(0, 20)}...`);
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
  console.log(`Marking messages from user ${senderId} as read`);
  socket.emit('markAsRead', { senderId });
};

export const callUser = (to: number, signal?: any): void => {
  if (!socket || !socket.connected) {
    console.warn('Cannot initiate call: Socket not connected');
    return;
  }
  
  console.log(`Initiating call to user ${to}`);
  socket.emit('callUser', { to, signal });
};

export const acceptCall = (to: number, signal?: any): void => {
  if (!socket || !socket.connected) return;
  console.log(`Accepting call from user ${to}`);
  socket.emit('acceptCall', { to, signal });
};

export const rejectCall = (to: number): void => {
  if (!socket || !socket.connected) return;
  console.log(`Rejecting call from user ${to}`);
  socket.emit('rejectCall', { to });
};

export const endCall = (to: number): void => {
  if (!socket || !socket.connected) return;
  console.log(`Ending call with user ${to}`);
  socket.emit('endCall', { to });
};

export const sendIceCandidate = (to: number, candidate: any): void => {
  if (!socket || !socket.connected) return;
  socket.emit('ice-candidate', { to, candidate });
};

// Create a ping function to manually test connection
export const pingServer = (): void => {
  if (!socket || !socket.connected) {
    console.warn('Cannot ping: Socket not connected');
    return;
  }
  
  console.log('Pinging server...');
  socket.emit('userActivity');
  console.log('Ping sent');
};