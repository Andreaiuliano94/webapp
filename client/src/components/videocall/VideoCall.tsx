// client/src/components/videocall/VideoCall.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, IconButton, Paper, Dialog, DialogContent, CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  CallEnd as CallEndIcon,
} from '@mui/icons-material';
import { User } from '../../types/user';
import { Socket } from 'socket.io-client';

interface VideoCallProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  socket: Socket;
  isIncoming: boolean;
  signal?: RTCSessionDescriptionInit;
}

const VideoCall = ({ isOpen, onClose, user, socket, isIncoming, signal }: VideoCallProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [_remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const isComponentMounted = useRef(true);
  const callHandlersSetUp = useRef(false);

  // Configurazione per WebRTC
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Pulisci risorse
  
const cleanup = () => {
  console.log('Cleaning up video call resources');
  
  // Chiudi stream locali in modo più robusto
  if (stream) {
    console.log('Stopping all media tracks');
    stream.getTracks().forEach(track => {
      console.log(`Stopping track: ${track.kind}`, track);
      track.stop();
    });
    
    // Assicurati che i riferimenti ai video siano cancellati
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Rimuovi anche i riferimenti agli stream
    setStream(null);
    setRemoteStream(null);
  }
  
  // Chiudi peer connection
  if (peerConnectionRef.current) {
    console.log('Closing peer connection');
    peerConnectionRef.current.close();
    peerConnectionRef.current = null;
  }
};
  // Rimuovi listener socket
  const cleanupSocketListeners = () => {
    socket.off('callAccepted');
    socket.off('ice-candidate');
    socket.off('callRejected');
    socket.off('callEnded');
  };
  
  // Gestisci fine chiamata
  // E nell'handleEndCall aggiungi:
const handleEndCall = () => {
  try {
    console.log('Ending call');
    socket.emit('endCall', { to: user.id });
  } catch (err) {
    console.error('Error signaling end call:', err);
  } finally {
    // Forzatamente eseguire cleanup
    cleanup();
    
    // Induzione ulteriore a rilasciare le risorse
    setTimeout(() => {
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            console.log('Forcing track stop', track);
            track.stop();
          }
        });
      }
      onClose();
    }, 100);
  }
};

  // Inizializza stream e peer connection
  useEffect(() => {
    if (!isOpen) return;

    isComponentMounted.current = true;
    
    const initializeCall = async () => {
      try {
        // Ottieni accesso ai media locali
        console.log('Requesting user media');
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        if (!isComponentMounted.current) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }
        
        console.log('Got media stream:', mediaStream.id);
        setStream(mediaStream);
        
        // Assegna stream al video locale
        if (localVideoRef.current) {
          console.log('Setting local video stream');
          localVideoRef.current.srcObject = mediaStream;
        }

        // Inizializza RTCPeerConnection
        console.log('Creating RTCPeerConnection');
        const peerConnection = new RTCPeerConnection(configuration);
        peerConnectionRef.current = peerConnection;
        
        // Crea stream remoto
        const newRemoteStream = new MediaStream();
        setRemoteStream(newRemoteStream);
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = newRemoteStream;
        }
        
        // Aggiungi le tracce locali alla connessione
        mediaStream.getTracks().forEach(track => {
          console.log(`Adding ${track.kind} track to peer connection`);
          peerConnection.addTrack(track, mediaStream);
        });
        
        // Gestisci flusso remoto in arrivo
        peerConnection.ontrack = (event) => {
          console.log('Remote track received:', event.track.kind);
          event.streams[0].getTracks().forEach(track => {
            console.log(`Adding remote ${track.kind} track to remote stream`);
            newRemoteStream.addTrack(track);
          });
          setConnectionStatus('connected');
        };
        
        // Gestisci ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('Generated ICE candidate');
            socket.emit('ice-candidate', {
              to: user.id,
              candidate: event.candidate
            });
          }
        };
        
        // Gestisci cambiamenti dello stato della connessione
        peerConnection.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', peerConnection.iceConnectionState);
          if (peerConnection.iceConnectionState === 'connected' || 
              peerConnection.iceConnectionState === 'completed') {
            setConnectionStatus('connected');
          } else if (peerConnection.iceConnectionState === 'disconnected' ||
                     peerConnection.iceConnectionState === 'failed' ||
                     peerConnection.iceConnectionState === 'closed') {
            setConnectionStatus('disconnected');
          }
        };

        // Setup socket listeners solo una volta
        if (!callHandlersSetUp.current) {
          setupCallHandlers();
          callHandlersSetUp.current = true;
        }
        
        // Se la chiamata è in arrivo, gestisci il segnale remoto
        if (isIncoming && signal) {
          handleIncomingCall(signal, peerConnection);
        } else {
          // Se è una chiamata in uscita, crea un'offerta
          createOffer(peerConnection);
        }
      } catch (err) {
        console.error('Failed to initialize call:', err);
        if (isComponentMounted.current) {
          setError(`Could not access camera/microphone. ${err instanceof Error ? err.message : 'Please check permissions'}`);
          setTimeout(() => {
            if (isComponentMounted.current) {
              onClose();
            }
          }, 3000);
        }
      }
    };
    
    // Setup socket event handlers
    const setupCallHandlers = () => {
      console.log('Setting up call socket handlers');
      
      // Handle call accepted
      socket.on('callAccepted', async (data) => {
        try {
          if (data.from === user.id && data.signal && peerConnectionRef.current) {
            console.log('Call accepted, received remote description');
            const rtcSessionDescription = new RTCSessionDescription(data.signal);
            await peerConnectionRef.current.setRemoteDescription(rtcSessionDescription);
            setConnectionStatus('connected');
          }
        } catch (err) {
          console.error('Error handling call accepted:', err);
          if (isComponentMounted.current) {
            setError('Failed to establish connection');
          }
        }
      });
      
      // Handle ICE candidates
      socket.on('ice-candidate', async (data) => {
        try {
          if (data.from === user.id && peerConnectionRef.current) {
            console.log('Received ICE candidate');
            const candidate = new RTCIceCandidate(data.candidate);
            
            if (peerConnectionRef.current.remoteDescription) {
              await peerConnectionRef.current.addIceCandidate(candidate);
            } else {
              console.log('Skipping ICE candidate - remote description not set');
            }
          }
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      });
      
      // Handle call rejected
      socket.on('callRejected', (data) => {
        if (data.userId === user.id) {
          console.log('Call rejected');
          if (isComponentMounted.current) {
            setError('Call was rejected');
            setTimeout(() => {
              if (isComponentMounted.current) {
                onClose();
              }
            }, 2000);
          }
        }
      });
      
      // Handle call ended
      socket.on('callEnded', (data) => {
        if (data.userId === user.id) {
          console.log('Call ended by peer');
          if (isComponentMounted.current) {
            onClose();
          }
        }
      });
    };
    
    // Handle incoming call
    const handleIncomingCall = async (incomingSignal: RTCSessionDescriptionInit, peerConnection: RTCPeerConnection) => {
      try {
        console.log('Processing incoming call signal');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingSignal));
        
        console.log('Creating answer');
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        console.log('Sending answer to caller');
        socket.emit('acceptCall', {
          to: user.id,
          signal: peerConnection.localDescription
        });
      } catch (err) {
        console.error('Error handling incoming call:', err);
        if (isComponentMounted.current) {
          setError('Failed to answer call');
        }
      }
    };
    
    // Create offer for outgoing call
    const createOffer = async (peerConnection: RTCPeerConnection) => {
      try {
        console.log('Creating offer');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        console.log('Sending call offer');
        socket.emit('callUser', {
          to: user.id,
          signal: peerConnection.localDescription
        });
      } catch (err) {
        console.error('Error creating offer:', err);
        if (isComponentMounted.current) {
          setError('Failed to start call');
        }
      }
    };
    
    // Start call initialization
    initializeCall().catch(err => {
      console.error('Unhandled error during call initialization:', err);
      if (isComponentMounted.current) {
        setError('Call initialization failed');
      }
    });
    
    // Cleanup on unmount
    return () => {
      console.log('Call component unmounting');
      isComponentMounted.current = false;
      callHandlersSetUp.current = false;
      cleanup();
      cleanupSocketListeners();
    };
  }, [isOpen]);
  
  // Ensure socket listeners are set up only once
  useEffect(() => {
    if (!socket || !isOpen) return;
    
    // No additional setup needed
    
    return () => {
      // Cleanup on effect change
      if (isComponentMounted.current) {
        cleanupSocketListeners();
      }
    };
  }, [socket, isOpen]);
  
  // Gestisci toggle mute
  const toggleMute = () => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };
  
  // Gestisci toggle video
  const toggleVideo = () => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={handleEndCall}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: 'background.default',
          height: '80vh'
        }
      }}
    >
      <DialogContent sx={{ p: 0, position: 'relative', height: '100%' }}>
        {/* Bottone chiusura */}
        <IconButton
          sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0, 0, 0, 0.5)', zIndex: 2 }}
          onClick={handleEndCall}
        >
          <CloseIcon sx={{ color: 'white' }} />
        </IconButton>
        
        {/* Stato connessione ed errori */}
        {connectionStatus === 'connecting' && !error && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              bgcolor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              p: 2,
              borderRadius: 2,
              textAlign: 'center'
            }}
          >
            <CircularProgress color="inherit" size={40} sx={{ mb: 2 }} />
            <Typography variant="h6">
              Connecting to {user.displayName || user.username}...
            </Typography>
          </Box>
        )}
        
        {error && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              bgcolor: 'rgba(255, 0, 0, 0.7)',
              color: 'white',
              p: 2,
              borderRadius: 2,
              textAlign: 'center'
            }}
          >
            <Typography variant="h6">
              {error}
            </Typography>
          </Box>
        )}
        
        {/* Video remoto (grande) */}
        <Box sx={{ height: '100%', width: '100%', bgcolor: 'black', position: 'relative' }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: connectionStatus === 'connected' ? 'block' : 'none'
            }}
          />
          
           {/* Visualizza nome quando il video è spento */}
           {connectionStatus !== 'connected' && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  mb: 2
                }}
              >
                <Typography variant="h3" sx={{ color: 'white' }}>
                  {(user.displayName || user.username).charAt(0).toUpperCase()}
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ color: 'white' }}>
                {user.displayName || user.username}
              </Typography>
            </Box>
          )}
        </Box>
        
        {/* Video locale (piccolo) */}
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            width: 180,
            height: 240,
            bottom: 80,
            right: 16,
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: 3
          }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Effetto specchio
              display: !isVideoOff ? 'block' : 'none'
            }}
          />
          
          {/* Visualizza avatar quando il video è spento */}
          {isVideoOff && (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: 'grey.900',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Typography variant="h6" sx={{ color: 'white' }}>
                  You
                </Typography>
              </Box>
            </Box>
          )}
        </Paper>
        
        {/* Controlli chiamata */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 2,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            p: 1,
            borderRadius: 4
          }}
        >
          <IconButton
            onClick={toggleMute}
            sx={{
              bgcolor: isMuted ? 'error.main' : 'rgba(255, 255, 255, 0.2)',
              '&:hover': {
                bgcolor: isMuted ? 'error.dark' : 'rgba(255, 255, 255, 0.3)',
              },
              color: 'white',
            }}
          >
            {isMuted ? <MicOffIcon /> : <MicIcon />}
          </IconButton>
          
          <IconButton
            onClick={toggleVideo}
            sx={{
              bgcolor: isVideoOff ? 'error.main' : 'rgba(255, 255, 255, 0.2)',
              '&:hover': {
                bgcolor: isVideoOff ? 'error.dark' : 'rgba(255, 255, 255, 0.3)',
              },
              color: 'white',
            }}
          >
            {isVideoOff ? <VideocamOffIcon /> : <VideocamIcon />}
          </IconButton>
          
          <IconButton
            onClick={handleEndCall}
            sx={{
              bgcolor: 'error.main',
              '&:hover': {
                bgcolor: 'error.dark',
              },
              color: 'white',
            }}
          >
            <CallEndIcon />
          </IconButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default VideoCall;