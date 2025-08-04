import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class TempDirMiddleware {
  private readonly logger = new Logger(TempDirMiddleware.name);

  async onModuleInit() {
    await this.ensureTempDirectory();
  }

  private async ensureTempDirectory(): Promise<void> {
    const tempDir = path.join(process.cwd(), 'temp');
    
    try {
      // Vérification si le dossier existe
      try {
        await fs.access(tempDir);
        this.logger.log(`✅ Dossier temp existe: ${tempDir}`);
      } catch (error) {
        // Création du dossier
        await fs.mkdir(tempDir, { recursive: true });
        this.logger.log(`✅ Dossier temp créé: ${tempDir}`);
      }
      
      // Vérification des permissions
      try {
        await fs.access(tempDir, fs.constants.W_OK);
        this.logger.log('✅ Permissions d\'écriture OK sur le dossier temp');
      } catch (error) {
        this.logger.error(`❌ Erreur permissions d'écriture sur le dossier temp: ${error.message}`);
        throw new Error('Permissions insuffisantes sur le dossier temp');
      }
      
    } catch (error) {
      this.logger.error(`❌ Erreur configuration dossier temp: ${error.message}`);
      throw error;
    }
  }

  async cleanupOldTempFiles(): Promise<void> {
    const tempDir = path.join(process.cwd(), 'temp');
    
    try {
      const files = await fs.readdir(tempDir);
      const pythonFiles = files.filter(file => file.endsWith('.py'));
      
      if (pythonFiles.length > 0) {
        this.logger.log(`🧹 Nettoyage de ${pythonFiles.length} fichiers Python temporaires...`);
        
        for (const file of pythonFiles) {
          const filePath = path.join(tempDir, file);
          try {
            await fs.unlink(filePath);
          } catch (error) {
            this.logger.warn(`⚠️ Impossible de supprimer ${file}: ${error.message}`);
          }
        }
        this.logger.log('✅ Nettoyage des fichiers temporaires terminé');
      }
    } catch (error) {
      this.logger.warn(`⚠️ Erreur lors du nettoyage: ${error.message}`);
    }
  }
} 