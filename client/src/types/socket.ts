export interface NewMessagePayload {
  receiverId: number;
  content: string;
  attachmentUrl?: string;
  attachmentType?: string;
}

export interface TypingIndicatorPayload {
  receiverId: number;
  isTyping: boolean;
}

export interface CallPayload {
  to: number;
  signal?: any;
}

export interface IncomingCallPayload {
  from: number;
  username: string;
  signal: any;
}

export interface CallAcceptedPayload {
  from: number;
  signal: any;
}

export interface CallRejectedPayload {
  userId: number;
  reason: string;
}

export interface IceCandidatePayload {
  to: number;
  candidate: any;
}