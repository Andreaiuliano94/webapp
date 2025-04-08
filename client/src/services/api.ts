import axios from 'axios';

// Crea istanza axios
const api = axios.create({
  baseURL: '/api', // Usa URL relativo per sfruttare il proxy di Vite
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Includi cookie nelle richieste
});

// Aggiungi token alle richieste se disponibile
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Aggiungi interceptor di risposta per la gestione degli errori
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Registra dettagli errore per debug
    console.error('Errore API:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API Autenticazione
export const authAPI = {
  register: async (userData: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }) => {
    console.log('Registrazione utente con dati:', userData);
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  login: async (credentials: { email: string; password: string }) => {
    console.log('Login con:', credentials.email);
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// API Utenti
export const userAPI = {
  getAllUsers: async () => {
    const response = await api.get('/users');
    return response.data;
  },

  getUserById: async (id: number) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  updateProfile: async (profileData: {
    displayName?: string;
    bio?: string;
  }) => {
    const response = await api.patch('/users/profile', profileData);
    return response.data;
  },

  updateAvatar: async (formData: FormData) => {
    const response = await api.patch('/users/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// API Messaggi
export const messageAPI = {
  getMessages: async (userId: number, page = 1, limit = 50) => {
    const response = await api.get(`/messages/${userId}?page=${page}&limit=${limit}`);
    return response.data;
  },

  sendMessage: async (messageData: {
    receiverId: number;
    content: string;
  }) => {
    const response = await api.post('/messages', messageData);
    return response.data;
  },

  uploadAttachment: async (formData: FormData) => {
    const response = await api.post('/messages/attachment', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Export predefinito
export default api;