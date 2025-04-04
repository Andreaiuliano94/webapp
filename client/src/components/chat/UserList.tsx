// client/src/components/chat/UserList.tsx
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
  CircularProgress
} from '@mui/material';
import { 
  Search as SearchIcon, 
  MoreVert as MoreVertIcon,
  FiberManualRecord as StatusIcon,
  ExitToApp as LogoutIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { User, UserStatus } from '../../types/user';
import { formatDistanceToNow } from 'date-fns';
import { useChat } from '../../context/ChatContext';

interface UserListProps {
  selectedUser: User | null;
  onSelectUser: (user: User) => void;
  isMobile: boolean;
}

const UserList = ({ selectedUser, onSelectUser, isMobile }: UserListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { user: currentUser, logout } = useAuth();
  const { users, refreshUsers, unreadCounts } = useChat();

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

  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sort users: online first, then those with unread messages, then alphabetically
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    // Online users first
    if (a.status === UserStatus.ONLINE && b.status !== UserStatus.ONLINE) return -1;
    if (a.status !== UserStatus.ONLINE && b.status === UserStatus.ONLINE) return 1;
    
    // Then users with unread messages
    const aUnread = unreadCounts[a.id] || 0;
    const bUnread = unreadCounts[b.id] || 0;
    if (aUnread > 0 && bUnread === 0) return -1;
    if (aUnread === 0 && bUnread > 0) return 1;
    if (aUnread !== bUnread) return bUnread - aUnread;
    
    // Then alphabetically by display name or username
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
      {/* Header with current user info */}
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
              title="Refresh users"
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

      {/* Search bar */}
      <Box sx={{ p: 2 }}>
        <TextField
          placeholder="Search users..."
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

      {/* Users list */}
      <List sx={{ flex: 1, overflow: 'auto', px: 0 }}>
        {sortedUsers.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No users found
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
                  
                  {/* Show unread message count if any */}
                  {unreadCount > 0 && (
                    <Badge
                      badgeContent={unreadCount}
                      color="primary"
                      sx={{
                        '& .MuiBadge-badge': {
                          fontSize: '0.7rem',
                          minWidth: '20px',
                          height: '20px',
                          borderRadius: '10px',
                        }
                      }}
                    />
                  )}
                </ListItem>
                <Divider component="li" variant="inset" />
              </div>
            );
          })
        )}
      </List>
    </Box>
  );
};

export default UserList;