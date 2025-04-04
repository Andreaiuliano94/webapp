// client/src/components/videocall/IncomingCallDialog.tsx
import React from 'react';
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  Avatar,
  Button,
} from '@mui/material';
import {
  Call as CallIcon,
  CallEnd as CallEndIcon,
} from '@mui/icons-material';

interface IncomingCallDialogProps {
  open: boolean;
  username: string;
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallDialog: React.FC<IncomingCallDialogProps> = ({
  open,
  username,
  onAccept,
  onReject,
}) => {
  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 10,
        },
      }}
    >
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              mb: 3,
              color: 'text.secondary',
              fontWeight: 500,
              animation: 'pulse 1.5s infinite',
              '@keyframes pulse': {
                '0%': {
                  opacity: 0.6,
                },
                '50%': {
                  opacity: 1,
                },
                '100%': {
                  opacity: 0.6,
                },
              },
            }}
          >
            Incoming Video Call
          </Typography>

          <Avatar
            sx={{
              width: 80,
              height: 80,
              mb: 2,
              bgcolor: 'primary.main',
              animation: 'scale 1s infinite alternate',
              '@keyframes scale': {
                '0%': {
                  transform: 'scale(1)',
                },
                '100%': {
                  transform: 'scale(1.1)',
                },
              },
            }}
          >
            {username.charAt(0).toUpperCase()}
          </Avatar>

          <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold' }}>
            {username}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            is calling you...
          </Typography>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 3,
              width: '100%',
            }}
          >
            <Button
              variant="contained"
              color="error"
              startIcon={<CallEndIcon />}
              onClick={onReject}
              sx={{
                borderRadius: 4,
                px: 3,
                py: 1,
              }}
            >
              Decline
            </Button>

            <Button
              variant="contained"
              color="success"
              startIcon={<CallIcon />}
              onClick={onAccept}
              sx={{
                borderRadius: 4,
                px: 3,
                py: 1,
              }}
              autoFocus
            >
              Accept
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default IncomingCallDialog;