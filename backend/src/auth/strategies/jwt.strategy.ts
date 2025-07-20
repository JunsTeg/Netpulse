import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { sequelize } from '../../database';
import { QueryTypes } from 'sequelize';

// Interface pour typer l'utilisateur retourné par la base de données
interface UserFromDB {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'votre_secret_jwt_super_securise',
    });
  }

  async validate(payload: any) {
    try {
      // Vérification que le payload contient les informations nécessaires
      if (!payload.sub || !payload.username) {
        this.logger.error(`[JWT] Token invalide: informations manquantes (sub: ${payload.sub}, username: ${payload.username})`);
        throw new UnauthorizedException('Token invalide: informations manquantes');
      }

      // Vérification de l'expiration (double vérification)
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp && currentTime > payload.exp) {
        this.logger.error(`[JWT] Token expiré: exp=${payload.exp}, current=${currentTime}`);
        throw new UnauthorizedException('Token expiré');
      }

      // Log du payload pour debug
      this.logger.log(`[JWT] Validation du token pour l'utilisateur: ${payload.sub} (${payload.username})`);

      // Vérification de l'existence de l'utilisateur dans la base de données
      const users = await sequelize.query(
        'SELECT * FROM utilisateur WHERE id = :id AND isActive = true',
        {
          replacements: { id: payload.sub },
          type: QueryTypes.SELECT,
        },
      ) as UserFromDB[];

      this.logger.log(`[JWT] Résultat de la requête SQL: ${users.length} utilisateur(s) trouvé(s)`);

      if (!users[0]) {
        this.logger.error(`[JWT] Utilisateur non trouvé ou inactif: ${payload.sub}`);
        
        // Vérification supplémentaire : chercher l'utilisateur sans condition isActive
        const allUsers = await sequelize.query(
          'SELECT * FROM utilisateur WHERE id = :id',
          {
            replacements: { id: payload.sub },
            type: QueryTypes.SELECT,
          },
        ) as UserFromDB[];
        
        if (allUsers.length === 0) {
          this.logger.error(`[JWT] Aucun utilisateur trouvé avec l'ID: ${payload.sub}`);
        } else {
          this.logger.error(`[JWT] Utilisateur trouvé mais inactif: ${payload.sub}, isActive: ${allUsers[0].isActive}`);
        }
        
        throw new UnauthorizedException('Utilisateur non trouvé ou compte désactivé');
      }

      // Retour de l'utilisateur avec les informations du payload et de la base de données
      const user = {
        id: payload.sub,
        username: payload.username,
        email: users[0].email,
        isActive: users[0].isActive
      };
      
      this.logger.log(`[JWT] Token validé pour l'utilisateur ${user.id} (jti: ${payload.jti || 'N/A'})`);
      return user;
    } catch (error) {
      this.logger.error(`[JWT] Erreur validation token: ${error.message}`);
      throw new UnauthorizedException('Token invalide');
    }
  }
} 