import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ExecutionManagerModule } from '../execution-manager/execution-manager.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'votre_secret_jwt_super_securise',
      signOptions: { expiresIn: '20h' },
    }),
    ExecutionManagerModule,
  ],
  controllers: [UsersController],
  providers: [AuthService],
  exports: [AuthService]
})
export class UsersModule {} 