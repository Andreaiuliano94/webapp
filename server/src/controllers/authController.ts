import { Request, Response } from 'express';
import { authService } from '../services/authService';

// Registra un nuovo utente
export const register = async (req: Request, res: Response) => {
  const { username, email, password, displayName } = req.body;

  try {
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    const authResponse = await authService.register({
      username,
      email,
      password,
      displayName
    });

    
    res.cookie('token', authResponse.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

 
    res.status(201).json({
      message: authResponse.message,
      user: authResponse.user,
      token: authResponse.token
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof Error) {
      if (error.message === 'Username or email already exists') {
        return res.status(409).json({ message: error.message });
      }
    }
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login user
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const authResponse = await authService.login({ email, password });

 
    res.cookie('token', authResponse.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

   
    res.status(200).json({
      message: authResponse.message,
      user: authResponse.user,
      token: authResponse.token
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof Error) {
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Logout user
export const logout = async (req: Request, res: Response) => {
  try {
    
    if (req.user) {
      await authService.logout(req.user.id);
    }

    
    res.clearCookie('token');

    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};


export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { user } = await authService.getCurrentUser(req.user.id);
    res.status(200).json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return res.status(404).json({ message: 'User not found' });
      }
    }
    res.status(500).json({ message: 'Server error getting current user' });
  }
};