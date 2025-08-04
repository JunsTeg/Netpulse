-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Hôte : mysql:3306
-- Généré le : dim. 20 juil. 2025 à 17:18
-- Version du serveur : 8.0.42
-- Version de PHP : 8.2.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `netpulse`
--

-- --------------------------------------------------------

--
-- Structure de la table `alertes`
--

CREATE TABLE `alertes` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `anomalyId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'open',
  `priority` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `triggeredAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `resolvedAt` datetime DEFAULT NULL,
  `resolutionNotes` text COLLATE utf8mb4_unicode_ci,
  `notified` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `analyse_modele`
--

CREATE TABLE `analyse_modele` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `algorithm` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'inactive',
  `trainingDataSource` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `accuracy` float DEFAULT NULL,
  `lastTrainedAt` datetime DEFAULT NULL,
  `parameters` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `anomalies`
--

CREATE TABLE `anomalies` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deviceId` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logId` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `severity` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `anomalyType` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detectedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `isConfirmed` tinyint(1) DEFAULT '0',
  `resolvedAt` datetime DEFAULT NULL,
  `assignedToUserId` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `appareils`
--

CREATE TABLE `appareils` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hostname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ipAddress` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `macAddress` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `os` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deviceType` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stats` json DEFAULT NULL,
  `lastSeen` datetime DEFAULT NULL,
  `firstDiscovered` datetime DEFAULT CURRENT_TIMESTAMP,
  `createdAt` datetime GENERATED ALWAYS AS (`firstDiscovered`) STORED,
  `isActive` tinyint(1) DEFAULT '1',
  `cpuUsage` decimal(5,2) DEFAULT NULL COMMENT 'Utilisation CPU en pourcentage',
  `memoryUsage` decimal(5,2) DEFAULT NULL COMMENT 'Utilisation mémoire en pourcentage',
  `bandwidthDownload` decimal(10,2) DEFAULT NULL COMMENT 'Bande passante download en Mbps',
  `bandwidthUpload` decimal(10,2) DEFAULT NULL COMMENT 'Bande passante upload en Mbps',
  `status` varchar(50) DEFAULT NULL COMMENT 'Statut de l\'appareil',
  PRIMARY KEY (`id`),
  KEY `idx_appareils_cpu_usage` (`cpuUsage`),
  KEY `idx_appareils_memory_usage` (`memoryUsage`),
  KEY `idx_appareils_status` (`status`),
  KEY `idx_appareils_last_seen` (`lastSeen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `configuration_agent`
--

CREATE TABLE `configuration_agent` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agentType` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deviceId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `config` json DEFAULT NULL,
  `intervalLabel` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) DEFAULT '1',
  `lastExecutedAt` datetime DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `historiques`
--

CREATE TABLE `historiques` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `targetType` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `targetId` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `detail` text COLLATE utf8mb4_unicode_ci,
  `ipAddress` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `journaux`
--

CREATE TABLE `journaux` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deviceId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `port` int DEFAULT NULL,
  `protocol` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `rawData` json DEFAULT NULL,
  `parsedData` json DEFAULT NULL,
  `logType` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `severity` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `notifications`
--

CREATE TABLE `notifications` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alertId` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isRead` tinyint(1) DEFAULT '0',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `readAt` datetime DEFAULT NULL,
  `notificationType` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'alert'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `parametres`
--

CREATE TABLE `parametres` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `isSystem` tinyint(1) DEFAULT '0',
  `updatedAt` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `updatedByUserId` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `retours`
--

CREATE TABLE `retours` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alertId` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `isTruePositive` tinyint(1) DEFAULT NULL,
  `actionTaken` text COLLATE utf8mb4_unicode_ci,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `seuils_alerte`
--

CREATE TABLE `seuils_alerte` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `metricName` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `threshold` float NOT NULL,
  `condition` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isActive` tinyint(1) DEFAULT '1',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `statistiques_reseau`
--

CREATE TABLE `statistiques_reseau` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deviceId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bandwidth` float DEFAULT NULL,
  `latency` float DEFAULT NULL,
  `packetLoss` float DEFAULT NULL,
  `cpuUsage` float DEFAULT NULL,
  `memoryUsage` float DEFAULT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `intervalLabel` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Structure de la table `topologies` (Version 3.0 normalisée)
