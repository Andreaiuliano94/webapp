// client/src/components/chat/ChatLayout.tsx
import { useState, useEffect } from 'react';
import { Box, useMediaQuery, useTheme, Snackbar, Alert } from '@mui/material';
import UserList from './UserList';
import MessageArea from './MessageArea';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../hooks/useAuth';
// Cambia l'importazione per evitare conflitti di nome
import VideoCallComponent from '../videocall/VideoCall'; // Rinominato l'import
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
    if (!refreshUsers) return;
    
    const interval = setInterval(() => {
      try {
        refreshUsers().catch(err => {
          console.error('Failed to refresh users:', err);
        });
      } catch (err) {
        console.error('Error refreshing users:', err);
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [refreshUsers]);

  const handleSelectUser = (user: any) => {
    // Avoid doing anything if we're already selecting this user
    if (selectedUser && user.id === selectedUser.id) return;
    
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
      try {
        refreshUsers();
      } catch (err) {
        console.error('Error refreshing users after connect:', err);
      }
    };
    
    const handleDisconnect = (reason: string) => {
      console.log(`Socket disconnected: ${reason}`);
      setError('Disconnected from server. Reconnecting...');
      
      // If the disconnect is not because of a transport close, try to reconnect
      if (reason === 'io server disconnect' && socket.connect) {
        try {
          socket.connect();
        } catch (err) {
          console.error('Error reconnecting socket:', err);
        }
      }
    };
    
    const handleError = (err: any) => {
      console.error('Socket error:', err);
      setError('Connection error. Please check your network.');
    };
    
    // Set up listeners
    try {
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('error', handleError);
    } catch (err) {
      console.error('Error setting up socket listeners:', err);
    }
    
    // Clean up
    return () => {
      try {
        if (socket) {
          socket.off('connect', handleConnect);
          socket.off('disconnect', handleDisconnect);
          socket.off('error', handleError);
        }
      } catch (err) {
        console.error('Error cleaning up socket listeners:', err);
      }
    };
  }, [socket, refreshUsers]);

  // Handle call end
  const handleCallEnd = () => {
    try {
      if (socket && socket.connected && selectedUser) {
        socket.emit('endCall', { to: selectedUser.id });
      }
      endCall();
    } catch (err) {
      console.error('Error ending call:', err);
    }
  };

  // Renderizza la dialog della chiamata in arrivo
  const renderIncomingCallDialog = () => {
    if (!incomingCall) return null;
    
    return (
      <IncomingCallDialog
        open={!!incomingCall}
        username={incomingCall.username}
        onAccept={acceptCall}
        onReject={rejectCall}
      />
    );
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
      {renderIncomingCallDialog()}
      
      {/* Video call component - Nota che ora usiamo VideoCallComponent invece di VideoCall */}
      {isCallActive && selectedUser && currentUser && socket && (
        <VideoCallComponent
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