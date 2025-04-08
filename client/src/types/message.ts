export interface Message {
    id: number;
    content: string;
    senderId: number;
    receiverId: number;
    isRead: boolean;
    readAt?: string;
    attachmentUrl?: string;
    attachmentType?: string;
    createdAt: string;
    updatedAt: string;
    sender?: {
      id: number;
      username: string;
      avatarUrl?: string;
    };
  }
  
  export interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
  }
  
  export interface MessagesResponse {
    messages: Message[];
    pagination: Pagination;
  }