// client/src/components/chat/MessageArea.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, TextField, IconButton, Avatar, Paper, CircularProgress,
  AppBar, Toolbar, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  List, ListItem, ListItemText, ListItemIcon, Snackbar, Alert, Popover} from '@mui/material';
import {
  Send as SendIcon, ArrowBack as ArrowBackIcon, AttachFile as AttachFileIcon,
  Videocam as VideocamIcon, FiberManualRecord as StatusIcon,
  Close as CloseIcon, InsertDriveFile as FileIcon, Image as ImageIcon,
  PictureAsPdf as PdfIcon, EmojiEmotions as EmojiIcon
} from '@mui/icons-material';
import { User, UserStatus } from '../../types/user';
import { Message } from '../../types/message';
import { useAuth } from '../../hooks/useAuth';
import { useChat } from '../../context/ChatContext';
import MessageItem from './MessageItem';
import { format } from 'date-fns';
import axios from 'axios';
// Nota: Dovrai installare questa libreria
// npm install emoji-picker-react
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface MessageAreaProps {
  selectedUser: User | null;
  onBackClick: () => void;
  isMobile: boolean;
}

const MessageArea = ({ selectedUser, onBackClick, isMobile }: MessageAreaProps) => {
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const { user: currentUser } = useAuth();
  
  // Utilizza i dati dal context
  const { messages, loadingMessages, sendMessage, initiateCall } = useChat();

  // Gestione emoji picker
  const handleEmojiPickerOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setEmojiAnchorEl(event.currentTarget);
  };

  const handleEmojiPickerClose = () => {
    setEmojiAnchorEl(null);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const cursorPosition = textFieldRef.current?.selectionStart || inputMessage.length;
    const newMessage = 
      inputMessage.slice(0, cursorPosition) + 
      emoji + 
      inputMessage.slice(cursorPosition);
    setInputMessage(newMessage);
    handleEmojiPickerClose();
    // Restituisci il focus all'input di testo
    setTimeout(() => {
      if (textFieldRef.current) {
        textFieldRef.current.focus();
        textFieldRef.current.selectionStart = cursorPosition + emoji.length;
        textFieldRef.current.selectionEnd = cursorPosition + emoji.length;
      }
    }, 100);
  };

  // Funzione per lo scroll
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
    
    if ((!inputMessage.trim() && !selectedFile) || !selectedUser || !currentUser) return;
    
    setSending(true);
    try {
      // Se c'è un file, caricalo prima
      if (selectedFile) {
        await handleUploadFile();
        return; // Il processo di upload del file gestirà l'invio del messaggio
      }
      
      // Altrimenti invia solo il messaggio di testo
      await sendMessage(inputMessage);
      setInputMessage('');
    } catch (error) {
      console.error('Errore invio messaggio:', error);
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Verifica della dimensione del file (massimo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError("Il file è troppo grande. La dimensione massima è 10MB.");
        return;
      }
      
      setSelectedFile(file);
      setFilePreviewOpen(true);
      // Reset della didascalia quando si apre un nuovo file
      setCaption('');
    }
  };

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleCloseFilePreview = () => {
    setFilePreviewOpen(false);
    // Non resettiamo il file selezionato, così l'utente può ancora inviarlo
    setUploadError(null);
  };
  
  // Funzione per annullare completamente la selezione del file
  const handleCancelFileSelection = () => {
    setFilePreviewOpen(false);
    setSelectedFile(null);
    setUploadError(null);
    setCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile || !selectedUser || !currentUser) return;
    
    setFileUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('receiverId', selectedUser.id.toString());
      
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Token non trovato');
      
      // Carica il file
      const uploadResponse = await axios.post('/api/messages/attachment', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Crea e invia il messaggio con allegato
      const { attachmentUrl, attachmentType } = uploadResponse.data.data;
      
      // Usa la didascalia se presente, altrimenti usa l'input message o il nome del file
      const messageContent = caption.trim() || inputMessage.trim() || selectedFile.name;
      
      // Invia il messaggio con allegato
      await sendMessage(messageContent, attachmentUrl, attachmentType);
      
      // Resetta gli stati
      setInputMessage('');
      setCaption('');
      setSelectedFile(null);
      setFilePreviewOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Errore caricamento file:', error);
      setUploadError("Errore durante il caricamento del file. Riprova.");
    } finally {
      setFileUploading(false);
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

  // Raggruppa i messaggi per data
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

  // Helper per renderizzare l'icona di anteprima del file
  const renderFileIcon = () => {
    if (!selectedFile) return null;
    
    const fileType = selectedFile.type;
    
    if (fileType.startsWith('image/')) {
      return <ImageIcon fontSize="large" color="primary" />;
    } else if (fileType === 'application/pdf') {
      return <PdfIcon fontSize="large" color="error" />;
    } else {
      return <FileIcon fontSize="large" color="info" />;
    }
  };

  // Helper per renderizzare il contenuto dell'anteprima del file
  const renderFilePreview = () => {
    if (!selectedFile) return null;
    
    const fileType = selectedFile.type;
    
    if (fileType.startsWith('image/')) {
      return (
        <Box sx={{ textAlign: 'center', my: 2 }}>
          <img
            src={URL.createObjectURL(selectedFile)}
            alt="Anteprima"
            style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
          />
        </Box>
      );
    } else {
      return (
        <List>
          <ListItem>
            <ListItemIcon>{renderFileIcon()}</ListItemIcon>
            <ListItemText 
              primary={selectedFile.name} 
              secondary={`${(selectedFile.size / 1024).toFixed(2)} KB`} 
            />
          </ListItem>
        </List>
      );
    }
  };

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
                  Non ci sono messaggi. Inizia una conversazione!
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
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
              accept="image/*,application/pdf,application/msword,application/vnd.ms-excel,text/plain,application/zip"
            />
            
            <IconButton 
              color={selectedFile ? "success" : "primary"} 
              onClick={selectedFile ? () => setFilePreviewOpen(true) : handleFileSelect} 
              disabled={sending || fileUploading}
              sx={{ position: 'relative' }}
              title={selectedFile ? "Visualizza anteprima file" : "Allega file"}
            >
              <AttachFileIcon />
              {selectedFile && (
                <Box
                  component="span"
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                  }}
                />
              )}
            </IconButton>
            
            {/* Bottone emoji */}
            <IconButton
              color="primary"
              onClick={handleEmojiPickerOpen}
              disabled={sending || fileUploading}
              title="Inserisci emoji"
            >
              <EmojiIcon />
            </IconButton>
            
            {/* Picker emoji popup */}
            <Popover
              open={Boolean(emojiAnchorEl)}
              anchorEl={emojiAnchorEl}
              onClose={handleEmojiPickerClose}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'center',
              }}
              transformOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
              }}
            >
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </Popover>
            
            <TextField
              fullWidth
              placeholder={selectedFile 
                ? `Messaggio con file: ${selectedFile.name.length > 15 
                  ? selectedFile.name.substring(0, 15) + '...' 
                  : selectedFile.name}` 
                : "Scrivi un messaggio..."}
              variant="outlined"
              size="small"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={sending || fileUploading}
              inputRef={textFieldRef}
              InputProps={{
                endAdornment: selectedFile ? (
                  <IconButton 
                    size="small" 
                    edge="end" 
                    onClick={handleCancelFileSelection}
                    sx={{ mr: -0.5 }}
                    title="Rimuovi file"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                ) : null
              }}
            />
            
            <IconButton
              color="primary"
              type="submit"
              disabled={(!inputMessage.trim() && !selectedFile) || sending || fileUploading}
              title="Invia messaggio"
            >
              {sending || fileUploading ? <CircularProgress size={24} /> : <SendIcon />}
            </IconButton>
          </Paper>
          
          {/* Dialog anteprima file */}
          <Dialog
            open={filePreviewOpen}
            onClose={handleCloseFilePreview}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              Anteprima File: {selectedFile?.name}
              <IconButton
                onClick={handleCloseFilePreview}
                sx={{ position: 'absolute', right: 8, top: 8 }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            
            <DialogContent>
              {renderFilePreview()}
              
              {uploadError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {uploadError}
                </Alert>
              )}
              
              {/* Campo separato per la didascalia */}
              <TextField
                fullWidth
                placeholder="Aggiungi una didascalia (opzionale)"
                variant="outlined"
                size="small"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={fileUploading}
                sx={{ mt: 2 }}
                helperText={caption ? `Didascalia: ${caption}` : "Il testo apparirà sotto il file inviato"}
                InputProps={{
                  endAdornment: (
                    <IconButton
                      color="primary"
                      onClick={handleEmojiPickerOpen}
                      size="small"
                      title="Inserisci emoji"
                    >
                      <EmojiIcon fontSize="small" />
                    </IconButton>
                  )
                }}
              />
              
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px dashed', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Anteprima messaggio:</strong>
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ mr: 1 }}>{renderFileIcon()}</Box>
                  <Typography variant="body2">{selectedFile?.name}</Typography>
                </Box>
                {caption && (
                  <Typography variant="body1" sx={{ mt: 1, fontWeight: 'medium' }}>
                    {caption}
                  </Typography>
                )}
              </Box>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={handleCancelFileSelection} color="inherit">
                Annulla selezione
              </Button>
              <Button onClick={handleCloseFilePreview} color="secondary">
                Chiudi anteprima
              </Button>
              <Button
                onClick={handleUploadFile}
                color="primary"
                variant="contained"
                disabled={fileUploading}
                startIcon={fileUploading ? <CircularProgress size={20} /> : null}
              >
                {fileUploading ? 'Invio in corso...' : 'Invia'}
              </Button>
            </DialogActions>
          </Dialog>
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
              Benvenuto in RealTime Chat
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Seleziona un utente per iniziare a chattare
            </Typography>
          </Box>
        </Box>
      )}
      
      {/* Snackbar per errori di upload */}
      <Snackbar
        open={!!uploadError}
        autoHideDuration={5000}
        onClose={() => setUploadError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setUploadError(null)} severity="error">
          {uploadError}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MessageArea;