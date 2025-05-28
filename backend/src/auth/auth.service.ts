import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';
import { sequelize } from '../database';
import { QueryTypes } from 'sequelize';

// Interface pour typer les resultats de la base de donnees
interface UserRecord {
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
      throw new ConflictException('Username ou email deja utilise');
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
      'SELECT * FROM utilisateur WHERE username = :username AND isActive = true',
      {
        replacements: { username },
        type: QueryTypes.SELECT,
      },
    );

    const user = users[0];

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Verification du mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
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
      username
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
        throw new UnauthorizedException('Utilisateur non trouve ou desactive');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Token invalide');
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
      throw new UnauthorizedException('Utilisateur non trouve');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
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
} 