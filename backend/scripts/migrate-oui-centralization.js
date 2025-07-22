#!/usr/bin/env node

/**
 * Script de migration pour centraliser la gestion OUI
 * Ce script met à jour tous les services pour utiliser les nouveaux services centralisés
 */

const fs = require('fs');
const path = require('path');

// Configuration des fichiers à migrer
const filesToMigrate = [
  'src/modules/network/agents/python-advanced.service.ts',
  'src/modules/network/agents/windows-powershell.service.ts',
  'src/modules/network/agents/router-query.service.ts'
];

// Patterns de remplacement
const replacements = [
  {
    // Supprimer les imports fs et path pour oui-db
    pattern: /import \* as fs from ['"]fs['"];?\s*\nimport \* as path from ['"]path['"];?/g,
    replacement: ''
  },
  {
    // Supprimer le chargement local de oui-db.json
    pattern: /\/\/ --- Ajout: Chargement du fichier oui-db\.json ---\s*const ouiDbPath = path\.resolve\(__dirname, '\.\.\/\.\.\/\.\.\/utils\/oui-db\.json'\)\s*let ouiDb: Record<string, string> = \{\}\s*try \{\s*const ouiRaw = fs\.readFileSync\(ouiDbPath, 'utf-8'\)\s*ouiDb = JSON\.parse\(ouiRaw\)\s*\} catch \(err\) \{\s*console\.error\('\[OUI\] Erreur chargement oui-db\.json:', err\.message\)\s*ouiDb = \{\}\s*\}/g,
    replacement: ''
  },
  {
    // Ajouter les imports des services centralisés
    pattern: /import \{ Injectable, Logger \} from ['"]@nestjs\/common['"];?/g,
    replacement: `import { Injectable, Logger } from '@nestjs/common';
import { OuiService } from '../services/oui.service';
import { DeviceTypeService } from '../services/device-type.service';`
  },
  {
    // Mettre à jour le constructeur pour injecter les services
    pattern: /constructor\(\s*([^)]*)\)\s*\{\s*\}/g,
    replacement: (match, params) => {
      const newParams = params.trim() ? `${params.trim()}, private readonly ouiService: OuiService, private readonly deviceTypeService: DeviceTypeService` : 'private readonly ouiService: OuiService, private readonly deviceTypeService: DeviceTypeService';
      return `constructor(${newParams}) {}`;
    }
  },
  {
    // Remplacer les appels à getDeviceTypeFromMacLocal
    pattern: /const ouiType = getDeviceTypeFromMacLocal\(macAddress\)/g,
    replacement: 'const detectionResult = this.deviceTypeService.detectDeviceType({ macAddress })'
  },
  {
    // Remplacer les appels à mapStringToDeviceType
    pattern: /deviceType = this\.mapStringToDeviceType\(ouiType\)/g,
    replacement: 'deviceType = detectionResult.deviceType'
  },
  {
    // Remplacer les appels directs à ouiDb
    pattern: /const ouiType = ouiDb\[macAddress\.slice\(0, 8\)\.toUpperCase\(\)\]/g,
    replacement: 'const vendorInfo = this.ouiService.getVendorInfo(macAddress)'
  },
  {
    // Supprimer les fonctions locales getDeviceTypeFromMacLocal
    pattern: /\/\/ --- Ajout: Fonction locale pour déterminer le constructeur à partir de l'adresse MAC ---[\s\S]*?function getDeviceTypeFromMacLocal[\s\S]*?return ouiDb\[oui\]\s*\}/g,
    replacement: ''
  }
];

function migrateFile(filePath) {
  console.log(`\n🔧 Migration de ${filePath}...`);
  
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ Fichier non trouvé: ${fullPath}`);
      return false;
    }

    let content = fs.readFileSync(fullPath, 'utf-8');
    let hasChanges = false;

    // Appliquer tous les remplacements
    replacements.forEach((replacement, index) => {
      const newContent = content.replace(replacement.pattern, replacement.replacement);
      if (newContent !== content) {
        content = newContent;
        hasChanges = true;
        console.log(`  ✅ Remplacement ${index + 1} appliqué`);
      }
    });

    if (hasChanges) {
      // Sauvegarder le fichier original
      const backupPath = `${fullPath}.backup`;
      fs.writeFileSync(backupPath, fs.readFileSync(fullPath, 'utf-8'));
      console.log(`  💾 Sauvegarde créée: ${backupPath}`);

      // Écrire le nouveau contenu
      fs.writeFileSync(fullPath, content);
      console.log(`  ✅ Fichier migré avec succès`);
      return true;
    } else {
      console.log(`  ℹ️  Aucun changement nécessaire`);
      return false;
    }

  } catch (error) {
    console.error(`  ❌ Erreur lors de la migration: ${error.message}`);
    return false;
  }
}

function updatePackageJson() {
  console.log('\n📦 Mise à jour du package.json...');
  
  try {
    const packagePath = path.resolve('package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    
    // Ajouter le script de migration
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    packageJson.scripts['migrate:oui'] = 'node scripts/migrate-oui-centralization.js';
    packageJson.scripts['postbuild'] = 'npm run copy:assets';
    
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('  ✅ package.json mis à jour');
    
  } catch (error) {
    console.error(`  ❌ Erreur lors de la mise à jour du package.json: ${error.message}`);
  }
}

function createMigrationLog() {
  const log = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    description: 'Migration vers la centralisation OUI',
    filesMigrated: [],
    errors: []
  };

  filesToMigrate.forEach(file => {
    const success = migrateFile(file);
    log.filesMigrated.push({
      file,
      success,
      timestamp: new Date().toISOString()
    });
  });

  // Sauvegarder le log
  const logPath = path.resolve('migration-oui-log.json');
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`\n📋 Log de migration sauvegardé: ${logPath}`);

  return log;
}

// Fonction principale
function main() {
  console.log('🚀 Démarrage de la migration OUI centralisée...\n');
  
  const log = createMigrationLog();
  updatePackageJson();
  
  const successCount = log.filesMigrated.filter(f => f.success).length;
  const totalCount = log.filesMigrated.length;
  
  console.log(`\n📊 Résumé de la migration:`);
  console.log(`  ✅ Fichiers migrés avec succès: ${successCount}/${totalCount}`);
  console.log(`  ❌ Échecs: ${totalCount - successCount}`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 Migration terminée avec succès !');
    console.log('\n📝 Prochaines étapes:');
    console.log('  1. Vérifier que tous les services utilisent les nouveaux services centralisés');
    console.log('  2. Tester les fonctionnalités de détection de type d\'appareil');
    console.log('  3. Supprimer les anciennes fonctions de mapping si nécessaire');
    console.log('  4. Mettre à jour la documentation');
  } else {
    console.log('\n⚠️  Migration partiellement réussie. Vérifiez les erreurs ci-dessus.');
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

module.exports = { migrateFile, createMigrationLog, main }; 