import { useState, useEffect } from 'react';
import { Box, useMediaQuery, useTheme, Snackbar, Alert } from '@mui/material';
import UserList from './UserList';
import MessageArea from './MessageArea';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../hooks/useAuth';
import VideoCallComponent from '../videocall/VideoCall'; 
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
  
  // Aggiornamento periodico della lista utenti
  useEffect(() => {
    if (!refreshUsers) return;
    
    const interval = setInterval(() => {
      try {
        refreshUsers().catch(err => {
          console.error('Impossibile aggiornare la lista utenti:', err);
        });
      } catch (err) {
        console.error('Errore durante l\'aggiornamento degli utenti:', err);
      }
    }, 30000); // Ogni 30 secondi
    
    return () => clearInterval(interval);
  }, [refreshUsers]);

  const handleSelectUser = (user: any) => {
    // Evita di fare qualsiasi cosa se stiamo già selezionando questo utente
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
  
  // Gestione dello stato della connessione socket
  useEffect(() => {
    if (!socket) return;
    
    const handleConnect = () => {
      console.log('Socket connesso');
      // Aggiorna la lista utenti alla riconnessione
      try {
        refreshUsers();
      } catch (err) {
        console.error('Errore aggiornamento utenti dopo connessione:', err);
      }
    };
    
    const handleDisconnect = (reason: string) => {
      console.log(`Socket disconnesso: ${reason}`);
      setError('Disconnesso dal server. Riconnessione in corso...');
      
      // Se la disconnessione non è dovuta a una chiusura del trasporto, prova a riconnettersi
      if (reason === 'io server disconnect' && socket.connect) {
        try {
          socket.connect();
        } catch (err) {
          console.error('Errore riconnessione socket:', err);
        }
      }
    };
    
    const handleError = (err: any) => {
      console.error('Errore socket:', err);
      setError('Errore di connessione. Controlla la tua rete.');
    };
    
    // Configura i listener
    try {
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('error', handleError);
    } catch (err) {
      console.error('Errore durante la configurazione dei listener socket:', err);
    }
    
    // Pulizia
    return () => {
      try {
        if (socket) {
          socket.off('connect', handleConnect);
          socket.off('disconnect', handleDisconnect);
          socket.off('error', handleError);
        }
      } catch (err) {
        console.error('Errore pulizia listener socket:', err);
      }
    };
  }, [socket, refreshUsers]);

  // Gestione fine chiamata
  const handleCallEnd = () => {
    try {
      if (socket && socket.connected && selectedUser) {
        socket.emit('endCall', { to: selectedUser.id });
      }
      endCall();
    } catch (err) {
      console.error('Errore terminazione chiamata:', err);
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
        {/* Lista utenti - nascosta su mobile quando in visualizzazione chat */}
        {(!isMobile || mobileView === 'users') && (
          <UserList 
            selectedUser={selectedUser} 
            onSelectUser={handleSelectUser} 
            isMobile={isMobile}
          />
        )}

        {/* Area chat - nascosta su mobile quando in visualizzazione utenti */}
        {(!isMobile || mobileView === 'chat') && (
          <MessageArea 
            selectedUser={selectedUser} 
            onBackClick={handleBackToUsers}
            isMobile={isMobile} 
          />
        )}
      </Box>
      
      {/* Snackbar errori */}
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
      
      {/* Dialog chiamata in arrivo */}
      {renderIncomingCallDialog()}
      
      {/* Componente videochiamata - Nota che ora usiamo VideoCallComponent invece di VideoCall */}
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