// client/src/App.tsx
import React, { useContext, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress, Button } from '@mui/material'; // Aggiunto Button
import { AuthContext } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';

// Lazy load components for better performance
const Login = lazy(() => import('./components/auth/Login'));
const Register = lazy(() => import('./components/auth/Register'));
const ChatLayout = lazy(() => import('./components/chat/ChatLayout'));

// Fallback loader component
const Loader = () => (
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

// Error boundary per catturare errori di rendering
interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("App error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box 
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            padding: 3,
            textAlign: 'center'
          }}
        >
          <h2>Qualcosa è andato storto.</h2>
          <p>Ricarica la pagina per riprovare. Se il problema persiste, contatta l'assistenza.</p>
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()}
            sx={{ mt: 2 }}
          >
            Ricarica la pagina
          </Button>
          {process.env.NODE_ENV !== 'production' && (
            <pre style={{ marginTop: 20, textAlign: 'left', overflow: 'auto', maxWidth: '100%' }}>
              {this.state.error?.toString()}
            </pre>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

// AuthenticatedApp component con ChatProvider
const AuthenticatedApp = () => {
  try {
    return (
      <ChatProvider>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/*" element={<ChatLayout />} />
          </Routes>
        </Suspense>
      </ChatProvider>
    );
  } catch (error) {
    console.error("Error in AuthenticatedApp:", error);
    return <div>Errore nel caricamento dell'app. <button onClick={() => window.location.reload()}>Riprova</button></div>;
  }
};

function App() {
  const { user, loading } = useContext(AuthContext);
  
  // Show loading spinner while checking auth state
  if (loading) {
    return <Loader />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loader />}>
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
    </ErrorBoundary>
  );
}

export default App;