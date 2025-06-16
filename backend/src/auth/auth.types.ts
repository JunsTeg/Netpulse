import { Request } from 'express';

// Types pour le module d'authentification
export interface User {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

// Type pour la requête avec utilisateur authentifié
export interface RequestWithUser extends Request {
  user: User;
} 