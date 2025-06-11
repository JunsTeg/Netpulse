import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configuration du préfixe global pour toutes les routes
  app.setGlobalPrefix('api');
  
  // Configuration CORS pour le frontend
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  // Ajout d'un middleware pour logger les requêtes
  app.use((req, res, next) => {
    console.log('=== REQUETE BACKEND ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    next();
  });

  await app.listen(3001);
  console.log('Serveur démarré sur http://localhost:3001');
}
bootstrap();
