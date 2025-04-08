import { PrismaClient } from '@prisma/client';
import { UpdateProfileDto } from '../types/user';

const prisma = new PrismaClient();

export const userService = {
  getAllUsers: async (currentUserId: number) => {
    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUserId } // Escludi utente corrente
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        lastSeen: true
      },
      orderBy: {
        username: 'asc'
      }
    });

    return { users };
  },

  getUserById: async (userId: number) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        lastSeen: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new Error('Utente non trovato');
    }

    return { user };
  },

  updateProfile: async (userId: number, profileData: UpdateProfileDto) => {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: profileData.displayName,
        bio: profileData.bio
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        lastSeen: true
      }
    });

    return { user: updatedUser };
  },

  updateAvatar: async (userId: number, avatarUrl: string) => {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        username: true,
        avatarUrl: true
      }
    });

    return { user: updatedUser };
  }
};