import { Controller, Get, Put, UseGuards, Request, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthService, UserRecord } from '../auth/auth.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req): Promise<UserRecord> {
    return this.authService.getUserById(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto): Promise<UserRecord> {
    return this.authService.updateUser(req.user.id, updateUserDto);
  }
} 