// client/src/components/chat/MessageItem.tsx
import { useState, useContext } from 'react';
import { Box, Typography, Avatar, Paper, IconButton, Menu, MenuItem } from '@mui/material';
import { MoreVert as MoreVertIcon, Check, DoneAll } from '@mui/icons-material';
import { Message } from '../../types/message';
import { format } from 'date-fns';
import { ChatContext } from '../../context/ChatContext';
import axios from 'axios';

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
}

const MessageItem = ({ message, isOwnMessage }: MessageItemProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { messages, setMessages } = useContext(ChatContext);

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const formatMessageTime = (dateString: string) => {
    return format(new Date(dateString), 'h:mm a');
  };

  // Gestisci l'eliminazione del messaggio
  const handleDeleteMessage = async () => {
    try {
      // Ottimisticamente rimuovi il messaggio dalla UI
      setMessages(messages.filter(msg => msg.id !== message.id));
      
      // Chiudi il menu
      handleMenuClose();
      
      // Opzionale: chiamata API per eliminare il messaggio permanentemente
      const token = localStorage.getItem('token');
      if (token) {
        await axios.delete(`/api/messages/${message.id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Errore durante l\'eliminazione del messaggio:', error);
      // In caso di errore, ripristina il messaggio nella lista
      // Questo è opzionale e dipende dal comportamento desiderato
    }
  };

  // Gestisci la copia del messaggio
  const handleCopyMessage = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
    handleMenuClose();
  };

  // Gestisci l'inoltro del messaggio (per ora solo chiude il menu)
  const handleForwardMessage = () => {
    // Qui dovresti implementare la logica per l'inoltro del messaggio
    // Per ora chiudiamo solo il menu
    handleMenuClose();
  };

  // Handle different types of message content
  const renderMessageContent = () => {
    // Check if it's a file/attachment
    if (message.attachmentUrl && message.attachmentType) {
      // Image
      if (message.attachmentType.startsWith('image/')) {
        return (
          <Box sx={{ mb: 1 }}>
            <img 
              src={message.attachmentUrl}
              alt="Image attachment"
              style={{ 
                maxWidth: '100%', 
                maxHeight: 300, 
                borderRadius: 8,
                display: 'block' 
              }}
            />
          </Box>
        );
      }
      
      // PDF
      if (message.attachmentType === 'application/pdf') {
        return (
          <Box sx={{ mb: 1 }}>
            <a 
              href={message.attachmentUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center',
                textDecoration: 'none',
                color: 'inherit' 
              }}
            >
              <Box 
                component="span" 
                sx={{ 
                  p: 1, 
                  bgcolor: 'action.hover', 
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                📄 PDF Document
              </Box>
            </a>
          </Box>
        );
      }
      
      // Other file types
      return (
        <Box sx={{ mb: 1 }}>
          <a 
            href={message.attachmentUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center',
              textDecoration: 'none',
              color: 'inherit' 
            }}
          >
            <Box 
              component="span" 
              sx={{ 
                p: 1, 
                bgcolor: 'action.hover', 
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              📎 Attachment
            </Box>
          </a>
        </Box>
      );
    }
    
    // Regular text message
    return message.content;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
        mb: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          maxWidth: '70%',
          alignItems: 'flex-start',
          gap: 1,
        }}
      >
        {!isOwnMessage && (
          <Avatar
            src={message.sender?.avatarUrl}
            alt={message.sender?.username}
            sx={{ width: 36, height: 36 }}
          />
        )}

        <Box>
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: isOwnMessage ? 'primary.main' : 'background.paper',
              color: isOwnMessage ? 'primary.contrastText' : 'text.primary',
              boxShadow: 1,
              position: 'relative',
              ...(isOwnMessage && {
                borderBottomRightRadius: 0,
              }),
              ...(!isOwnMessage && {
                borderBottomLeftRadius: 0,
              }),
            }}
          >
            {/* Message content */}
            <Typography variant="body1">
              {renderMessageContent()}
            </Typography>

            {/* Time and read status */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                mt: 0.5,
                gap: 0.5,
              }}
            >
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {formatMessageTime(message.createdAt)}
              </Typography>
              {isOwnMessage && (
                message.isRead ? (
                  <DoneAll fontSize="small" sx={{ opacity: 0.7 }} />
                ) : (
                  <Check fontSize="small" sx={{ opacity: 0.7 }} />
                )
              )}
            </Box>
          </Paper>
        </Box>

        {/* Message actions menu */}
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          sx={{
            opacity: 0.6,
            '&:hover': {
              opacity: 1,
            },
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleCopyMessage}>Copia</MenuItem>
          <MenuItem onClick={handleForwardMessage}>Inoltra</MenuItem>
          {isOwnMessage && (
            <MenuItem onClick={handleDeleteMessage}>Elimina</MenuItem>
          )}
        </Menu>
      </Box>
    </Box>
  );
};

export default MessageItem;