// client/src/components/chat/ChatLayout.tsx
import { useState, useEffect } from 'react';
import { Box, useMediaQuery, useTheme, Snackbar, Alert } from '@mui/material';
import UserList from './UserList';
import MessageArea from './MessageArea';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../hooks/useAuth';
import VideoCall from '../videocall/VideoCall';
import IncomingCallDialog from '../videocall/IncomingCallDialog';

const ChatLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileView, setMobileView] = useState<'users' | 'chat'>('users');
  const [error, setError] = useState<string | null>(null);
  
  const { 
    selectedUser, 
    setSelectedUser, 
    socket, 
    isCallActive, 
    incomingCall, 
    acceptCall, 
    rejectCall, 
    endCall,
    refreshUsers 
  } = useChat();
  
  const { user: currentUser } = useAuth();
  
  // Periodically refresh users list
  useEffect(() => {
    const interval = setInterval(() => {
      refreshUsers().catch(err => {
        console.error('Failed to refresh users:', err);
      });
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [refreshUsers]);

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    if (isMobile) {
      setMobileView('chat');
    }
  };

  const handleBackToUsers = () => {
    if (isMobile) {
      setMobileView('users');
    }
  };
  
  // Handle socket connection status
  useEffect(() => {
    if (!socket) return;
    
    const handleConnect = () => {
      console.log('Socket connected');
      // Refresh users list on reconnect
      refreshUsers();
    };
    
    const handleDisconnect = (reason: string) => {
      console.log(`Socket disconnected: ${reason}`);
      setError('Disconnected from server. Reconnecting...');
      
      // If the disconnect is not because of a transport close, try to reconnect
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    };
    
    const handleError = (err: any) => {
      console.error('Socket error:', err);
      setError('Connection error. Please check your network.');
    };
    
    // Set up listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);
    
    // Clean up
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
    };
  }, [socket, refreshUsers]);

  // Handle call end
  const handleCallEnd = () => {
    if (socket && socket.connected && selectedUser) {
      socket.emit('endCall', { to: selectedUser.id });
    }
    endCall();
  };

  return (
    <>
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* User list - hide on mobile when in chat view */}
        {(!isMobile || mobileView === 'users') && (
          <UserList 
            selectedUser={selectedUser} 
            onSelectUser={handleSelectUser} 
            isMobile={isMobile}
          />
        )}

        {/* Chat area - hide on mobile when in users view */}
        {(!isMobile || mobileView === 'chat') && (
          <MessageArea 
            selectedUser={selectedUser} 
            onBackClick={handleBackToUsers}
            isMobile={isMobile} 
          />
        )}
      </Box>
      
      {/* Error snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      
      {/* Incoming call dialog */}
      {incomingCall && (
        <IncomingCallDialog
          open={!!incomingCall}
          username={incomingCall.username}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}
      
      {/* Video call component */}
      {isCallActive && selectedUser && currentUser && socket && (
        <VideoCall
          isOpen={isCallActive}
          onClose={handleCallEnd}
          user={selectedUser}
          socket={socket}
          isIncoming={!!incomingCall}
          signal={incomingCall?.signal}
        />
      )}
    </>
  );
};

export default ChatLayout;