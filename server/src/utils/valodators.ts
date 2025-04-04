// server/src/utils/validators.ts
export const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  export const validatePassword = (password: string): boolean => {
    // At least 8 characters, including at least 1 uppercase, 1 lowercase, and 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/;
    return passwordRegex.test(password);
  };
  
  export const validateUsername = (username: string): boolean => {
    // Allow alphanumeric characters, underscores, and hyphens, 3-20 characters long
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
  
  // Set log level based on environment
  const currentLogLevel = process.env.NODE_ENV === 'production' 
    ? LogLevel.INFO 
    : LogLevel.DEBUG;
  
  export const logger = {
    error: (message: string, error?: any) => {
      if (currentLogLevel >= LogLevel.ERROR) {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
        if (error) {
          console.error(error);
        }
      }
    },
  
    warn: (message: string) => {
      if (currentLogLevel >= LogLevel.WARN) {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
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