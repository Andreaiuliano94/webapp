// client/src/utils/debug.ts
// Utility functions for debugging the application in the browser console

import { getSocket, pingServer } from '../services/socket';
//import { UserStatus } from '../types/user';

// Make functions available in the browser console
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

// Check socket connection
const checkSocket = () => {
  const socket = getSocket();
  if (!socket) {
    console.error('Socket not initialized');
    return;
  }

  console.log('Socket connection status:', {
    id: socket.id,
    connected: socket.connected,
    disconnected: socket.disconnected,
  });
};

// Send a test message directly via socket
const testSendMessage = (userId: number, message: string) => {
  const socket = getSocket();
  if (!socket || !socket.connected) {
    console.error('Socket not connected');
    return;
  }

  // Get current user from localStorage (this is a hack for debugging)
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found, cannot determine current user');
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
    
    console.log(`Test message sent to user ${userId}`);
  } catch (error) {
    console.error('Error sending test message:', error);
  }
};

// Check which users are reported as online
const checkOnlineUsers = () => {
  const socket = getSocket();
  if (!socket || !socket.connected) {
    console.error('Socket not connected');
    return;
  }

  // Request online users list
  socket.on('onlineUsers', (userIds) => {
    console.log('Online users:', userIds);
  });
  
  // Ping to trigger an update
  pingServer();
};

// Force a user to appear online (for testing only)
const forceOnlineStatus = (userId: number) => {
  // This is just a mock for debugging
  console.log(`Attempting to force user ${userId} online (mock function)`);
  
  // In a real app, you'd need server-side changes to achieve this
  const chatContext = document.querySelector('[data-testid="chat-context"]');
  if (chatContext) {
    // This is a hack and will only work if we add a data-testid attribute to the context provider
    const event = new CustomEvent('forceUserOnline', { detail: { userId } });
    chatContext.dispatchEvent(event);
    console.log('Event dispatched');
  } else {
    console.log('Chat context element not found');
  }
};

// Refresh users list
const refreshUsers = () => {
  // This is a mock that just outputs to console
  console.log('Would refresh users list (mock function)');
  // In a real app, you'd call the relevant function from your context
};

// Initialize debug tools (call this once)
export const initDebugTools = () => {
  window.debugChat = {
    pingServer,
    checkSocket,
    checkOnlineUsers,
    testSendMessage,
    refreshUsers,
    forceOnlineStatus
  };
  
  console.log('Debug tools initialized. Access them via window.debugChat.*');
};

export default {
  initDebugTools,
};