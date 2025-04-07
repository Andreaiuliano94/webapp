// client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme/theme';
import './index.css';
import './polyfill';

// Assicurati che il container esista
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

// Usa createRoot con gestione errori
const root = ReactDOM.createRoot(rootElement);

// Renderizza con error boundary
root.render(
  <React.StrictMode>
    <React.Fragment>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </React.Fragment>
  </React.StrictMode>
);