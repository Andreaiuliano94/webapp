import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  TextField,
  Box,
  Typography,
  Divider,
  CircularProgress,
  IconButton
} from '@mui/material';
import { Close as CloseIcon, Search as SearchIcon } from '@mui/icons-material';
import { Message } from '../../types/message';
import { User } from '../../types/user';

interface ForwardDialogProps {
  open: boolean;
  message: Message;
  users: User[];
  onClose: () => void;
  onForward: (userId: number) => void;
}

const ForwardDialog = ({ open, message, users, onClose, onForward }: ForwardDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isForwarding, setIsForwarding] = useState(false);

  // Reset dello stato quando il dialog si apre
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelectedUserId(null);
      setIsForwarding(false);
    }
  }, [open]);

  // Filtra gli utenti in base al termine di ricerca
  const filteredUsers = users.filter(user => 
    (user.displayName || user.username).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Gestisce la selezione di un utente
  const handleUserSelect = (userId: number) => {
    setSelectedUserId(userId);
  };

  // Gestisce l'invio del messaggio
  const handleForward = async () => {
    if (selectedUserId) {
      setIsForwarding(true);
      try {
        await onForward(selectedUserId);
      } finally {
        setIsForwarding(false);
      }
    }
  };

  // Renderizza anteprima allegato se presente
  const renderAttachmentPreview = () => {
    if (!message.attachmentUrl || !message.attachmentType) return null;

    if (message.attachmentType.startsWith('image/')) {
      return (
        <Box sx={{ mt: 1, mb: 2 }}>
          <img 
            src={message.attachmentUrl} 
            alt="Immagine allegata"
            style={{ 
              maxWidth: '100%', 
              maxHeight: '150px', 
              borderRadius: '8px',
              display: 'block',
              margin: '0 auto'
            }} 
          />
        </Box>
      );
    }

    return (
      <Box 
        sx={{ 
          mt: 1, 
          mb: 2, 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center' 
        }}
      >
        <Box
          sx={{
            p: 1.5,
            bgcolor: 'action.hover',
            borderRadius: 1,
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          {message.attachmentType.includes('pdf') ? '📄' : '📎'} Allegato
        </Box>
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={isForwarding ? undefined : onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        Inoltra messaggio
        <IconButton
          aria-label="close"
          onClick={onClose}
          disabled={isForwarding}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Messaggio:
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              p: 2, 
              bgcolor: 'action.hover', 
              borderRadius: 1,
              maxHeight: '100px',
              overflow: 'auto'
            }}
          >
            {message.content}
          </Typography>
          
          {renderAttachmentPreview()}
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <TextField
          fullWidth
          label="Cerca utente"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
          }}
          disabled={isForwarding}
        />
        
        <List sx={{ 
          maxHeight: '300px', 
          overflow: 'auto', 
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1
        }}>
          {filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <ListItem key={user.id} disablePadding>
                <ListItemButton 
                  onClick={() => handleUserSelect(user.id)}
                  sx={{ 
                    cursor: 'pointer',
                    bgcolor: selectedUserId === user.id ? 'action.selected' : 'inherit',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                    borderRadius: 1,
                    mb: 0.5
                  }}
                  disabled={isForwarding}
                >
                  <ListItemAvatar>
                    <Avatar src={user.avatarUrl}>
                      {(user.displayName || user.username).charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={user.displayName || user.username}
                    secondary={user.status === 'ONLINE' ? 'Online' : 'Offline'}
                  />
                </ListItemButton>
              </ListItem>
            ))
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Nessun utente trovato
              </Typography>
            </Box>
          )}
        </List>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button 
          onClick={onClose} 
          color="inherit"
          disabled={isForwarding}
        >
          Annulla
        </Button>
        <Button
          onClick={handleForward}
          color="primary"
          variant="contained"
          disabled={!selectedUserId || isForwarding}
          startIcon={isForwarding ? <CircularProgress size={16} /> : null}
        >
          {isForwarding ? 'Inoltro...' : 'Inoltra'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForwardDialog;