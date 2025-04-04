// client/src/components/chat/MessageArea.tsx (versione corretta)
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, TextField, IconButton, Avatar, Paper, CircularProgress,
  Divider, AppBar, Toolbar,
} from '@mui/material';
import {
  Send as SendIcon, ArrowBack as ArrowBackIcon, AttachFile as AttachFileIcon,
  Videocam as VideocamIcon, FiberManualRecord as StatusIcon,
} from '@mui/icons-material';
import { User, UserStatus } from '../../types/user';
import { Message } from '../../types/message';
import { useAuth } from '../../hooks/useAuth';
import { useChat } from '../../context/ChatContext';
import MessageItem from './MessageItem';
import { format } from 'date-fns';

interface MessageAreaProps {
  selectedUser: User | null;
  onBackClick: () => void;
  isMobile: boolean;
}

const MessageArea = ({ selectedUser, onBackClick, isMobile }: MessageAreaProps) => {
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user: currentUser } = useAuth();
  
  // Usa i dati dal context invece di mantenere uno stato locale
  const { messages, loadingMessages, sendMessage, initiateCall } = useChat();

  // Funzione memoizzata per lo scroll
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Effetto per lo scroll quando i messaggi cambiano
  useEffect(() => {
    if (messages.length > 0 && !loadingMessages) {
      scrollToBottom();
    }
  }, [messages, loadingMessages, scrollToBottom]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !selectedUser || !currentUser) return;
    
    setSending(true);
    try {
      await sendMessage(inputMessage);
      setInputMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

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

  // Raggruppa i messaggi per data (calcolo fatto una volta sola)
  const groupedMessages = useCallback(() => {
    const groups: { [date: string]: Message[] } = {};
    
    messages.forEach((message) => {
      const date = format(new Date(message.createdAt), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  }, [messages]);

  // Memoizza il rendering dei gruppi di messaggi
  const renderMessageGroups = useCallback(() => {
    const groups = groupedMessages();
    
    return Object.entries(groups).map(([date, msgs]) => (
      <Box key={date}>
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <Typography
            variant="caption"
            sx={{
              bgcolor: 'background.paper',
              px: 2,
              py: 0.5,
              borderRadius: 4,
              boxShadow: 1,
            }}
          >
            {format(new Date(date), 'MMMM d, yyyy')}
          </Typography>
        </Box>
        {msgs.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isOwnMessage={message.senderId === currentUser?.id}
          />
        ))}
      </Box>
    ));
  }, [groupedMessages, currentUser?.id]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {selectedUser ? (
        <>
          {/* Header con info utente selezionato */}
          <AppBar position="static" color="default" elevation={0}>
            <Toolbar>
              {isMobile && (
                <IconButton edge="start" color="inherit" onClick={onBackClick} sx={{ mr: 1 }}>
                  <ArrowBackIcon />
                </IconButton>
              )}
              <Avatar
                src={selectedUser.avatarUrl}
                alt={selectedUser.displayName || selectedUser.username}
                sx={{ width: 40, height: 40, mr: 1.5 }}
              />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  {selectedUser.displayName || selectedUser.username}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: 'flex', alignItems: 'center' }}
                >
                  <StatusIcon
                    sx={{
                      color: getStatusColor(selectedUser.status),
                      fontSize: '0.8rem',
                      mr: 0.5,
                    }}
                  />
                  {selectedUser.status === UserStatus.ONLINE ? 'Online' : 'Offline'}
                </Typography>
              </Box>
              {selectedUser.status === UserStatus.ONLINE && (
                <IconButton color="primary" onClick={() => initiateCall()}>
                  <VideocamIcon />
                </IconButton>
              )}
            </Toolbar>
          </AppBar>

          {/* Area messaggi */}
          <Box
            sx={{
              flex: 1,
              p: 2,
              overflow: 'auto',
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {loadingMessages ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                <CircularProgress />
              </Box>
            ) : messages.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  No messages yet. Start a conversation!
                </Typography>
              </Box>
            ) : (
              renderMessageGroups()
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input messaggi */}
          <Paper
            component="form"
            onSubmit={handleSendMessage}
            elevation={1}
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <IconButton color="primary" component="label">
              <AttachFileIcon />
              <input type="file" hidden />
            </IconButton>
            <TextField
              fullWidth
              placeholder="Type a message..."
              variant="outlined"
              size="small"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={sending}
            />
            <IconButton
              color="primary"
              type="submit"
              disabled={!inputMessage.trim() || sending}
            >
              {sending ? <CircularProgress size={24} /> : <SendIcon />}
            </IconButton>
          </Paper>
        </>
      ) : (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            bgcolor: 'background.default',
          }}
        >
          <Box sx={{ textAlign: 'center', p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Welcome to RealTime Chat
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Select a user to start chatting
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default MessageArea;