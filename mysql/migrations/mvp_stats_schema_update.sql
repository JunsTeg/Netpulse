-- =====================================================
-- MIGRATION MVP STATS - Mise à jour du schéma
-- Date: 2025-01-27
-- Description: Adaptation du schéma pour le module MVP Stats
-- =====================================================

-- =====================================================
-- ÉTAPE 1: SUPPRESSION DES COLONNES STATISTIQUES REDONDANTES
-- =====================================================

-- Suppression des colonnes statistiques de la table appareils
-- Ces colonnes sont redondantes car les stats sont stockées dans le champ JSON 'stats'
-- et seront maintenant gérées par les tables MVP dédiées
ALTER TABLE `appareils` 
DROP COLUMN `cpuUsage`,
DROP COLUMN `memoryUsage`, 
DROP COLUMN `bandwidthDownload`,
DROP COLUMN `bandwidthUpload`,
DROP COLUMN `status`;

-- Suppression des index associés aux colonnes supprimées
DROP INDEX `idx_appareils_cpu_usage` ON `appareils`;
DROP INDEX `idx_appareils_memory_usage` ON `appareils`;
DROP INDEX `idx_appareils_status` ON `appareils`;

-- =====================================================
-- ÉTAPE 2: CRÉATION DES TABLES MVP STATS
-- =====================================================

