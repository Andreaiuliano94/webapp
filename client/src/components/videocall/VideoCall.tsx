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
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Funzione di pulizia per rilasciare correttamente tutte le risorse
  const cleanup = () => {
    console.log('Esecuzione pulizia');
    
    // Ferma tutte le tracce multimediali
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => {
        console.log(`Fermando traccia ${track.kind}`);
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Pulisci elementi video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Reset dello stato
    setStream(null);
  };
  
  // Gestore per terminare la chiamata
  const handleEndCall = () => {
    console.log('Terminazione chiamata');
    cleanup();
    onClose();
  };
  
  // Attiva/disattiva microfono
  const toggleMute = () => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };
  
  // Attiva/disattiva video
  const toggleVideo = () => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };
  
  // Inizializza lo stream multimediale quando il dialog si apre
  useEffect(() => {
    // Non eseguire se il dialog non è aperto
    if (!isOpen) return;
    
    console.log('Inizializzando accesso ai media');
    
    let mounted = true;
    
    const initializeMedia = async () => {
      try {
        console.log('Richiesta accesso ai media');
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        // Controlla se il componente è ancora montato
        if (!mounted) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }
        
        console.log('Accesso ai media concesso');
        
        // Memorizza lo stream nello stato e nel ref
        setStream(mediaStream);
        streamRef.current = mediaStream;
        
        // Imposta lo stream negli elementi video
        if (localVideoRef.current) {
          console.log('Impostazione stream video locale');
          localVideoRef.current.srcObject = mediaStream;
        }
        
        // Per testare entrambi gli schermi, impostiamo lo stesso stream al video remoto
        // In un'app reale, questo sarebbe lo stream del peer remoto
        if (remoteVideoRef.current) {
          console.log('Impostazione stream video remoto (demo)');
          remoteVideoRef.current.srcObject = mediaStream;
        }
        
        // Aggiorna lo stato della connessione per l'interfaccia utente
        setConnectionStatus('connected');
        
      } catch (err) {
        console.error('Errore accesso ai dispositivi multimediali:', err);
        if (mounted) {
          setError(`Impossibile accedere alla fotocamera/microfono: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
        }
      }
    };
    
    initializeMedia();
    
    // Pulizia quando il componente si smonta o il dialog si chiude
    return () => {
      mounted = false;
      cleanup();
    };
  }, [isOpen]);
  
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
      TransitionProps={{
        onExited: () => {
          // Pulizia aggiuntiva all'uscita dal dialog
          cleanup();
        }
      }}
    >
      <DialogContent sx={{ p: 0, position: 'relative', height: '100%' }}>
        {/* Pulsante di chiusura */}
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
              Connessione a {user.displayName || user.username}...
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
        
        {/* Video remoto (sfondo grande) */}
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
          
          {/* Mostra avatar quando non connesso */}
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
        
        {/* Video locale (piccolo overlay) */}
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
          
          {/* Mostra avatar quando il video è spento */}
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
                  Tu
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