-- Migration pour ajouter les colonnes de statistiques à la table appareils
-- Date: 2025-07-30
-- Description: Ajout des colonnes cpuUsage, memoryUsage, bandwidthDownload, bandwidthUpload, status

-- 1. Sauvegarde des données existantes (au cas où)
CREATE TABLE appareils_backup_stats AS SELECT * FROM appareils;

-- 2. Ajout des nouvelles colonnes
ALTER TABLE appareils 
    ADD COLUMN cpuUsage DECIMAL(5,2) DEFAULT NULL COMMENT 'Utilisation CPU en pourcentage',
    ADD COLUMN memoryUsage DECIMAL(5,2) DEFAULT NULL COMMENT 'Utilisation mémoire en pourcentage',
    ADD COLUMN bandwidthDownload DECIMAL(10,2) DEFAULT NULL COMMENT 'Bande passante download en Mbps',
    ADD COLUMN bandwidthUpload DECIMAL(10,2) DEFAULT NULL COMMENT 'Bande passante upload en Mbps',
    ADD COLUMN status VARCHAR(50) DEFAULT NULL COMMENT 'Statut de l\'appareil';

-- 3. Création d'index pour optimiser les requêtes
CREATE INDEX idx_appareils_cpu_usage ON appareils(cpuUsage);
CREATE INDEX idx_appareils_memory_usage ON appareils(memoryUsage);
CREATE INDEX idx_appareils_status ON appareils(status);
CREATE INDEX idx_appareils_last_seen ON appareils(lastSeen);

-- 4. Mise à jour des données existantes depuis le champ stats JSON
UPDATE appareils 
SET 
    cpuUsage = JSON_EXTRACT(stats, '$.cpu'),
    memoryUsage = JSON_EXTRACT(stats, '$.memory'),
    bandwidthDownload = JSON_EXTRACT(stats, '$.bandwidth.download'),
    bandwidthUpload = JSON_EXTRACT(stats, '$.bandwidth.upload'),
    status = JSON_EXTRACT(stats, '$.status')
WHERE stats IS NOT NULL;

-- 5. Vérification des données
SELECT 
    COUNT(*) as total_appareils,
    COUNT(cpuUsage) as appareils_avec_cpu,
    COUNT(memoryUsage) as appareils_avec_memory,
    COUNT(status) as appareils_avec_status
FROM appareils;

-- 6. Si tout est OK, on peut supprimer la table de backup
-- DROP TABLE appareils_backup_stats;

-- Note: Ne pas oublier de vérifier que les comptes correspondent avant de supprimer la table de backup 