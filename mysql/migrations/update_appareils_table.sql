-- Migration pour mettre a jour la table appareils
-- Date: 2025-06-15
-- Description: Mise a jour de la structure de la table appareils pour utiliser firstDiscovered et createdAt

-- 1. Sauvegarde des donnees existantes (au cas ou)
CREATE TABLE appareils_backup AS SELECT * FROM appareils;

-- 2. Renommage de la colonne createAt en firstDiscovered
ALTER TABLE appareils 
    CHANGE COLUMN createAt firstDiscovered DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 3. Ajout de la colonne createdAt comme colonne generee
ALTER TABLE appareils 
    ADD COLUMN createdAt DATETIME GENERATED ALWAYS AS (firstDiscovered) STORED;

-- 4. Verification des donnees
SELECT COUNT(*) as total_appareils FROM appareils;
SELECT COUNT(*) as total_backup FROM appareils_backup;

-- 5. Si tout est OK, on peut supprimer la table de backup
-- DROP TABLE appareils_backup;

-- Note: Ne pas oublier de verifier que les comptes correspondent avant de supprimer la table de backup 