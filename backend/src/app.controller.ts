import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Endpoint de test pour verifier la connexion
  @Get('test')
  testConnection() {
    return {
      status: 'success',
      message: 'Connexion au backend reussie!',
      timestamp: new Date().toISOString(),
    };
  }

  // Endpoint de test pour verifier les donnees POST
  @Post('test')
  @HttpCode(200)
  testPost(@Body() data: any) {
    return {
      status: 'success',
      message: 'Donnees recues avec succes!',
      receivedData: data,
      timestamp: new Date().toISOString(),
    };
  }
}
