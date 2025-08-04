#!/usr/bin/env node

/**
 * Script de vérification et création des tables MVP Stats
 * Netpulse - Backend
 */

const { sequelize } = require('../src/database');
const { QueryTypes } = require('sequelize');

async function checkAndCreateMvpTables() {
  try {
    console.log('🔍 Vérification des tables MVP Stats...');
    
    // Vérifier si les tables existent
    const tables = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'netpulse' 
      AND TABLE_NAME IN ('mvp_stats_collection', 'mvp_device_stats', 'mvp_anomalies')
    `, { type: QueryTypes.SELECT });
    
    const existingTables = tables.map(t => t.TABLE_NAME);
    console.log(`📋 Tables existantes: ${existingTables.join(', ')}`);
    
    // Créer les tables manquantes
    const requiredTables = ['mvp_stats_collection', 'mvp_device_stats', 'mvp_anomalies'];
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.log(`⚠️ Tables manquantes: ${missingTables.join(', ')}`);
      console.log('🔧 Création des tables manquantes...');
      
      // Créer mvp_stats_collection si manquante
      if (!existingTables.includes('mvp_stats_collection')) {
        await sequelize.query(`
          CREATE TABLE mvp_stats_collection (
            id varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Identifiant unique de la collection',
            timestamp datetime NOT NULL COMMENT 'Timestamp de la collection',
            total_devices int NOT NULL COMMENT 'Nombre total d\'appareils',
            active_devices int NOT NULL COMMENT 'Nombre d\'appareils actifs',
            failed_devices int NOT NULL COMMENT 'Nombre d\'appareils en échec',
            avg_cpu decimal(5,2) NOT NULL COMMENT 'CPU moyen (%)',
            avg_memory decimal(10,2) NOT NULL COMMENT 'Mémoire moyenne (MB)',
            avg_bandwidth decimal(10,2) NOT NULL COMMENT 'Bande passante moyenne (Mbps)',
            avg_latency decimal(10,2) NOT NULL COMMENT 'Latence moyenne (ms)',
            total_anomalies int NOT NULL COMMENT 'Nombre total d\'anomalies',
            collection_duration int NOT NULL COMMENT 'Durée de collecte (ms)',
            raw_data json DEFAULT NULL COMMENT 'Données brutes de la collection',
            created_at datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
            PRIMARY KEY (id),
            KEY idx_mvp_collection_created_at (created_at),
            KEY idx_mvp_collection_timestamp (timestamp),
            KEY idx_mvp_collection_active_devices (active_devices)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Collections de statistiques MVP'
        `);
        console.log('✅ Table mvp_stats_collection créée');
      }
      
      // Créer mvp_device_stats si manquante
      if (!existingTables.includes('mvp_device_stats')) {
        await sequelize.query(`
          CREATE TABLE mvp_device_stats (
            id varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Identifiant unique',
            stats_id varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID de la collection parente',
            device_id varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID de l\'appareil',
            hostname varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nom d\'hôte',
            ip_address varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Adresse IP',
            device_type varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type d\'appareil',
            cpu_usage decimal(5,2) NOT NULL COMMENT 'Utilisation CPU (%)',
            memory_usage decimal(10,2) NOT NULL COMMENT 'Utilisation mémoire (MB)',
            bandwidth_download decimal(10,2) NOT NULL COMMENT 'Bande passante download (Mbps)',
            bandwidth_upload decimal(10,2) NOT NULL COMMENT 'Bande passante upload (Mbps)',
            latency decimal(10,2) NOT NULL COMMENT 'Latence (ms)',
            jitter decimal(10,2) DEFAULT NULL COMMENT 'Jitter (ms)',
            packet_loss decimal(5,2) DEFAULT NULL COMMENT 'Perte de paquets (%)',
            collection_status varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Statut de collecte',
            collection_time int NOT NULL COMMENT 'Temps de collecte (ms)',
            anomalies_count int NOT NULL DEFAULT 0 COMMENT 'Nombre d\'anomalies',
            raw_data json DEFAULT NULL COMMENT 'Données brutes de l\'appareil',
            created_at datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
            PRIMARY KEY (id),
            KEY idx_mvp_device_stats_id (stats_id),
            KEY idx_mvp_device_device_id (device_id),
            KEY idx_mvp_device_created_at (created_at),
            KEY idx_mvp_device_collection_status (collection_status),
            KEY idx_mvp_device_cpu_usage (cpu_usage),
            KEY idx_mvp_device_memory_usage (memory_usage),
            KEY idx_mvp_device_latency (latency),
            FOREIGN KEY (stats_id) REFERENCES mvp_stats_collection(id) ON DELETE CASCADE,
            FOREIGN KEY (device_id) REFERENCES appareils(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Statistiques détaillées par appareil (MVP)'
        `);
        console.log('✅ Table mvp_device_stats créée');
      }
      
      // Créer mvp_anomalies si manquante
      if (!existingTables.includes('mvp_anomalies')) {
        await sequelize.query(`
          CREATE TABLE mvp_anomalies (
            id varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Identifiant unique',
            stats_id varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID de la collection parente',
            device_id varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID de l\'appareil (optionnel)',
            type varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type d\'anomalie',
            severity varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Sévérité',
            message text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Message d\'anomalie',
            threshold decimal(10,2) NOT NULL COMMENT 'Seuil déclencheur',
            current_value decimal(10,2) NOT NULL COMMENT 'Valeur actuelle',
            timestamp datetime NOT NULL COMMENT 'Timestamp de détection',
            created_at datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
            PRIMARY KEY (id),
            KEY idx_mvp_anomalies_stats_id (stats_id),
            KEY idx_mvp_anomalies_device_id (device_id),
            KEY idx_mvp_anomalies_type (type),
            KEY idx_mvp_anomalies_severity (severity),
            KEY idx_mvp_anomalies_created_at (created_at),
            KEY idx_mvp_anomalies_timestamp (timestamp),
            FOREIGN KEY (stats_id) REFERENCES mvp_stats_collection(id) ON DELETE CASCADE,
            FOREIGN KEY (device_id) REFERENCES appareils(id) ON DELETE SET NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Anomalies détectées par MVP Stats'
        `);
        console.log('✅ Table mvp_anomalies créée');
      }
      
    } else {
      console.log('✅ Toutes les tables MVP Stats existent déjà');
    }
    
    // Vérifier les données existantes
    const statsCount = await sequelize.query(`
      SELECT COUNT(*) as count FROM mvp_stats_collection
    `, { type: QueryTypes.SELECT });
    
    const deviceStatsCount = await sequelize.query(`
      SELECT COUNT(*) as count FROM mvp_device_stats
    `, { type: QueryTypes.SELECT });
    
    const anomaliesCount = await sequelize.query(`
      SELECT COUNT(*) as count FROM mvp_anomalies
    `, { type: QueryTypes.SELECT });
    
    console.log('📊 Statistiques des données MVP:');
    console.log(`   - Collections: ${statsCount[0].count}`);
    console.log(`   - Statistiques appareils: ${deviceStatsCount[0].count}`);
    console.log(`   - Anomalies: ${anomaliesCount[0].count}`);
    
    console.log('🎉 Vérification des tables MVP Stats terminée avec succès');
    
  } catch (error) {
    console.error(`❌ Erreur lors de la vérification des tables: ${error.message}`);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Exécution si le script est appelé directement
if (require.main === module) {
  checkAndCreateMvpTables();
}

module.exports = { checkAndCreateMvpTables }; 