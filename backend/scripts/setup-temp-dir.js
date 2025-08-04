#!/usr/bin/env node

/**
 * Script de configuration du dossier temp pour les services Python
 * Netpulse - Backend
 */

const fs = require('fs').promises;
const path = require('path');

async function setupTempDirectory() {
  const tempDir = path.join(process.cwd(), 'temp');
  
  try {
    console.log('🔧 Configuration du dossier temp...');
    
    // Vérification si le dossier existe
    try {
      await fs.access(tempDir);
      console.log('✅ Dossier temp existe déjà');
    } catch (error) {
      // Création du dossier
      await fs.mkdir(tempDir, { recursive: true });
      console.log(`✅ Dossier temp créé: ${tempDir}`);
    }
    
    // Vérification des permissions
    try {
      await fs.access(tempDir, fs.constants.W_OK);
      console.log('✅ Permissions d\'écriture OK');
    } catch (error) {
      console.error('❌ Erreur permissions d\'écriture sur le dossier temp');
      process.exit(1);
    }
    
    // Nettoyage des anciens fichiers temporaires (optionnel)
    try {
      const files = await fs.readdir(tempDir);
      const pythonFiles = files.filter(file => file.endsWith('.py'));
      
      if (pythonFiles.length > 0) {
        console.log(`🧹 Nettoyage de ${pythonFiles.length} fichiers Python temporaires...`);
        
        for (const file of pythonFiles) {
          const filePath = path.join(tempDir, file);
          try {
            await fs.unlink(filePath);
          } catch (error) {
            console.warn(`⚠️ Impossible de supprimer ${file}: ${error.message}`);
          }
        }
        console.log('✅ Nettoyage terminé');
      }
    } catch (error) {
      console.warn(`⚠️ Erreur lors du nettoyage: ${error.message}`);
    }
    
    console.log('🎉 Configuration du dossier temp terminée avec succès');
    
  } catch (error) {
    console.error(`❌ Erreur lors de la configuration: ${error.message}`);
    process.exit(1);
  }
}

// Exécution si le script est appelé directement
if (require.main === module) {
  setupTempDirectory();
}

module.exports = { setupTempDirectory }; 