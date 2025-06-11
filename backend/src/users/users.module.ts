import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [AuthService],
  exports: [AuthService]
})
export class UsersModule {} 