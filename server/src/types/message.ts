export interface Message {
    id: number;
    content: string;
    senderId: number;
    receiverId: number;
    isRead: boolean;
    readAt?: Date;
    attachmentUrl?: string;
    attachmentType?: string;
    createdAt: Date;
    updatedAt: Date;
    sender?: {
      id: number;
      username: string;
      avatarUrl?: string;
    };
  }
  
  export interface SendMessageDto {
    receiverId: number | string;
    content: string;
    attachmentUrl?: string;
    attachmentType?: string;
  }
  
  export interface MessagesPaginationResponse {
    messages: Message[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  }