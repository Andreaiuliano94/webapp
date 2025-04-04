// client/src/App.tsx
import { useContext, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AuthContext } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import IncomingCallDialog from './components/videocall/IncomingCallDialog';
import { useChat } from './context/ChatContext';

// Lazy load components for better performance
const Login = lazy(() => import('./components/auth/Login'));
const Register = lazy(() => import('./components/auth/Register'));
const ChatLayout = lazy(() => import('./components/chat/ChatLayout'));

// CallHandler component to manage incoming calls
const CallHandler = () => {
  const { incomingCall, acceptCall, rejectCall } = useChat();
  
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

// AuthenticatedApp component with ChatProvider
const AuthenticatedApp = () => {
  return (
    <ChatProvider>
      <Routes>
        <Route path="/*" element={<ChatLayout />} />
      </Routes>
      <CallHandler />
    </ChatProvider>
  );
};

function App() {
  const { user, loading } = useContext(AuthContext);
  
  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <Box 
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Suspense fallback={
      <Box 
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <CircularProgress />
      </Box>
    }>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
        {user ? (
          <Route path="/*" element={<AuthenticatedApp />} />
        ) : (
          <Route path="/*" element={<Navigate to="/login" />} />
        )}
      </Routes>
    </Suspense>
  );
}

export default App;