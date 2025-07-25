import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';
import { sequelize } from '../database';
import { QueryTypes } from 'sequelize';
import { UpdateUserDto } from '../users/dto/update-user.dto';

// Interface pour typer les resultats de la base de donnees
export interface UserRecord {
  id: string;
  username: string;
  email: string;
  password: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  // Methode pour enregistrer un nouvel utilisateur
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { username, email, password } = registerDto;

    // Verification si l'utilisateur existe deja
    const existingUsers = await sequelize.query<UserRecord>(
      'SELECT * FROM utilisateur WHERE username = :username OR email = :email',
      {
        replacements: { username, email },
        type: QueryTypes.SELECT,
      },
    );

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.username === username && existingUser.email === email) {
        throw new ConflictException('Ce nom d\'utilisateur et cette adresse email sont déjà utilisés');
      } else if (existingUser.username === username) {
        throw new ConflictException('Ce nom d\'utilisateur est déjà pris');
      } else {
        throw new ConflictException('Cette adresse email est déjà utilisée');
      }
    }

    // Hashage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Creation de l'utilisateur
    const userId = uuidv4();
    await sequelize.query(
      'INSERT INTO utilisateur (id, username, email, password, isActive) VALUES (:id, :username, :email, :password, true)',
      {
        replacements: {
          id: userId,
          username,
          email,
          password: hashedPassword,
        },
        type: QueryTypes.INSERT,
      },
    );

    // Generation du token
    const token = this.generateToken(userId, username);

    return {
      access_token: token,
      user: {
        id: userId,
        username,
        email,
      },
    };
  }

  // Methode pour connecter un utilisateur
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { username, password } = loginDto;

    // Recherche de l'utilisateur
    const users = await sequelize.query<UserRecord>(
      'SELECT * FROM utilisateur WHERE username = :username',
      {
        replacements: { username },
        type: QueryTypes.SELECT,
      },
    );

    const user = users[0];

    if (!user) {
      throw new UnauthorizedException({
        message: 'Nom d\'utilisateur incorrect',
        error: 'Unauthorized'
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        message: 'Ce compte a été désactivé',
        error: 'Unauthorized'
      });
    }

    // Verification du mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException({
        message: 'Mot de passe incorrect',
        error: 'Unauthorized'
      });
    }

    // Mise a jour de lastLoginAt
    await sequelize.query(
      'UPDATE utilisateur SET lastLoginAt = CURRENT_TIMESTAMP WHERE id = :id',
      {
        replacements: { id: user.id },
        type: QueryTypes.UPDATE,
      },
    );

    // Generation du token
    const token = this.generateToken(user.id, user.username);

    return {
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  }

  // Methode pour generer un token JWT
  private generateToken(userId: string, username: string): string {
    const payload = { 
      sub: userId, 
      username,
      iat: Math.floor(Date.now() / 1000), // Timestamp de création
      jti: uuidv4() // Identifiant unique du token
    };
    return this.jwtService.sign(payload);
  }

  // Methode pour verifier un token
  async validateToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      
      // Verification supplementaire de l'utilisateur
      const users = await sequelize.query<UserRecord>(
        'SELECT * FROM utilisateur WHERE id = :id AND isActive = true',
        {
          replacements: { id: payload.sub },
          type: QueryTypes.SELECT,
        },
      );

      if (!users[0]) {
        throw new UnauthorizedException('Session invalide : utilisateur non trouvé');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Session expirée ou invalide');
    }
  }

  // Methode pour desactiver un compte
  async deactivateAccount(userId: string): Promise<void> {
    await sequelize.query(
      'UPDATE utilisateur SET isActive = false WHERE id = :id',
      {
        replacements: { id: userId },
        type: QueryTypes.UPDATE,
      },
    );
  }

  // Methode pour changer le mot de passe
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const users = await sequelize.query<UserRecord>(
      'SELECT * FROM utilisateur WHERE id = :id AND isActive = true',
      {
        replacements: { id: userId },
        type: QueryTypes.SELECT,
      },
    );

    const user = users[0];

    if (!user) {
      throw new UnauthorizedException('Compte non trouvé');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Le mot de passe actuel est incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await sequelize.query(
      'UPDATE utilisateur SET password = :password WHERE id = :id',
      {
        replacements: { 
          id: userId,
          password: hashedNewPassword,
        },
        type: QueryTypes.UPDATE,
      },
    );
  }

  // Methode pour recuperer tous les utilisateurs
  async getAllUsers(): Promise<UserRecord[]> {
    try {
      console.log('🔍 Tentative de récupération de tous les utilisateurs...');
      
      const users = await sequelize.query<UserRecord>(
        'SELECT id, username, email, isActive, createdAt, lastLoginAt FROM utilisateur',
        {
          type: QueryTypes.SELECT,
        },
      );
      
      console.log(`✅ ${users.length} utilisateurs récupérés avec succès`);
      return users;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', error);
      throw new Error(`Erreur lors de la récupération des utilisateurs: ${error.message}`);
    }
  }

  // Methode pour recuperer un utilisateur par son ID
  async getUserById(id: string): Promise<UserRecord> {
    const users = await sequelize.query<UserRecord>(
      'SELECT id, username, email, isActive, createdAt, lastLoginAt FROM utilisateur WHERE id = :id',
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      },
    );
    if (users.length === 0) {
      throw new UnauthorizedException('Utilisateur non trouve');
    }
    return users[0];
  }

  // Methode pour mettre a jour un utilisateur
  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserRecord> {
    const { username, email, password } = updateUserDto;
    const updateFields = [];
    const replacements: any = { id };

    if (username) {
      updateFields.push('username = :username');
      replacements.username = username;
    }
    if (email) {
      updateFields.push('email = :email');
      replacements.email = email;
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password = :password');
      replacements.password = hashedPassword;
    }

    if (updateFields.length === 0) {
      return this.getUserById(id);
    }

    await sequelize.query(
      `UPDATE utilisateur SET ${updateFields.join(', ')} WHERE id = :id`,
      {
        replacements,
        type: QueryTypes.UPDATE,
      },
    );

    return this.getUserById(id);
  }

  // Methode pour supprimer un utilisateur
  async deleteUser(id: string): Promise<void> {
    await sequelize.query(
      'DELETE FROM utilisateur WHERE id = :id',
      {
        replacements: { id },
        type: QueryTypes.DELETE,
      },
    );
  }
} 