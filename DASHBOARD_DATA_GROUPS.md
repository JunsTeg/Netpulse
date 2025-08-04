# 📊 Groupes de Données pour Dashboard Dynamique NetPulse

## Vue d'ensemble

Ce document détaille tous les groupes de données nécessaires pour rendre le dashboard NetPulse complètement dynamique avec les données du backend.

## 🎯 Groupes de Données Principaux

### 1. **Données de Base du Réseau** ✅ (Implémenté)
**Endpoint:** `/network/dashboard/summary`

**Données disponibles:**
- `devicesActive` - Nombre d'appareils actifs
- `devicesInactive` - Nombre d'appareils inactifs  
- `alertsActive` - Nombre d'alertes actives
- `incidentsCritical` - Nombre d'incidents critiques
- `totalDownload` - Bande passante totale téléchargement
- `totalUpload` - Bande passante totale upload
- `evolution24h` - Évolution sur 24h (pour graphiques)

**Utilisation dans le dashboard:**
- Cartes de statistiques principales
- Indicateurs de santé réseau

---

### 2. **Statistiques MVP (Performance)** ✅ (Implémenté)
**Endpoint:** `/mvp-stats/dashboard`

**Données disponibles:**
- `avgCpu` - CPU moyen des appareils
- `avgMemory` - Mémoire moyenne utilisée
- `avgBandwidth` - Bande passante moyenne
- `totalCollections` - Nombre total de collectes
- `avgCollectionTime` - Temps moyen de collecte
- `lastCollection` - Dernière collecte effectuée

**Utilisation dans le dashboard:**
- Métriques de performance système
- Indicateurs de charge réseau

---

### 3. **Anomalies Récentes** ✅ (Implémenté)
**Endpoint:** `/mvp-stats/anomalies?limit=10`

**Données disponibles:**
- `id` - Identifiant de l'anomalie
- `anomalyType` - Type d'anomalie (CPU_HIGH, LATENCY_HIGH, etc.)
- `deviceId` - Appareil concerné
- `severity` - Sévérité (critical, warning, info)
- `description` - Description de l'anomalie
- `detectedAt` - Date/heure de détection

**Utilisation dans le dashboard:**
- Tableau des anomalies récentes
- Badges de sévérité colorés
- Alertes en temps réel

---

### 4. **Appareils à Risque** ✅ (Implémenté)
**Endpoint:** `/network/devices`

**Données disponibles:**
- `id` - Identifiant de l'appareil
- `hostname` - Nom de l'hôte
- `ipAddress` - Adresse IP
- `stats.cpuUsage` - Utilisation CPU
- `stats.memoryUsage` - Utilisation mémoire
- `stats.latency` - Latence réseau

**Utilisation dans le dashboard:**
- Graphique en barres CPU
- Tableau des machines à risque
- Indicateurs de performance

---

### 5. **État des Agents** ⚠️ (Partiellement implémenté)
**Endpoint:** `/network/agents/status` (à créer)

**Données nécessaires:**
- `id` - Identifiant de l'agent
- `name` - Nom de l'agent (Nmap, Stats, Ping, etc.)
- `status` - Statut (OK, KO, WARNING)
- `lastRun` - Dernière exécution
- `nextRun` - Prochaine exécution prévue
- `uptime` - Temps de fonctionnement

**Utilisation dans le dashboard:**
- Liste des agents de surveillance
- Indicateurs de santé des services
- Monitoring des processus

---

### 6. **Journal d'Activité** ❌ (À implémenter)
**Endpoint:** `/network/activity-log` (à créer)

**Données nécessaires:**
- `id` - Identifiant de l'action
- `user` - Utilisateur ayant effectué l'action
- `action` - Description de l'action
- `timestamp` - Date/heure de l'action
- `type` - Type d'action (scan, config, alert, etc.)
- `details` - Détails supplémentaires

**Utilisation dans le dashboard:**
- Journal d'activité utilisateur
- Audit trail
- Historique des actions

---

### 7. **Données de Latence Historiques** ❌ (À implémenter)
**Endpoint:** `/mvp-stats/latency-history` (à créer)

**Données nécessaires:**
- `timestamp` - Date/heure de la mesure
- `avgLatency` - Latence moyenne
- `maxLatency` - Latence maximale
- `minLatency` - Latence minimale
- `deviceCount` - Nombre d'appareils mesurés

