export interface User {
    id: number;
    username: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    status: UserStatus;
    lastSeen?: string;
    createdAt?: string;
  }
  
  export enum UserStatus {
    ONLINE = 'ONLINE',
    OFFLINE = 'OFFLINE',
    AWAY = 'AWAY',
    BUSY = 'BUSY',
  }