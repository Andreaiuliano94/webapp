export interface RegisterUserDto {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }
  
  export interface LoginDto {
    email: string;
    password: string;
  }
  
  export interface AuthResponse {
    user: {
      id: number;
      username: string;
      email: string;
      displayName?: string;
      avatarUrl?: string;
      status: string;
    };
    token: string;
    message: string;
  }