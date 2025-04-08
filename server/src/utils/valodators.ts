export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  // Almeno 8 caratteri, incluso almeno 1 maiuscolo, 1 minuscolo e 1 numero
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/;
  return passwordRegex.test(password);
};

export const validateUsername = (username: string): boolean => {
  // Permette caratteri alfanumerici, underscore e trattini, lunghezza 3-20 caratteri
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
};

// server/src/utils/logger.ts
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Imposta livello di log in base all'ambiente
const currentLogLevel = process.env.NODE_ENV === 'production' 
  ? LogLevel.INFO 
  : LogLevel.DEBUG;

export const logger = {
  error: (message: string, error?: any) => {
    if (currentLogLevel >= LogLevel.ERROR) {
      console.error(`[ERRORE] ${new Date().toISOString()} - ${message}`);
      if (error) {
        console.error(error);
      }
    }
  },

  warn: (message: string) => {
    if (currentLogLevel >= LogLevel.WARN) {
      console.warn(`[AVVISO] ${new Date().toISOString()} - ${message}`);
    }
  },

  info: (message: string) => {
    if (currentLogLevel >= LogLevel.INFO) {
      console.info(`[INFO] ${new Date().toISOString()} - ${message}`);
    }
  },

  debug: (message: string, data?: any) => {
    if (currentLogLevel >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`);
      if (data) {
        console.debug(data);
      }
    }
  }
};