import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'votre_secret_jwt_super_securise',
    });
  }

  async validate(payload: any) {
    try {
      // Verification supplementaire si necessaire
      return {
        id: payload.sub,
        username: payload.username,
      };
    } catch (error) {
      throw new UnauthorizedException('Token invalide');
    }
  }
} 