-- =====================================================

CREATE TABLE `topologies` (
  `id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Identifiant unique de la topologie (UUID)',
  `name` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nom descriptif de la topologie',
  `version` VARCHAR(10) DEFAULT '3.0.0' COMMENT 'Version du format de données',
  `source` ENUM('manual', 'scan', 'auto', 'scheduled', 'database') DEFAULT 'database' COMMENT 'Source de génération',
  `status` ENUM('active', 'inactive', 'archived', 'draft') DEFAULT 'active' COMMENT 'Statut de la topologie',
  `generation_method` VARCHAR(50) DEFAULT 'ultra-optimized' COMMENT 'Méthode de génération utilisée',
  `device_count` INT DEFAULT 0 COMMENT 'Nombre d\'appareils dans la topologie',
  `link_count` INT DEFAULT 0 COMMENT 'Nombre de liens dans la topologie',
  `central_node_id` VARCHAR(36) DEFAULT NULL COMMENT 'ID de l\'équipement central',
  `central_node_confidence` ENUM('high', 'medium', 'low') DEFAULT 'medium' COMMENT 'Confiance dans l\'équipement central',
  `generation_time_ms` INT DEFAULT 0 COMMENT 'Temps de génération en millisecondes',
  `snmp_success_rate` DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Taux de succès SNMP (%)',
  `cache_hit_rate` DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Taux de hit cache (%)',
  `metadata` JSON COMMENT 'Métadonnées additionnelles (userId, options, etc.)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Date de dernière modification',
  `created_by` VARCHAR(36) DEFAULT NULL COMMENT 'ID de l\'utilisateur créateur',
  `expires_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Date d\'expiration (pour nettoyage automatique)',
  
  PRIMARY KEY (`id`),
  KEY `idx_topology_source` (`source`),
  KEY `idx_topology_status` (`status`),
  KEY `idx_topology_created_at` (`created_at`),
  KEY `idx_topology_central_node` (`central_node_id`),
  KEY `idx_topology_expires` (`expires_at`),
  KEY `idx_topology_method` (`generation_method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Table principale des topologies';

-- =====================================================
-- Structure de la table `topology_nodes`
-- =====================================================

CREATE TABLE `topology_nodes` (
  `id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Identifiant unique du nœud',
  `topology_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID de la topologie parente',
  `device_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID de l\'appareil correspondant (si existe)',
  `hostname` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nom d\'hôte du nœud',
  `ip_address` VARCHAR(45) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Adresse IP du nœud',
  `mac_address` VARCHAR(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Adresse MAC du nœud',
  `device_type` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type d\'appareil (router, switch, server, etc.)',
  `os` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Système d\'exploitation',
  `is_central` BOOLEAN DEFAULT FALSE COMMENT 'Indique si c\'est l\'équipement central',
  `is_virtual` BOOLEAN DEFAULT FALSE COMMENT 'Indique si c\'est un nœud virtuel (gateway)',
  `status` ENUM('active', 'inactive', 'warning', 'error') DEFAULT 'active' COMMENT 'Statut du nœud',
  `cpu_usage` DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Utilisation CPU (%)',
  `memory_usage` DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Utilisation mémoire (%)',
  `bandwidth_mbps` DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Bande passante en Mbps',
  `latency_ms` DECIMAL(8,2) DEFAULT 0.00 COMMENT 'Latence en millisecondes',
  `uptime_seconds` BIGINT DEFAULT 0 COMMENT 'Temps de fonctionnement en secondes',
  `vlan` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT 'N/A' COMMENT 'VLAN associé',
  `services` JSON COMMENT 'Liste des services actifs',
  `last_seen` TIMESTAMP NULL DEFAULT NULL COMMENT 'Dernière fois vu',
  `first_discovered` TIMESTAMP NULL DEFAULT NULL COMMENT 'Première découverte',
  `node_metadata` JSON COMMENT 'Métadonnées spécifiques au nœud',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
  
  PRIMARY KEY (`id`),
  KEY `idx_node_topology` (`topology_id`),
  KEY `idx_node_device` (`device_id`),
  KEY `idx_node_ip` (`ip_address`),
  KEY `idx_node_mac` (`mac_address`),
  KEY `idx_node_type` (`device_type`),
  KEY `idx_node_central` (`is_central`),
  KEY `idx_node_status` (`status`),
  KEY `idx_node_hostname` (`hostname`),
  KEY `idx_node_last_seen` (`last_seen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nœuds des topologies';

-- =====================================================
-- Structure de la table `topology_links`
-- =====================================================

CREATE TABLE `topology_links` (
  `id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Identifiant unique du lien',
  `topology_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID de la topologie parente',
  `source_node_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID du nœud source',
  `target_node_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID du nœud cible',
  `link_type` ENUM('LAN', 'WAN', 'WIFI', 'VLAN', 'BACKUP') DEFAULT 'LAN' COMMENT 'Type de lien',
  `confidence` ENUM('high', 'medium', 'low') DEFAULT 'medium' COMMENT 'Niveau de confiance du lien',
  `is_virtual` BOOLEAN DEFAULT FALSE COMMENT 'Indique si c\'est un lien virtuel',
  `is_assumed` BOOLEAN DEFAULT FALSE COMMENT 'Indique si le lien est supposé (fallback)',
  `source_port` INT DEFAULT NULL COMMENT 'Port source (pour SNMP)',
  `target_port` INT DEFAULT NULL COMMENT 'Port cible (pour SNMP)',
  `bandwidth_mbps` DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Bande passante en Mbps',
  `latency_ms` DECIMAL(8,2) DEFAULT 0.00 COMMENT 'Latence en millisecondes',
  `packet_loss` DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Perte de paquets (%)',
  `vlan_id` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID du VLAN',
  `reasoning` TEXT COLLATE utf8mb4_unicode_ci COMMENT 'Raison de la création du lien',
  `link_metadata` JSON COMMENT 'Métadonnées spécifiques au lien',
  `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Dernière mise à jour',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_link_direction` (`topology_id`, `source_node_id`, `target_node_id`),
  KEY `idx_link_topology` (`topology_id`),
  KEY `idx_link_source` (`source_node_id`),
  KEY `idx_link_target` (`target_node_id`),
  KEY `idx_link_type` (`link_type`),
  KEY `idx_link_confidence` (`confidence`),
  KEY `idx_link_virtual` (`is_virtual`),
  KEY `idx_link_bandwidth` (`bandwidth_mbps`),
  KEY `idx_link_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Liens des topologies';

-- =====================================================
-- Structure de la table `topology_stats`
-- =====================================================

CREATE TABLE `topology_stats` (
  `id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Identifiant unique des statistiques',
  `topology_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID de la topologie',
  `stat_type` ENUM('overall', 'by_device_type', 'by_link_type', 'by_subnet', 'performance') NOT NULL COMMENT 'Type de statistique',
  `stat_key` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Clé de la statistique',
  `stat_value` DECIMAL(15,4) DEFAULT 0.0000 COMMENT 'Valeur de la statistique',
  `stat_unit` VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Unité de mesure',
  `stat_description` TEXT COLLATE utf8mb4_unicode_ci COMMENT 'Description de la statistique',
  `calculated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de calcul',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stat_unique` (`topology_id`, `stat_type`, `stat_key`),
  KEY `idx_stat_topology` (`topology_id`),
  KEY `idx_stat_type` (`stat_type`),
  KEY `idx_stat_key` (`stat_key`),
  KEY `idx_stat_calculated` (`calculated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Statistiques des topologies';

-- =====================================================
-- Structure de la table `topology_changes`
-- =====================================================

CREATE TABLE `topology_changes` (
  `id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Identifiant unique du changement',
  `topology_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID de la topologie',
  `change_type` ENUM('created', 'updated', 'node_added', 'node_removed', 'link_added', 'link_removed', 'central_changed', 'archived') NOT NULL COMMENT 'Type de changement',
  `entity_type` ENUM('topology', 'node', 'link') DEFAULT NULL COMMENT 'Type d\'entité modifiée',
  `entity_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID de l\'entité modifiée',
  `old_value` JSON DEFAULT NULL COMMENT 'Ancienne valeur',
  `new_value` JSON DEFAULT NULL COMMENT 'Nouvelle valeur',
  `change_reason` TEXT COLLATE utf8mb4_unicode_ci COMMENT 'Raison du changement',
  `changed_by` VARCHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID de l\'utilisateur ayant effectué le changement',
  `changed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Date du changement',
  
  PRIMARY KEY (`id`),
  KEY `idx_change_topology` (`topology_id`),
  KEY `idx_change_type` (`change_type`),
  KEY `idx_change_entity` (`entity_type`, `entity_id`),
  KEY `idx_change_date` (`changed_at`),
  KEY `idx_change_user` (`changed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Historique des changements de topologie';

-- =====================================================
-- VUES POUR FACILITER LES REQUÊTES
-- =====================================================

-- Vue pour les topologies avec statistiques
CREATE VIEW `v_topologies_with_stats` AS
SELECT 
  t.*,
  COUNT(DISTINCT tn.id) as actual_node_count,
  COUNT(DISTINCT tl.id) as actual_link_count,
  AVG(tn.cpu_usage) as avg_cpu_usage,
  AVG(tn.memory_usage) as avg_memory_usage,
  AVG(tl.bandwidth_mbps) as avg_bandwidth,
  AVG(tl.latency_ms) as avg_latency
FROM topologies t
LEFT JOIN topology_nodes tn ON t.id = tn.topology_id
LEFT JOIN topology_links tl ON t.id = tl.topology_id
GROUP BY t.id;

-- Vue pour les nœuds avec informations de connectivité
CREATE VIEW `v_nodes_with_connectivity` AS
SELECT 
  tn.*,
  t.name as topology_name,
  t.status as topology_status,
  COUNT(tl_out.id) as outgoing_links,
  COUNT(tl_in.id) as incoming_links,
  (COUNT(tl_out.id) + COUNT(tl_in.id)) as total_connections
FROM topology_nodes tn
JOIN topologies t ON tn.topology_id = t.id
LEFT JOIN topology_links tl_out ON tn.id = tl_out.source_node_id
LEFT JOIN topology_links tl_in ON tn.id = tl_in.target_node_id
GROUP BY tn.id;

-- =====================================================
-- PROCÉDURES STOCKÉES POUR LA GESTION DES TOPOLOGIES
-- =====================================================

-- Note: Les triggers ont été supprimés pour éviter les erreurs de privilèges
-- Utilisez ces procédures stockées pour gérer l'état des topologies manuellement
-- Instructions d'utilisation :
-- 1. CALL sp_activate_topology('topology_id'); - Pour activer une topologie
-- 2. CALL sp_update_topology_counters('topology_id'); - Pour mettre à jour les compteurs
-- 3. CALL sp_create_topology('id', 'name', 'source', 'user_id'); - Pour créer une topologie

-- =====================================================
-- PROCÉDURES STOCKÉES ALTERNATIVES (plus compatibles)
-- =====================================================
-- Ces procédures peuvent être utilisées si les triggers échouent

DELIMITER $$

-- Procédure pour activer une topologie (remplace les triggers)
CREATE PROCEDURE `sp_activate_topology`(IN topology_id VARCHAR(36))
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  
  START TRANSACTION;
    -- Désactiver toutes les autres topologies
    UPDATE topologies SET status = 'inactive' WHERE status = 'active';
    -- Activer la topologie spécifiée
    UPDATE topologies SET status = 'active' WHERE id = topology_id;
  COMMIT;
END$$

-- Procédure pour mettre à jour les compteurs
CREATE PROCEDURE `sp_update_topology_counters`(IN topology_id VARCHAR(36))
BEGIN
  UPDATE topologies 
  SET 
    device_count = (SELECT COUNT(*) FROM topology_nodes WHERE topology_id = topology_id),
    link_count = (SELECT COUNT(*) FROM topology_links WHERE topology_id = topology_id)
  WHERE id = topology_id;
END$$

-- Procédure pour créer une nouvelle topologie avec gestion d'état
CREATE PROCEDURE `sp_create_topology`(
  IN p_id VARCHAR(36),
  IN p_name VARCHAR(255),
  IN p_source ENUM('manual', 'scan', 'auto', 'scheduled', 'database'),
  IN p_created_by VARCHAR(36)
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  
  START TRANSACTION;
    -- Désactiver toutes les autres topologies si la nouvelle est active
    IF p_source = 'manual' THEN
      UPDATE topologies SET status = 'inactive' WHERE status = 'active';
    END IF;
    
    -- Insérer la nouvelle topologie
    INSERT INTO topologies (id, name, source, created_by, status)
    VALUES (p_id, p_name, p_source, p_created_by, 
            CASE WHEN p_source = 'manual' THEN 'active' ELSE 'inactive' END);
  COMMIT;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `utilisateur`
--

CREATE TABLE `utilisateur` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isActive` tinyint(1) DEFAULT '1',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `lastLoginAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `utilisateur`
--

INSERT INTO `utilisateur` (`id`, `username`, `email`, `password`, `isActive`, `createdAt`, `lastLoginAt`) VALUES
('c549e55f-3b26-4b9f-877e-96caae448adc', 'Paul', 'paul@test.com', '$2b$10$YGJ.8jb75YbF7krsUCpdJe2N3HlBXwuTpDaOE19J3WbzOOlORJdiu', 1, '2025-07-10 22:46:26', '2025-07-14 13:37:43');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `alertes`
--
ALTER TABLE `alertes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_anomaly_id` (`anomalyId`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_priority` (`priority`),
  ADD KEY `idx_triggered_at` (`triggeredAt`),
  ADD KEY `idx_resolved_at` (`resolvedAt`);

--
-- Index pour la table `analyse_modele`
--
ALTER TABLE `analyse_modele`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_algorithm` (`algorithm`);

--
-- Index pour la table `anomalies`
--
ALTER TABLE `anomalies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_device_id` (`deviceId`),
  ADD KEY `idx_log_id` (`logId`),
  ADD KEY `idx_severity` (`severity`),
  ADD KEY `idx_detected_at` (`detectedAt`),
  ADD KEY `idx_resolved_at` (`resolvedAt`),
  ADD KEY `idx_assigned_to` (`assignedToUserId`),
  ADD KEY `idx_anomaly_type` (`anomalyType`);

--
-- Index pour la table `appareils`
--
ALTER TABLE `appareils`
  ADD UNIQUE KEY `unique_ip_hostname` (`ipAddress`,`hostname`),
  ADD KEY `idx_hostname` (`hostname`),
  ADD KEY `idx_ip_address` (`ipAddress`),
  ADD KEY `idx_mac_address` (`macAddress`),
  ADD KEY `idx_device_type` (`deviceType`),
  ADD KEY `idx_last_seen` (`lastSeen`),
  ADD KEY `idx_first_discovered` (`firstDiscovered`),
  ADD KEY `idx_is_active` (`isActive`);

--
-- Index pour la table `configuration_agent`
--
ALTER TABLE `configuration_agent`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_agent_type` (`agentType`),
  ADD KEY `idx_device_id` (`deviceId`),
  ADD KEY `idx_active` (`isActive`),
  ADD KEY `idx_device_agent` (`deviceId`,`agentType`);

--
-- Index pour la table `historiques`
--
ALTER TABLE `historiques`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`userId`),
  ADD KEY `idx_action` (`action`),
  ADD KEY `idx_timestamp` (`timestamp`),
  ADD KEY `idx_target_type` (`targetType`),
  ADD KEY `idx_target_id` (`targetId`),
  ADD KEY `idx_ip_address` (`ipAddress`);

--
-- Index pour la table `journaux`
--
ALTER TABLE `journaux`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_device_id` (`deviceId`),
  ADD KEY `idx_timestamp` (`timestamp`),
  ADD KEY `idx_log_type` (`logType`),
  ADD KEY `idx_severity` (`severity`),
  ADD KEY `idx_device_timestamp` (`deviceId`,`timestamp`),
  ADD KEY `idx_created_at` (`createdAt`);

--
-- Index pour la table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`userId`),
  ADD KEY `idx_alert_id` (`alertId`),
  ADD KEY `idx_is_read` (`isRead`),
  ADD KEY `idx_created_at` (`createdAt`),
  ADD KEY `idx_notification_type` (`notificationType`);

--
-- Index pour la table `parametres`
--
ALTER TABLE `parametres`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_system` (`isSystem`),
  ADD KEY `idx_updated_by` (`updatedByUserId`);

--
-- Index pour la table `retours`
--
ALTER TABLE `retours`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`userId`),
  ADD KEY `idx_alert_id` (`alertId`),
  ADD KEY `idx_created_at` (`createdAt`),
  ADD KEY `idx_true_positive` (`isTruePositive`);

--
-- Index pour la table `seuils_alerte`
--
ALTER TABLE `seuils_alerte`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_metric_name` (`metricName`),
  ADD KEY `idx_severity` (`severity`),
  ADD KEY `idx_active` (`isActive`);

--
-- Index pour la table `statistiques_reseau`
--
ALTER TABLE `statistiques_reseau`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_device_id` (`deviceId`),
  ADD KEY `idx_timestamp` (`timestamp`),
  ADD KEY `idx_interval_label` (`intervalLabel`),
  ADD KEY `idx_device_timestamp` (`deviceId`,`timestamp`);





--
-- Index pour la table `utilisateur`
--
ALTER TABLE `utilisateur`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_username` (`username`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_active` (`isActive`),
  ADD KEY `idx_created` (`createdAt`);

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `alertes`
--
ALTER TABLE `alertes`
  ADD CONSTRAINT `fk_alertes_anomaly` FOREIGN KEY (`anomalyId`) REFERENCES `anomalies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `anomalies`
--
ALTER TABLE `anomalies`
  ADD CONSTRAINT `fk_anomalies_device` FOREIGN KEY (`deviceId`) REFERENCES `appareils` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_anomalies_log` FOREIGN KEY (`logId`) REFERENCES `journaux` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_anomalies_user` FOREIGN KEY (`assignedToUserId`) REFERENCES `utilisateur` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `configuration_agent`
--
ALTER TABLE `configuration_agent`
  ADD CONSTRAINT `fk_config_agent_device` FOREIGN KEY (`deviceId`) REFERENCES `appareils` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `historiques`
--
ALTER TABLE `historiques`
  ADD CONSTRAINT `fk_historiques_user` FOREIGN KEY (`userId`) REFERENCES `utilisateur` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `journaux`
--
ALTER TABLE `journaux`
  ADD CONSTRAINT `fk_journaux_device` FOREIGN KEY (`deviceId`) REFERENCES `appareils` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_alert` FOREIGN KEY (`alertId`) REFERENCES `alertes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`userId`) REFERENCES `utilisateur` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `parametres`
--
ALTER TABLE `parametres`
  ADD CONSTRAINT `fk_parametres_user` FOREIGN KEY (`updatedByUserId`) REFERENCES `utilisateur` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Contraintes pour la table `retours`
--
ALTER TABLE `retours`
  ADD CONSTRAINT `fk_retours_alert` FOREIGN KEY (`alertId`) REFERENCES `alertes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_retours_user` FOREIGN KEY (`userId`) REFERENCES `utilisateur` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `statistiques_reseau`
--
ALTER TABLE `statistiques_reseau`
  ADD CONSTRAINT `fk_stats_device` FOREIGN KEY (`deviceId`) REFERENCES `appareils` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour les tables de topologie
--

-- Contraintes pour la table `topology_nodes`
ALTER TABLE `topology_nodes`
  ADD CONSTRAINT `fk_node_topology` FOREIGN KEY (`topology_id`) REFERENCES `topologies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_node_device` FOREIGN KEY (`device_id`) REFERENCES `appareils` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Contraintes pour la table `topology_links`
ALTER TABLE `topology_links`
  ADD CONSTRAINT `fk_link_topology` FOREIGN KEY (`topology_id`) REFERENCES `topologies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_link_source` FOREIGN KEY (`source_node_id`) REFERENCES `topology_nodes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_link_target` FOREIGN KEY (`target_node_id`) REFERENCES `topology_nodes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Contraintes pour la table `topology_stats`
ALTER TABLE `topology_stats`
  ADD CONSTRAINT `fk_stat_topology` FOREIGN KEY (`topology_id`) REFERENCES `topologies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Contraintes pour la table `topology_changes`
ALTER TABLE `topology_changes`
  ADD CONSTRAINT `fk_change_topology` FOREIGN KEY (`topology_id`) REFERENCES `topologies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
