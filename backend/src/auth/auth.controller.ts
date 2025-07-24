import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request, Inject } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { API_PREFIXES, API_ROUTES, API_RESPONSES } from '../config/api.config';
import { Public } from './decorators/public.decorator';
import { ExecutionManagerService } from '../execution-manager/execution-manager.service';
import { UserTask } from '../execution-manager/tasks/user.task';

@Controller(API_PREFIXES.AUTH)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(ExecutionManagerService)
    private readonly executionManager: ExecutionManagerService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req): Promise<{ message: string, taskId: string }> {
    const userId = req.user?.id;
    const task = new UserTask(
      () => Promise.resolve({ message: API_RESPONSES.SUCCESS.OK }),
      { userId, priority: 10 }
    );
    this.executionManager.submit(task);
    this.executionManager.disconnect(); // Arrêt global sur logout
    return { message: API_RESPONSES.SUCCESS.OK, taskId: task.id };
  }

  @Post('validate-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async validateToken(@Request() req): Promise<{ valid: boolean }> {
    return { valid: true };
  }
} 