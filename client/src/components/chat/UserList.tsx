import { useState } from 'react';
import { 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemAvatar, 
  ListItemText, 
  Avatar, 
  Divider, 
  TextField, 
  InputAdornment,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Tooltip
} from '@mui/material';
import { 
  Search as SearchIcon, 
  MoreVert as MoreVertIcon,
  FiberManualRecord as StatusIcon,
  ExitToApp as LogoutIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { User, UserStatus } from '../../types/user';
import { formatDistanceToNow } from 'date-fns';
import { useChat } from '../../context/ChatContext';
import axios from 'axios';
import ProfileSettings from '../profile/ProfileSettings';

interface UserListProps {
  selectedUser: User | null;
  onSelectUser: (user: User) => void;
  isMobile: boolean;
}

const UserList = ({ selectedUser, onSelectUser, isMobile }: UserListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUserForMenu, setSelectedUserForMenu] = useState<User | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  
  const { user: currentUser, logout } = useAuth();
  const { users, refreshUsers, unreadCounts, setMessages } = useChat();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
  };
  
  const handleRefreshUsers = async () => {
    setIsRefreshing(true);
    try {
      await refreshUsers();
    } catch (error) {
      console.error('Failed to refresh users:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Gestione del profilo
  const handleOpenProfileDialog = () => {
    handleMenuClose();
    setProfileDialogOpen(true);
  };

  const handleCloseProfileDialog = () => {
    setProfileDialogOpen(false);
  };

  // Apre il menu di un utente specifico
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>, user: User) => {
    event.stopPropagation(); // Previene la selezione dell'utente
    setUserMenuAnchorEl(event.currentTarget);
    setSelectedUserForMenu(user);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
    setSelectedUserForMenu(null);
  };

  // Apre il dialog di conferma per eliminare una chat
  const handleDeleteChatRequest = (userId: number) => {
    handleUserMenuClose();
    setDeletingUserId(userId);
    setDeleteDialogOpen(true);
  };

  // Chiude il dialog di conferma per eliminare una chat
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeletingUserId(null);
  };

  // Elimina effettivamente una chat
  const handleDeleteChat = async () => {
    if (!deletingUserId) return;
    
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      if (token) {
        console.log(`Deleting conversation with user ID: ${deletingUserId}`);
        
        // Log della richiesta
        console.log(`Making DELETE request to: /api/messages/conversation/${deletingUserId}`);
        console.log(`With token: ${token.substring(0, 10)}...`);
        
        const response = await axios.delete(`/api/messages/conversation/${deletingUserId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        console.log('Delete response:', response.data);
        
        // Se l'utente eliminato è quello selezionato, pulisci i messaggi
        if (selectedUser && selectedUser.id === deletingUserId) {
          setMessages([]);
          console.log('Cleared messages in UI');
        }
        
        handleCloseDeleteDialog();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      // Mostra l'errore all'utente
      alert(`Errore nell'eliminazione: ${(error as any)?.response?.data?.message || 'Errore sconosciuto'}`);
    } finally {
      setIsDeleting(false);
    }
  };
  // Filtra gli utenti in base al termine di ricerca
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Ordina gli utenti: prima gli online, poi quelli con messaggi non letti, poi in ordine alfabetico
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    // Prima gli utenti online
    if (a.status === UserStatus.ONLINE && b.status !== UserStatus.ONLINE) return -1;
    if (a.status !== UserStatus.ONLINE && b.status === UserStatus.ONLINE) return 1;
    
    // Poi gli utenti con messaggi non letti
    const aUnread = unreadCounts[a.id] || 0;
    const bUnread = unreadCounts[b.id] || 0;
    if (aUnread > 0 && bUnread === 0) return -1;
    if (aUnread === 0 && bUnread > 0) return 1;
    if (aUnread !== bUnread) return bUnread - aUnread;
    
    // Infine in ordine alfabetico per nome visualizzato o username
    const aName = a.displayName || a.username;
    const bName = b.displayName || b.username;
    return aName.localeCompare(bName);
  });

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ONLINE:
        return 'success.main';
      case UserStatus.AWAY:
        return 'warning.main';
      case UserStatus.BUSY:
        return 'error.main';
      default:
        return 'grey.500';
    }
  };

  const getLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Unknown';
    
    try {
      return `Last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`;
    } catch (error) {
      return 'Recently';
    }
  };

  return (
    <Box 
      sx={{ 
        width: isMobile ? '100%' : 320, 
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper'
      }}
    >
      {/* Header con info utente corrente */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="div">
            Chats
          </Typography>
          <Box>
            <IconButton
              aria-label="refresh"
              onClick={handleRefreshUsers}
              disabled={isRefreshing}
              size="small"
              sx={{ mr: 1 }}
              title="Aggiorna lista"
            >
              {isRefreshing ? (
                <CircularProgress size={20} />
              ) : (
                <RefreshIcon />
              )}
            </IconButton>
            <IconButton
              aria-label="menu"
              aria-controls="user-menu"
              aria-haspopup="true"
              onClick={handleMenuOpen}
              size="small"
              title="Menu"
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              id="user-menu"
              anchorEl={anchorEl}
              keepMounted
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleOpenProfileDialog}>
                <EditIcon fontSize="small" sx={{ mr: 1 }} />
                Modifica profilo
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {currentUser && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar 
              src={currentUser.avatarUrl} 
              alt={currentUser.displayName || currentUser.username}
              sx={{ width: 40, height: 40, mr: 1 }}
            />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {currentUser.displayName || currentUser.username}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                <StatusIcon 
                  sx={{ 
                    color: 'success.main', 
                    fontSize: '0.8rem',
                    mr: 0.5
                  }} 
                />
                online
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Barra di ricerca */}
      <Box sx={{ p: 2 }}>
        <TextField
          placeholder="Cerca utenti..."
          fullWidth
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Lista utenti */}
      <List sx={{ flex: 1, overflow: 'auto', px: 0 }}>
        {sortedUsers.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Nessun utente trovato
            </Typography>
          </Box>
        ) : (
          sortedUsers.map((user) => {
            const unreadCount = unreadCounts[user.id] || 0;
            
            return (
              <div key={user.id}>
                <ListItem 
                  alignItems="flex-start"
                  sx={{ 
                    px: 2, 
                    py: 1.5,
                    cursor: 'pointer',
                    bgcolor: selectedUser?.id === user.id ? 'action.selected' : 'inherit',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                    position: 'relative',
                  }}
                  onClick={() => onSelectUser(user)}
                >
                  <ListItemAvatar>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        <StatusIcon 
                          sx={{ 
                            color: getStatusColor(user.status), 
                            bgcolor: 'background.paper',
                            borderRadius: '50%',
                            fontSize: '0.8rem'
                          }} 
                        />
                      }
                    >
                      <Avatar 
                        src={user.avatarUrl} 
                        alt={user.displayName || user.username}
                      />
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography 
                        component="span" 
                        variant="subtitle2" 
                        color="text.primary"
                        sx={{ fontWeight: unreadCount > 0 ? 'bold' : 'normal' }}
                      >
                        {user.displayName || user.username}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontWeight: unreadCount > 0 ? 'medium' : 'normal' }}
                      >
                        {user.status === UserStatus.ONLINE 
                          ? 'Online' 
                          : getLastSeen(user.lastSeen)
                        }
                      </Typography>
                    }
                  />
                  
                  {/* Menu per le azioni sulla chat */}
                  <Box 
                    sx={{ 
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {/* Mostra conteggio messaggi non letti se presenti */}
                    {unreadCount > 0 && (
                      <Badge
                        badgeContent={unreadCount}
                        color="primary"
                        sx={{
                          mr: 1,
                          '& .MuiBadge-badge': {
                            fontSize: '0.7rem',
                            minWidth: '20px',
                            height: '20px',
                            borderRadius: '10px',
                          }
                        }}
                      />
                    )}
                    
                    <Tooltip title="Opzioni chat">
                      <IconButton
                        size="small"
                        onClick={(e) => handleUserMenuOpen(e, user)}
                        sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>
                <Divider component="li" variant="inset" />
              </div>
            );
          })
        )}
      </List>
      
      {/* Menu per le azioni sull'utente */}
      <Menu
        anchorEl={userMenuAnchorEl}
        open={Boolean(userMenuAnchorEl)}
        onClose={handleUserMenuClose}
      >
        <MenuItem 
          onClick={() => selectedUserForMenu && handleDeleteChatRequest(selectedUserForMenu.id)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Elimina chat
        </MenuItem>
      </Menu>
      
      {/* Dialog conferma eliminazione chat */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Conferma eliminazione</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare questa chat? Tutti i messaggi verranno rimossi e questa azione non può essere annullata.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteDialog} 
            color="inherit"
            disabled={isDeleting}
          >
            Annulla
          </Button>
          <Button 
            onClick={handleDeleteChat} 
            color="error" 
            variant="contained"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {isDeleting ? 'Eliminazione...' : 'Elimina'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog impostazioni profilo */}
      {profileDialogOpen && (
        <ProfileSettings 
          open={profileDialogOpen}
          onClose={handleCloseProfileDialog}
        />
      )}
    </Box>
  );
};

export default UserList;