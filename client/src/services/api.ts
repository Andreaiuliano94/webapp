// client/src/services/api.ts
import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: '/api', // Use relative URL to leverage Vite's proxy
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies in requests
});

// Add token to requests if available
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

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log error details for debugging
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  register: async (userData: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }) => {
    console.log('Registering user with data:', userData);
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  login: async (credentials: { email: string; password: string }) => {
    console.log('Logging in with:', credentials.email);
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

// User API
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

// Message API
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

// Default export
export default api;