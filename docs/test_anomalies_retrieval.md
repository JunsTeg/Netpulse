# Test de Récupération des Anomalies MVP

## 🎯 Objectif
Vérifier que le widget des anomalies du dashboard récupère correctement les 3 dernières anomalies de la table `mvp_anomalies`.

## 📋 Endpoints de Test

### 1. Test Direct des Anomalies
**Endpoint:** `GET /api/mvp-stats/test-anomalies`

**Description:** Teste directement la récupération des anomalies depuis la table `mvp_anomalies`.

**Réponse attendue:**
```json
{
  "status": "success",
  "data": {
    "anomalies": [
      {
        "id": "uuid-anomaly-1",
        "type": "CPU_HIGH",
        "severity": "critical",
        "message": "Utilisation CPU élevée détectée",
        "device": "serveur-web-01",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "threshold": 80.0,
        "currentValue": 95.5
      }
    ],
    "count": 1,
    "source": "mvp_anomalies table",
    "query": "SELECT a.*, d.hostname, d.ip_address FROM mvp_anomalies a LEFT JOIN mvp_device_stats d ON a.device_id = d.device_id ORDER BY a.created_at DESC LIMIT 3"
  },
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### 2. Endpoint Principal des Anomalies
**Endpoint:** `GET /api/mvp-stats/anomalies?limit=3`

**Description:** Endpoint utilisé par le dashboard pour récupérer les 3 dernières anomalies.

**Réponse attendue:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid-anomaly-1",
      "statsId": "uuid-stats-1",
      "deviceId": "uuid-device-1",
      "hostname": "serveur-web-01",
      "ipAddress": "192.168.1.100",
      "type": "CPU_HIGH",
      "severity": "critical",
      "message": "Utilisation CPU élevée détectée",
      "threshold": 80.0,
      "currentValue": 95.5,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1,
  "summary": {
    "critical": 1,
    "warning": 0,
    "info": 0
  },
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

## 🗄️ Structure de la Table `mvp_anomalies`

```sql
CREATE TABLE `mvp_anomalies` (
  `id` varchar(36) NOT NULL COMMENT 'Identifiant unique',
  `stats_id` varchar(36) NOT NULL COMMENT 'ID de la collection parente',
  `device_id` varchar(36) DEFAULT NULL COMMENT 'ID de l\'appareil (optionnel)',
  `type` varchar(50) NOT NULL COMMENT 'Type d\'anomalie',
  `severity` varchar(20) NOT NULL COMMENT 'Sévérité',
  `message` text NOT NULL COMMENT 'Message d\'anomalie',
  `threshold` decimal(10,2) NOT NULL COMMENT 'Seuil déclencheur',
  `current_value` decimal(10,2) NOT NULL COMMENT 'Valeur actuelle',
  `timestamp` datetime NOT NULL COMMENT 'Timestamp de détection',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
  
  PRIMARY KEY (`id`),
  FOREIGN KEY (`stats_id`) REFERENCES `mvp_stats_collection`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`device_id`) REFERENCES `appareils`(`id`) ON DELETE SET NULL
);
```

## 🔍 Requête SQL Utilisée

```sql
SELECT a.*, d.hostname, d.ip_address 
FROM mvp_anomalies a
LEFT JOIN mvp_device_stats d ON a.device_id = d.device_id
ORDER BY a.created_at DESC 
LIMIT 3
```

## 🧪 Étapes de Test

### Test Backend
1. **Vérifier l'endpoint de test:**
   ```bash
   curl -X GET "http://localhost:3000/api/mvp-stats/test-anomalies" \
        -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

2. **Vérifier l'endpoint principal:**
   ```bash
   curl -X GET "http://localhost:3000/api/mvp-stats/anomalies?limit=3" \
        -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

### Test Frontend
1. **Ouvrir le dashboard** dans le navigateur
2. **Vérifier le widget "🚨 Détection d'Anomalies"**
3. **S'assurer que les 3 dernières anomalies s'affichent** avec :
   - Type d'anomalie (badge coloré)
   - Nom de l'appareil
   - Heure de détection

## ✅ Critères de Succès

### Backend
- [ ] L'endpoint `/mvp-stats/test-anomalies` retourne une réponse valide
- [ ] L'endpoint `/mvp-stats/anomalies?limit=3` retourne les 3 dernières anomalies
- [ ] Les données proviennent bien de la table `mvp_anomalies`
- [ ] La jointure avec `mvp_device_stats` fonctionne pour récupérer hostname/ip

### Frontend
- [ ] Le widget affiche les anomalies récupérées de l'API
- [ ] Les badges de sévérité sont colorés correctement (rouge pour critical, orange pour warning)
- [ ] Le nom de l'appareil s'affiche (hostname ou IP)
- [ ] L'heure de détection est formatée correctement
- [ ] Le message "Aucune anomalie détectée" s'affiche si aucune anomalie

### Données
- [ ] Les anomalies sont triées par date de création décroissante
- [ ] Seules les 3 dernières anomalies sont affichées
- [ ] Les champs `type`, `severity`, `message`, `device`, `time` sont présents

## 🐛 Dépannage

### Problèmes Courants

1. **Aucune anomalie affichée:**
   - Vérifier que la table `mvp_anomalies` contient des données
   - Vérifier les permissions de base de données
   - Vérifier les logs du backend

2. **Erreur de jointure:**
   - Vérifier que la table `mvp_device_stats` existe
   - Vérifier que les `device_id` correspondent entre les tables

3. **Données manquantes:**
   - Vérifier que tous les champs requis sont présents dans la table
   - Vérifier le mapping des données dans le service

### Logs à Surveiller
```bash
# Backend logs
[TEST] Test de récupération des anomalies de la table mvp_anomalies
[TEST] Anomalies récupérées: 3
[TEST] Test anomalies terminé avec succès

# Erreurs possibles
[TEST] Erreur test anomalies: Table 'mvp_anomalies' doesn't exist
[TEST] Erreur test anomalies: ER_NO_SUCH_TABLE
```

## 📊 Métriques de Performance

- **Temps de réponse:** < 500ms pour récupérer 3 anomalies
- **Requêtes SQL:** 1 seule requête avec jointure LEFT JOIN
- **Mémoire:** < 1MB pour le traitement des données

## 🔄 Mise à Jour

Ce test vérifie que le widget des anomalies du dashboard récupère correctement les 3 dernières anomalies de la table `mvp_anomalies` au lieu d'utiliser des données simulées. La modification garantit que les données affichées sont réelles et à jour. 