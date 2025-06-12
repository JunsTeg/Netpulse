import { Controller, Get, Put, UseGuards, Request, Body, Delete, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthService, UserRecord } from '../auth/auth.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { API_PREFIXES, API_ROUTES, API_RESPONSES } from '../config/api.config';

@Controller(API_PREFIXES.USERS)
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllUsers(): Promise<UserRecord[]> {
    return this.authService.getAllUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserById(@Param('id') id: string): Promise<UserRecord> {
    return this.authService.getUserById(id);
  }

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

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto): Promise<UserRecord> {
    return this.authService.updateUser(id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteUser(@Param('id') id: string): Promise<{ message: string }> {
    await this.authService.deleteUser(id);
    return { message: API_RESPONSES.SUCCESS.DELETED };
  }
} 