-- Table principale des collections de statistiques MVP
CREATE TABLE `mvp_stats_collection` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Identifiant unique de la collection',
  `timestamp` datetime NOT NULL COMMENT 'Timestamp de la collection',
  `total_devices` int NOT NULL COMMENT 'Nombre total d\'appareils',
  `active_devices` int NOT NULL COMMENT 'Nombre d\'appareils actifs',
  `failed_devices` int NOT NULL COMMENT 'Nombre d\'appareils en échec',
  `avg_cpu` decimal(5,2) NOT NULL COMMENT 'CPU moyen (%)',
  `avg_memory` decimal(10,2) NOT NULL COMMENT 'Mémoire moyenne (MB)',
  `avg_bandwidth` decimal(10,2) NOT NULL COMMENT 'Bande passante moyenne (Mbps)',
  `avg_latency` decimal(10,2) NOT NULL COMMENT 'Latence moyenne (ms)',
  `total_anomalies` int NOT NULL COMMENT 'Nombre total d\'anomalies',
  `collection_duration` int NOT NULL COMMENT 'Durée de collecte (ms)',
  `raw_data` json DEFAULT NULL COMMENT 'Données brutes de la collection',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
  
  PRIMARY KEY (`id`),
  KEY `idx_mvp_collection_created_at` (`created_at`),
  KEY `idx_mvp_collection_timestamp` (`timestamp`),
  KEY `idx_mvp_collection_active_devices` (`active_devices`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Collections de statistiques MVP';

-- Table des statistiques détaillées par appareil (MVP)
CREATE TABLE `mvp_device_stats` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Identifiant unique',
  `stats_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID de la collection parente',
  `device_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID de l\'appareil',
  `hostname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nom d\'hôte',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Adresse IP',
  `device_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type d\'appareil',
  `cpu_usage` decimal(5,2) NOT NULL COMMENT 'Utilisation CPU (%)',
  `memory_usage` decimal(10,2) NOT NULL COMMENT 'Utilisation mémoire (MB)',
  `bandwidth_download` decimal(10,2) NOT NULL COMMENT 'Bande passante download (Mbps)',
  `bandwidth_upload` decimal(10,2) NOT NULL COMMENT 'Bande passante upload (Mbps)',
  `latency` decimal(10,2) NOT NULL COMMENT 'Latence (ms)',
  `jitter` decimal(10,2) DEFAULT NULL COMMENT 'Jitter (ms)',
  `packet_loss` decimal(5,2) DEFAULT NULL COMMENT 'Perte de paquets (%)',
  `collection_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Statut de collecte',
  `collection_time` int NOT NULL COMMENT 'Temps de collecte (ms)',
  `anomalies_count` int NOT NULL DEFAULT 0 COMMENT 'Nombre d\'anomalies',
  `raw_data` json DEFAULT NULL COMMENT 'Données brutes de l\'appareil',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
  
  PRIMARY KEY (`id`),
  KEY `idx_mvp_device_stats_id` (`stats_id`),
  KEY `idx_mvp_device_device_id` (`device_id`),
  KEY `idx_mvp_device_created_at` (`created_at`),
  KEY `idx_mvp_device_collection_status` (`collection_status`),
  KEY `idx_mvp_device_cpu_usage` (`cpu_usage`),
  KEY `idx_mvp_device_memory_usage` (`memory_usage`),
  KEY `idx_mvp_device_latency` (`latency`),
  FOREIGN KEY (`stats_id`) REFERENCES `mvp_stats_collection`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`device_id`) REFERENCES `appareils`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Statistiques détaillées par appareil (MVP)';

-- Table des anomalies MVP (distincte de la table anomalies existante)
CREATE TABLE `mvp_anomalies` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Identifiant unique',
  `stats_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID de la collection parente',
  `device_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID de l\'appareil (optionnel)',
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type d\'anomalie',
  `severity` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Sévérité',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Message d\'anomalie',
  `threshold` decimal(10,2) NOT NULL COMMENT 'Seuil déclencheur',
  `current_value` decimal(10,2) NOT NULL COMMENT 'Valeur actuelle',
  `timestamp` datetime NOT NULL COMMENT 'Timestamp de détection',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
  
  PRIMARY KEY (`id`),
  KEY `idx_mvp_anomalies_stats_id` (`stats_id`),
  KEY `idx_mvp_anomalies_device_id` (`device_id`),
  KEY `idx_mvp_anomalies_type` (`type`),
  KEY `idx_mvp_anomalies_severity` (`severity`),
  KEY `idx_mvp_anomalies_created_at` (`created_at`),
  KEY `idx_mvp_anomalies_timestamp` (`timestamp`),
  FOREIGN KEY (`stats_id`) REFERENCES `mvp_stats_collection`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`device_id`) REFERENCES `appareils`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Anomalies détectées par MVP Stats';

-- =====================================================
-- ÉTAPE 3: VÉRIFICATION ET MAINTENANCE DES CONTRAINTES
-- =====================================================

-- Vérification que la table appareils conserve ses contraintes essentielles
-- La table appareils garde :
-- - PRIMARY KEY sur `id`
-- - Index sur `lastSeen`
-- - Champ JSON `stats` pour les données flexibles
-- - Toutes les colonnes d'identification (hostname, ipAddress, macAddress, etc.)

-- =====================================================
-- ÉTAPE 4: MIGRATION DES DONNÉES EXISTANTES (OPTIONNEL)
-- =====================================================

-- Note: Si des données existent dans les anciennes colonnes statistiques,
-- elles peuvent être migrées vers le champ JSON 'stats' de la table appareils
-- ou vers les nouvelles tables MVP selon les besoins

-- =====================================================
-- ÉTAPE 5: VÉRIFICATION FINALE
-- =====================================================

-- Vérification de l'intégrité des contraintes
-- Les clés étrangères garantissent la cohérence référentielle :
-- - mvp_device_stats.device_id -> appareils.id
-- - mvp_device_stats.stats_id -> mvp_stats_collection.id
-- - mvp_anomalies.device_id -> appareils.id (optionnel)
-- - mvp_anomalies.stats_id -> mvp_stats_collection.id

-- =====================================================
-- RÉSUMÉ DES CHANGEMENTS
-- =====================================================

/*
CHANGEMENTS EFFECTUÉS :

1. TABLE appareils :
   ✅ CONSERVÉE avec toutes ses colonnes d'identification
   ❌ SUPPRIMÉES : cpuUsage, memoryUsage, bandwidthDownload, bandwidthUpload, status
   ✅ CONSERVÉ : champ JSON 'stats' pour les données flexibles
   ✅ CONSERVÉES : toutes les contraintes de clés primaires et index essentiels

2. NOUVELLES TABLES MVP :
   ✅ mvp_stats_collection : Collections de statistiques globales
   ✅ mvp_device_stats : Statistiques détaillées par appareil
   ✅ mvp_anomalies : Anomalies détectées par MVP

3. CONTRAINTES DE CLÉS :
   ✅ FOREIGN KEY : mvp_device_stats.device_id -> appareils.id
   ✅ FOREIGN KEY : mvp_device_stats.stats_id -> mvp_stats_collection.id
   ✅ FOREIGN KEY : mvp_anomalies.device_id -> appareils.id (SET NULL)
   ✅ FOREIGN KEY : mvp_anomalies.stats_id -> mvp_stats_collection.id
   ✅ CASCADE DELETE : Suppression automatique des données liées

4. INDEX OPTIMISÉS :
   ✅ Index sur les colonnes fréquemment consultées
   ✅ Index sur les clés étrangères
   ✅ Index sur les timestamps pour les requêtes temporelles
*/ 