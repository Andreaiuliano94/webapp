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
  // Gestisce richiesta di videochiamata
  socket.on('callUser', (data: CallSignal) => {
    if (!socket.userId || !socket.username) return;

    // Assicura che l'ID del chiamante corrisponda all'utente autenticato
    if (data.from !== socket.userId) {
      return socket.emit('error', { message: 'ID chiamante non autorizzato' });
    }

    const receiverSocketId = onlineUsers.get(data.to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('incomingCall', {
        from: socket.userId,
        username: socket.username,
        signal: data.signal
      });
    } else {
      // L'utente è offline, notifica al chiamante
      socket.emit('callRejected', {
        userId: data.to,
        reason: 'L\'utente è offline'
      });
    }
  });

  // Gestisce accettazione chiamata
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

  // Gestisce rifiuto chiamata
  socket.on('rejectCall', (data: { to: number }) => {
    if (!socket.userId) return;

    const callerSocketId = onlineUsers.get(data.to);
    if (callerSocketId) {
      io.to(callerSocketId).emit('callRejected', {
        userId: socket.userId,
        reason: 'La chiamata è stata rifiutata'
      });
    }
  });

  // Gestisce fine chiamata
  socket.on('endCall', (data: { to: number }) => {
    if (!socket.userId) return;

    const otherSocketId = onlineUsers.get(data.to);
    if (otherSocketId) {
      io.to(otherSocketId).emit('callEnded', {
        userId: socket.userId
      });
    }
  });

  // Gestisce la segnalazione WebRTC
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