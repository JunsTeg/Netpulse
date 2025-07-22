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
  `isActive` tinyint(1) DEFAULT '1'
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

-- --------------------------------------------------------

--
-- Structure de la table `topologie_reseau`
--

CREATE TABLE `topologie_reseau` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `data` json DEFAULT NULL,
  `isActive` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  ADD PRIMARY KEY (`id`),
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
-- Index pour la table `topologie_reseau`
--
ALTER TABLE `topologie_reseau`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_active` (`isActive`),
  ADD KEY `idx_created_at` (`createdAt`);

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
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
