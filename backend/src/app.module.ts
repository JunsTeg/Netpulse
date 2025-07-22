import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NetworkModule } from './modules/network/network.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TopologyModule } from './modules/topology';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    UsersModule,
    NetworkModule,
    TopologyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Désactiver temporairement le guard global pour tester
    // {
    //   provide: APP_GUARD,
    //   useClass: JwtAuthGuard,
    // }
  ],
})
export class AppModule {}
