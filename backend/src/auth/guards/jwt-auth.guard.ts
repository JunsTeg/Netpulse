import { Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  handleRequest(err: any, user: any, info: any, context: any) {
    if (err || !user) {
      this.logger.error(`[GUARD] Échec de l'authentification: ${err?.message || 'Utilisateur non trouvé'}`);
      throw err || new Error('Utilisateur non authentifié');
    }

    this.logger.log(`[GUARD] Authentification réussie pour l'utilisateur ${user.id}`);
    return user;
  }
} 