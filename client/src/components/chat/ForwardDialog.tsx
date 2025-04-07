// client/src/components/chat/ForwardDialog.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  TextField,
  Box,
  Typography,
  Divider
} from '@mui/material';
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

  // Filtra gli utenti in base al termine di ricerca
  const filteredUsers = users.filter(user => 
    (user.displayName || user.username).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Gestisce la selezione di un utente
  const handleUserSelect = (userId: number) => {
    setSelectedUserId(userId);
  };

  // Gestisce l'invio del messaggio
  const handleForward = () => {
    if (selectedUserId) {
      onForward(selectedUserId);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Inoltra messaggio</DialogTitle>
      <DialogContent>
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
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <TextField
          fullWidth
          label="Cerca utente"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
        />
        
        <List sx={{ maxHeight: '300px', overflow: 'auto' }}>
          {filteredUsers.map((user) => (
            <ListItem 
              key={user.id}
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
            </ListItem>
          ))}
          
          {filteredUsers.length === 0 && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Nessun utente trovato
              </Typography>
            </Box>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Annulla
        </Button>
        <Button
          onClick={handleForward}
          color="primary"
          variant="contained"
          disabled={!selectedUserId}
        >
          Inoltra
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForwardDialog;