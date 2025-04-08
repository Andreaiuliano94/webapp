import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Avatar,
  IconButton,
  CircularProgress,
  Alert,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import axios from 'axios';

interface ProfileSettingsProps {
  open: boolean;
  onClose: () => void;
}

const ProfileSettings = ({ open, onClose }: ProfileSettingsProps) => {
  const { user, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Aggiornamento dei campi quando l'utente cambia
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Verifica dimensione file (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError("L'immagine è troppo grande. Dimensione massima: 2MB");
        return;
      }
      
      // Verifica formato file
      if (!file.type.startsWith('image/')) {
        setError("Formato file non supportato. Carica un'immagine.");
        return;
      }
      
      setSelectedFile(file);
      
      // Crea anteprima
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSaveChanges = async () => {
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Token non trovato');
      
      // Gestione del profilo (displayName, bio)
      if (displayName !== user?.displayName || bio !== user?.bio) {
        await axios.patch('/api/users/profile', 
          { displayName: displayName.trim() || undefined, bio: bio.trim() || undefined },
          { headers: { Authorization: `Bearer ${token}` }}
        );
      }
      
      // Gestione dell'avatar
      if (selectedFile) {
        const formData = new FormData();
        formData.append('avatar', selectedFile);
        
        await axios.patch('/api/users/avatar', 
          formData,
          { 
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      }
      
      setSuccess('Profilo aggiornato con successo!');
      
      // Ricarica le informazioni dell'utente dopo 1 secondo
      setTimeout(() => {
        window.location.reload(); // Soluzione temporanea per aggiornare il context
      }, 1000);
    } catch (error) {
      console.error('Errore aggiornamento profilo:', error);
      setError('Si è verificato un errore durante l\'aggiornamento del profilo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={isSaving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Impostazioni Profilo
        <IconButton
          onClick={onClose}
          disabled={isSaving}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Immagine Profilo
          </Typography>
          
          <Box sx={{ position: 'relative' }}>
            <Avatar 
              src={previewImage || user?.avatarUrl}
              alt={user?.displayName || user?.username}
              sx={{ width: 100, height: 100, mb: 1 }}
            />
            
            <Tooltip title="Cambia immagine">
              <IconButton
                color="primary"
                onClick={handleSelectImage}
                disabled={isSaving}
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                  '&:hover': { bgcolor: 'background.paper' }
                }}
              >
                <PhotoCameraIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Typography variant="caption" color="text.secondary">
            Formato: JPG, PNG. Max 2MB
          </Typography>
          
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleFileChange}
          />
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <TextField
          label="Nome visualizzato"
          fullWidth
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          margin="normal"
          disabled={isSaving}
          helperText="Questo è il nome che vedranno gli altri utenti"
        />
        
        <TextField
          label="Bio"
          fullWidth
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          margin="normal"
          multiline
          rows={3}
          disabled={isSaving}
          helperText="Breve descrizione su di te (opzionale)"
        />
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={onClose}
          disabled={isSaving}
          color="inherit"
        >
          Annulla
        </Button>
        <Button
          onClick={handleSaveChanges}
          color="primary"
          variant="contained"
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {isSaving ? 'Salvataggio...' : 'Salva modifiche'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProfileSettings;