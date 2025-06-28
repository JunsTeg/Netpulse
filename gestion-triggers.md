-- =====================================================
-- GESTION ET MAINTENANCE DES TRIGGERS
-- =====================================================

-- Voir tous les triggers de la base de données
SELECT 
    TRIGGER_NAME,
    EVENT_MANIPULATION,
    EVENT_OBJECT_TABLE,
    ACTION_TIMING,
    CREATED
FROM information_schema.TRIGGERS 
WHERE TRIGGER_SCHEMA = DATABASE()
ORDER BY EVENT_OBJECT_TABLE;

-- Désactiver temporairement un trigger (si nécessaire)
-- DROP TRIGGER IF EXISTS before_insert_journaux;

-- Réactiver un trigger
-- (Il faut le recréer complètement)

-- Modifier un trigger existant
-- 1. Le supprimer
-- DROP TRIGGER IF EXISTS before_insert_journaux;
-- 2. Le recréer avec les modifications

-- Trigger de debug (version avec logging)
DELIMITER //
CREATE TRIGGER before_insert_journaux_debug
BEFORE INSERT ON journaux
FOR EACH ROW
BEGIN
    DECLARE device_exists_flag BOOLEAN DEFAULT FALSE;
    
    -- Vérifier si l'appareil existe
    SET device_exists_flag = DeviceExists(NEW.deviceId);
    
    -- Logger l'action (dans une table de debug si elle existe)
    -- INSERT INTO debug_log (message, timestamp) 
    -- VALUES (CONCAT('Trigger journaux: deviceId=', NEW.deviceId, ', exists=', device_exists_flag), NOW());
    
    -- Créer l'appareil si nécessaire
    IF NEW.deviceId IS NOT NULL AND NOT device_exists_flag THEN
        INSERT IGNORE INTO appareils (
            id, hostname, deviceType, firstDiscovered, lastSeen, isActive
        ) VALUES (
            NEW.deviceId,
            CONCAT('Auto-Device-', SUBSTRING(NEW.deviceId, 1, 8)),
            'Auto-Discovered',
            NOW(),
            NOW(),
            TRUE
        );
    END IF;
END //
DELIMITER ;

-- Procédure pour nettoyer les appareils auto-créés
DELIMITER //
CREATE PROCEDURE CleanupAutoDevices()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Supprimer les appareils auto-créés qui n'ont pas de données associées
    DELETE a FROM appareils a
    WHERE a.hostname LIKE 'Auto-Device-%'
      AND NOT EXISTS (SELECT 1 FROM journaux j WHERE j.deviceId = a.id)
      AND NOT EXISTS (SELECT 1 FROM statistiques_reseau s WHERE s.deviceId = a.id)
      AND NOT EXISTS (SELECT 1 FROM configuration_agent c WHERE c.deviceId = a.id)
      AND a.firstDiscovered < DATE_SUB(NOW(), INTERVAL 1 DAY);
    
    COMMIT;
END //
DELIMITER ;
