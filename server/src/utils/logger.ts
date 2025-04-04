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