**Utilisation dans le dashboard:**
- Graphique de latence sur 7 jours
- Tendances de performance
- Analyse temporelle

---

### 8. **Alertes et Notifications** ⚠️ (Partiellement implémenté)
**Endpoint:** `/network/alerts`

**Données disponibles:**
- `id` - Identifiant de l'alerte
- `type` - Type d'alerte
- `severity` - Sévérité
- `message` - Message d'alerte
- `timestamp` - Date/heure
- `status` - Statut (active, resolved)

**Utilisation dans le dashboard:**
- Compteurs d'alertes
- Notifications en temps réel
- Gestion des incidents

---

### 9. **Statistiques de Performance Système** ✅ (Implémenté)
**Endpoint:** `/mvp-stats/performance`

**Données disponibles:**
- `totalCollections` - Nombre total de collectes
- `avgCollectionTime` - Temps moyen de collecte
- `successRate` - Taux de succès
- `errorRate` - Taux d'erreur
- `lastCollection` - Dernière collecte

**Utilisation dans le dashboard:**
- Métriques de performance
- Indicateurs de fiabilité
- Monitoring système

---

### 10. **Configuration et Seuils** ❌ (À implémenter)
**Endpoint:** `/network/thresholds` (à créer)

**Données nécessaires:**
- `cpuThreshold` - Seuil CPU
- `memoryThreshold` - Seuil mémoire
- `latencyThreshold` - Seuil latence
- `bandwidthThreshold` - Seuil bande passante
- `alertSettings` - Configuration des alertes

**Utilisation dans le dashboard:**
- Configuration des seuils
- Personnalisation des alertes
- Paramètres de surveillance

---

## 🔄 Fonctionnalités Dynamiques

### Rechargement Automatique
- **Intervalle:** 30 secondes
- **Déclencheurs:** Bouton manuel, timer automatique
- **Indicateurs:** Spinners, timestamps de mise à jour

### Actions Utilisateur
- **Scan Réseau:** Déclenchement manuel de scan
- **Génération Rapport:** Création de rapports
- **Actualisation:** Rechargement des données

### Gestion d'Erreurs
- **Fallback:** Données par défaut en cas d'erreur
- **Retry:** Bouton de réessai
- **Logging:** Console logs pour debug

## 📊 Structure des Données

### Format de Réponse Standard
```javascript
{
  success: boolean,
  data: object,
  timestamp: string,
  error?: string
}
```

### Gestion des États
```javascript
{
  loading: boolean,
  refreshing: boolean,
  error: string | null,
  lastUpdate: Date | null,
  data: object | null
}
```

## 🚀 Prochaines Étapes

### Priorité 1 (Critique)
1. ✅ Implémenter les endpoints manquants
2. ✅ Tester la récupération des données
3. ✅ Optimiser les performances

### Priorité 2 (Important)
1. ❌ Ajouter le journal d'activité
2. ❌ Implémenter les données de latence historiques
3. ❌ Créer l'endpoint des agents

### Priorité 3 (Amélioration)
1. ❌ Ajouter la configuration des seuils
2. ❌ Implémenter les notifications push
3. ❌ Optimiser le cache des données

## 🔧 Endpoints à Créer

### Backend - Nouveaux Endpoints
```typescript
// 1. État des agents
GET /network/agents/status

// 2. Journal d'activité
GET /network/activity-log
POST /network/activity-log

// 3. Historique latence
GET /mvp-stats/latency-history

// 4. Configuration seuils
GET /network/thresholds
PUT /network/thresholds

// 5. Rapports
POST /network/reports
```

### Frontend - Services à Compléter
```javascript
// 1. Service d'activité
activityService.getActivityLog()
activityService.logActivity()

// 2. Service de configuration
configService.getThresholds()
configService.updateThresholds()

// 3. Service de rapports
reportService.generateReport()
```

## 📈 Métriques de Performance

### Objectifs
- **Temps de chargement:** < 2 secondes
- **Fréquence de mise à jour:** 30 secondes
- **Disponibilité:** 99.9%
- **Taille des données:** < 1MB par requête

### Monitoring
- Temps de réponse des API
- Taux d'erreur
- Utilisation mémoire
- Charge CPU

---

*Document créé pour le projet NetPulse - Dashboard Dynamique*
*Dernière mise à jour: 2024* 