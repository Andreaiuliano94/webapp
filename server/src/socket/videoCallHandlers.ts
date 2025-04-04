// server/src/socket/videoCallHandlers.ts
import { Server, Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

interface CallSignal {
  to: number;
  from: number;
  username?: string;
  signal?: any;
}

export const setupVideoCallHandlers = (
  io: Server,
  socket: AuthenticatedSocket,
  onlineUsers: Map<number, string>
) => {
  // Handle video call request
  socket.on('callUser', (data: CallSignal) => {
    if (!socket.userId || !socket.username) return;

    // Ensure caller ID matches authenticated user
    if (data.from !== socket.userId) {
      return socket.emit('error', { message: 'Unauthorized caller ID' });
    }

    const receiverSocketId = onlineUsers.get(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('incomingCall', {
        from: socket.userId,
        username: socket.username,
        signal: data.signal
      });
    } else {
      // User is offline, notify caller
      socket.emit('callRejected', {
        userId: data.to,
        reason: 'User is offline'
      });
    }
  });

  // Handle accepting a call
  socket.on('acceptCall', (data: CallSignal) => {
    if (!socket.userId) return;

    const callerSocketId = onlineUsers.get(data.to);
    if (callerSocketId) {
      io.to(callerSocketId).emit('callAccepted', {
        from: socket.userId,
        signal: data.signal
      });
    }
  });

  // Handle rejecting a call
  socket.on('rejectCall', (data: { to: number }) => {
    if (!socket.userId) return;

    const callerSocketId = onlineUsers.get(data.to);
    if (callerSocketId) {
      io.to(callerSocketId).emit('callRejected', {
        userId: socket.userId,
        reason: 'Call was rejected'
      });
    }
  });

  // Handle ending a call
  socket.on('endCall', (data: { to: number }) => {
    if (!socket.userId) return;

    const otherSocketId = onlineUsers.get(data.to);
    if (otherSocketId) {
      io.to(otherSocketId).emit('callEnded', {
        userId: socket.userId
      });
    }
  });

  // Handle WebRTC signaling
  socket.on('ice-candidate', (data: { to: number, candidate: any }) => {
    if (!socket.userId) return;

    const otherSocketId = onlineUsers.get(data.to);
    if (otherSocketId) {
      io.to(otherSocketId).emit('ice-candidate', {
        from: socket.userId,
        candidate: data.candidate
      });
    }
  });
};