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

      // Vérification de l'expiration (double vérification)
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp && currentTime > payload.exp) {
        this.logger.error(`[JWT] Token expiré: exp=${payload.exp}, current=${currentTime}`);
        throw new UnauthorizedException('Token expiré');
      }

      // Retour de l'utilisateur avec les informations du payload
      const user = {
        id: payload.sub,
        username: payload.username,
      };
      
      this.logger.log(`[JWT] Token validé pour l'utilisateur ${user.id} (jti: ${payload.jti || 'N/A'})`);
      return user;
    } catch (error) {
      this.logger.error(`[JWT] Erreur validation token: ${error.message}`);
      throw new UnauthorizedException('Token invalide');
    }
  }
} 