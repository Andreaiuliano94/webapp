// client/src/components/chat/MessageItem.tsx
import { useState, useContext } from 'react';
import { 
  Box, Typography, Avatar, Paper, IconButton, Menu, MenuItem, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button
} from '@mui/material';
import { 
  MoreVert as MoreVertIcon, 
  Check, DoneAll, 
  OpenInNew as OpenInNewIcon,
  FileDownload as DownloadIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { Message } from '../../types/message';
import { format } from 'date-fns';
import { ChatContext } from '../../context/ChatContext';
import axios from 'axios';
import ForwardDialog from './ForwardDialog';
import { useAuth } from '../../hooks/useAuth';

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
}

const MessageItem = ({ message, isOwnMessage }: MessageItemProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [forwardSuccess, setForwardSuccess] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { messages, setMessages, users } = useContext(ChatContext);
  const { user: currentUser } = useAuth();

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const formatMessageTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm');
  };

  // Gestisce l'eliminazione del messaggio
  const handleDeleteMessage = async () => {
    try {
      // Ottimisticamente rimuovi il messaggio dalla UI
      setMessages(messages.filter(msg => msg.id !== message.id));
      
      // Chiudi il menu
      handleMenuClose();
      
      // Chiamata API per eliminare il messaggio permanentemente
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
    }
  };

  // Gestisce la copia del messaggio
  const handleCopyMessage = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content)
        .then(() => {
          setCopySuccess(true);
        })
        .catch(err => {
          console.error('Errore durante la copia del testo:', err);
        });
    }
    handleMenuClose();
  };

  // Gestisce l'apertura del dialog di inoltro
  const handleForwardMessage = () => {
    setForwardDialogOpen(true);
    handleMenuClose();
  };

  // Gestisce l'inoltro effettivo a un utente selezionato
  const handleForwardToUser = async (userId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !currentUser) return;

      // Inoltra il messaggio usando lo stesso contenuto e allegati
      await axios.post('/api/messages', {
        receiverId: userId,
        content: message.content,
        attachmentUrl: message.attachmentUrl,
        attachmentType: message.attachmentType
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Chiudi il dialog di inoltro
      setForwardDialogOpen(false);
      
      // Mostra notifica di successo
      setForwardSuccess(true);
    } catch (error) {
      console.error('Errore durante l\'inoltro del messaggio:', error);
    }
  };

  // Gestisce il download del file
  const handleDownloadFile = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (message.attachmentUrl) {
      // Crea un link temporaneo per il download
      const link = document.createElement('a');
      link.href = message.attachmentUrl;
      
      // Estrai il nome del file dall'URL
      const fileName = message.attachmentUrl.split('/').pop() || 'file';
      link.download = fileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Gestisce l'apertura dell'anteprima del file
  const handleOpenPreview = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setPreviewOpen(true);
  };

  // Chiude l'anteprima del file
  const handleClosePreview = () => {
    setPreviewOpen(false);
  };

  // Apre il file in una nuova scheda (per file che si possono visualizzare nel browser)
  const handleOpenFile = () => {
    if (message.attachmentUrl) {
      window.open(message.attachmentUrl, '_blank');
    }
  };

  // Determinare se il contenuto del messaggio è diverso dal nome del file
  const isCustomMessage = () => {
    if (!message.content || !message.attachmentUrl) return false;
    const fileName = message.attachmentUrl.split('/').pop() || '';
    return message.content !== fileName;
  };

  // Renderizza l'anteprima del file per il dialog
  const renderFilePreview = () => {
    if (!message.attachmentUrl || !message.attachmentType) return null;

    if (message.attachmentType.startsWith('image/')) {
      return (
        <Box sx={{ textAlign: 'center', my: 2 }}>
          <img
            src={message.attachmentUrl}
            alt="Anteprima immagine"
            style={{ maxWidth: '100%', maxHeight: '500px', borderRadius: '8px' }}
          />
        </Box>
      );
    } else if (message.attachmentType === 'application/pdf') {
      return (
        <Box sx={{ textAlign: 'center', my: 2, height: '500px' }}>
          <iframe
            src={`${message.attachmentUrl}#view=fitH`}
            width="100%"
            height="100%"
            title="PDF Viewer"
            style={{ border: 'none', borderRadius: '8px' }}
          />
        </Box>
      );
    } else {
      return (
        <Box sx={{ textAlign: 'center', my: 2, p: 4 }}>
          <Typography variant="h6">
            Questo tipo di file non può essere visualizzato direttamente.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={() => handleDownloadFile()}
            sx={{ mt: 2 }}
          >
            Scarica File
          </Button>
        </Box>
      );
    }
  };

  // Renderizza il contenuto del messaggio in base al tipo
  const renderMessageContent = () => {
    // Check if it's a file/attachment
    if (message.attachmentUrl && message.attachmentType) {
      // Image
      if (message.attachmentType.startsWith('image/')) {
        return (
          <Box sx={{ mb: 1 }}>
            <Box 
              sx={{ 
                position: 'relative',
                '&:hover .file-actions': { 
                  opacity: 1 
                }
              }}
            >
              <img 
                src={message.attachmentUrl}
                alt="Image attachment"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: 300, 
                  borderRadius: 8,
                  display: 'block',
                  cursor: 'pointer'
                }}
                onClick={handleOpenPreview}
              />
              <Box 
                className="file-actions"
                sx={{ 
                  position: 'absolute', 
                  top: 8, 
                  right: 8, 
                  bgcolor: 'rgba(0,0,0,0.5)', 
                  borderRadius: 4,
                  opacity: 0,
                  transition: 'opacity 0.2s'
                }}
              >
                <IconButton 
                  size="small" 
                  sx={{ color: 'white' }}
                  onClick={handleOpenPreview}
                  title="Anteprima"
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
                <IconButton 
                  size="small" 
                  sx={{ color: 'white' }}
                  onClick={(e) => handleDownloadFile(e)}
                  title="Scarica"
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            {isCustomMessage() && (
              <Typography variant="body1" sx={{ mt: 1 }}>
                {message.content}
              </Typography>
            )}
          </Box>
        );
      }
      
      // PDF
      if (message.attachmentType === 'application/pdf') {
        return (
          <Box sx={{ mb: 1 }}>
            <Box 
              component="div"
              onClick={handleOpenPreview}
              sx={{ 
                p: 1.5, 
                bgcolor: 'action.hover', 
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.selected'
                }
              }}
            >
              <Box sx={{ fontSize: '1.5rem' }}>📄</Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  Documento PDF
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {message.attachmentUrl.split('/').pop()}
                </Typography>
              </Box>
              <IconButton 
                size="small" 
                onClick={(e) => handleDownloadFile(e)}
                title="Scarica"
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Box>
            {isCustomMessage() && (
              <Typography variant="body1" sx={{ mt: 1 }}>
                {message.content}
              </Typography>
            )}
          </Box>
        );
      }
      
      // Other file types
      return (
        <Box sx={{ mb: 1 }}>
          <Box 
            component="div"
            onClick={handleOpenFile}
            sx={{ 
              p: 1.5, 
              bgcolor: 'action.hover', 
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.selected'
              }
            }}
          >
            <Box sx={{ fontSize: '1.5rem' }}>📎</Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                Allegato
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {message.attachmentUrl.split('/').pop()}
              </Typography>
            </Box>
            <IconButton 
              size="small" 
              onClick={(e) => handleDownloadFile(e)}
              title="Scarica"
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Box>
          {isCustomMessage() && (
            <Typography variant="body1" sx={{ mt: 1 }}>
              {message.content}
            </Typography>
          )}
        </Box>
      );
    }
    
    // Regular text message
    return message.content;
  };

  return (
    <>
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
              <Box>
                {renderMessageContent()}
              </Box>

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
            {message.attachmentUrl && (
              <MenuItem onClick={() => handleDownloadFile()}>Scarica</MenuItem>
            )}
            {isOwnMessage && (
              <MenuItem onClick={handleDeleteMessage}>Elimina</MenuItem>
            )}
          </Menu>
        </Box>
      </Box>

      {/* Copy success notification */}
      <Snackbar 
        open={copySuccess} 
        autoHideDuration={3000} 
        onClose={() => setCopySuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setCopySuccess(false)} severity="success" sx={{ width: '100%' }}>
          Messaggio copiato negli appunti!
        </Alert>
      </Snackbar>
      
      {/* Forward success notification */}
      <Snackbar 
        open={forwardSuccess} 
        autoHideDuration={3000} 
        onClose={() => setForwardSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setForwardSuccess(false)} severity="success" sx={{ width: '100%' }}>
          Messaggio inoltrato con successo!
        </Alert>
      </Snackbar>

      {/* Forward dialog */}
      {forwardDialogOpen && (
        <ForwardDialog
          open={forwardDialogOpen}
          message={message}
          users={users}
          onClose={() => setForwardDialogOpen(false)}
          onForward={handleForwardToUser}
        />
      )}

      {/* File preview dialog */}
      <Dialog
        open={previewOpen}
        onClose={handleClosePreview}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Anteprima file
          <IconButton
            onClick={handleClosePreview}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {renderFilePreview()}
          {isCustomMessage() && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="body1">{message.content}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDownloadFile()} startIcon={<DownloadIcon />}>
            Scarica
          </Button>
          <Button onClick={handleClosePreview}>Chiudi</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MessageItem;