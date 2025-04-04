// server/src/services/authService.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RegisterUserDto, LoginDto, AuthResponse } from '../types/auth';

const prisma = new PrismaClient();

export const authService = {
  register: async (userData: RegisterUserDto): Promise<AuthResponse> => {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: userData.username },
          { email: userData.email }
        ]
      }
    });

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        displayName: userData.displayName || userData.username,
      },
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName || undefined,
        avatarUrl: user.avatarUrl || undefined,
        status: user.status,
      },
      token,
      message: 'User registered successfully'
    };
  },

  login: async (credentials: LoginDto): Promise<AuthResponse> => {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: credentials.email }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isMatch = await bcrypt.compare(credentials.password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    // Update user status
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ONLINE', lastSeen: new Date() }
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName || undefined,
        avatarUrl: user.avatarUrl || undefined,
        status: user.status,
      },
      token,
      message: 'Login successful'
    };
  },

  logout: async (userId: number): Promise<void> => {
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'OFFLINE', lastSeen: new Date() }
    });
  },

  getCurrentUser: async (userId: number) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        lastSeen: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return { user };
  }
};