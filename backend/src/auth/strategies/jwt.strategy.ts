import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

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

      // Retour de l'utilisateur avec les informations du payload
      const user = {
        id: payload.sub,
        username: payload.username,
      };
      
      this.logger.log(`[JWT] Token validé pour l'utilisateur ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`[JWT] Erreur validation token: ${error.message}`);
      throw new UnauthorizedException('Token invalide');
    }
  }
} 