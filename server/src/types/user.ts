// server/src/types/user.ts
export interface User {
    id: number;
    username: string;
    email: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    status: 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY';
    lastSeen: Date;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface UpdateProfileDto {
    displayName?: string;
    bio?: string;
  }