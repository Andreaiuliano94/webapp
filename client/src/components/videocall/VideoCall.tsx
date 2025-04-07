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
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Cleanup function to properly release all resources
  const cleanup = () => {
    console.log('Performing cleanup');
    
    // Stop all media tracks
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => {
        console.log(`Stopping ${track.kind} track`);
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Reset state
    setStream(null);
  };
  
  // Handler for ending the call
  const handleEndCall = () => {
    console.log('Ending call');
    cleanup();
    onClose();
  };
  
  // Toggle microphone mute
  const toggleMute = () => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };
  
  // Toggle video on/off
  const toggleVideo = () => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };
  
  // Initialize media stream when the dialog opens
  useEffect(() => {
    // Don't run if dialog is not open
    if (!isOpen) return;
    
    console.log('Initializing media access');
    
    let mounted = true;
    
    const initializeMedia = async () => {
      try {
        console.log('Requesting media access');
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        // Check if component is still mounted
        if (!mounted) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }
        
        console.log('Media access granted');
        
        // Store the stream in state and ref
        setStream(mediaStream);
        streamRef.current = mediaStream;
        
        // Set stream to video elements
        if (localVideoRef.current) {
          console.log('Setting local video stream');
          localVideoRef.current.srcObject = mediaStream;
        }
        
        // To test both screens, we'll set the same stream to remote video
        // In a real app, this would be the remote peer's stream
        if (remoteVideoRef.current) {
          console.log('Setting remote video stream (demo)');
          remoteVideoRef.current.srcObject = mediaStream;
        }
        
        // Update connection status for UI
        setConnectionStatus('connected');
        
      } catch (err) {
        console.error('Error accessing media devices:', err);
        if (mounted) {
          setError(`Could not access camera/microphone: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    };
    
    initializeMedia();
    
    // Cleanup when component unmounts or dialog closes
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
          // Additional cleanup on dialog exit
          cleanup();
        }
      }}
    >
      <DialogContent sx={{ p: 0, position: 'relative', height: '100%' }}>
        {/* Close button */}
        <IconButton
          sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0, 0, 0, 0.5)', zIndex: 2 }}
          onClick={handleEndCall}
        >
          <CloseIcon sx={{ color: 'white' }} />
        </IconButton>
        
        {/* Connection status and errors */}
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
        
        {/* Remote video (large background) */}
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
          
          {/* Show avatar when not connected */}
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
        
        {/* Local video (small overlay) */}
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
              transform: 'scaleX(-1)', // Mirror effect
              display: !isVideoOff ? 'block' : 'none'
            }}
          />
          
          {/* Show avatar when video is off */}
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
        
        {/* Call controls */}
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