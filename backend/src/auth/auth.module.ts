import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersModule } from '../users/users.module';
import { ExecutionManagerModule } from '../execution-manager/execution-manager.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'votre_secret_jwt_super_securise',
      signOptions: { expiresIn: '20h' },
    }),
    forwardRef(() => UsersModule),
    ExecutionManagerModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService],
})
export class AuthModule {} 