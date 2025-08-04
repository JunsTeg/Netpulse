# Module MVP Stats - Collecte de Statistiques Windows

## Vue d'ensemble

Le module MVP Stats est un système complet de collecte de statistiques réseau et système optimisé pour Windows. Il utilise une approche hybride combinant les outils natifs Windows avec des outils tiers pour contourner les limitations de la plateforme.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MVP STATS MODULE                         │
├─────────────────────────────────────────────────────────────┤
│  [Controller] → [Service] → [Collectors] → [Processors]     │
│                                                             │
│  • MvpStatsController    - Endpoints API                   │
│  • MvpStatsService       - Orchestration principale        │
│  • MvpDeviceCollector    - Collecte par appareil          │
│  • MvpDataProcessor      - Traitement des données          │
│  • MvpAnomalyDetector    - Détection d'anomalies           │
│  • MvpResponseFormatter  - Formatage des réponses          │
│  • MvpStatsRepository    - Persistance des données         │
└─────────────────────────────────────────────────────────────┘
```

## Fonctionnalités

### ✅ Collecte de Statistiques
- **Système** : CPU, mémoire, uptime
- **Réseau** : Bande passante, latence, jitter, perte de paquets
- **Appareils** : Support multi-appareils depuis la base de données
- **Sources** : Windows natif, Iperf3, Nmap, SNMP

### ✅ Détection d'Anomalies
- **Seuils configurables** : CPU, mémoire, bande passante, latence
- **Niveaux de sévérité** : Info, Warning, Critical
- **Détection globale** : Patterns réseau, taux d'échec
- **Alertes intelligentes** : Messages contextuels

### ✅ Traitement des Données
- **Validation** : Vérification intégrité des données
- **Normalisation** : Nettoyage et formatage
- **Agrégation** : Calculs de moyennes et totaux
- **Filtrage** : Par type d'appareil, métriques, statut

### ✅ Persistance
- **Base de données** : Tables optimisées pour les statistiques
- **Historique** : Conservation des données avec nettoyage automatique
- **Performance** : Index et requêtes optimisées
- **Export** : Formats CSV et JSON

## Installation

### 1. Prérequis Système

```bash
# Outils tiers recommandés (optionnels mais recommandés)
# Iperf3 pour les tests de bande passante
winget install iperf3

# Nmap pour l'analyse réseau
winget install nmap

# Wireshark pour l'analyse de paquets (optionnel)
winget install wireshark
```

### 2. Configuration Base de Données

Le module crée automatiquement les tables nécessaires :

```sql
-- Tables créées automatiquement
mvp_stats_collection     -- Collections de statistiques
mvp_device_stats         -- Statistiques par appareil
mvp_anomalies           -- Anomalies détectées
```

### 3. Intégration dans l'Application

Ajouter le module dans `app.module.ts` :

```typescript
import { MvpStatsModule } from './modules/mvp-stats/mvp-stats.module';

@Module({
  imports: [
    // ... autres modules
    MvpStatsModule
  ]
})
export class AppModule {}
```

## Utilisation

### Endpoints API

#### 1. Collecte de Statistiques
```http
POST /api/mvp-stats/collect
Content-Type: application/json

{
  "timeout": 30000,
  "parallelCollectors": 5,
  "useIperf3": true,
  "useNmap": true
}
```

#### 2. Statistiques Récentes
```http
GET /api/mvp-stats/recent?limit=10
```

#### 3. Statistiques par Période
```http
GET /api/mvp-stats/period?startDate=2024-01-01&endDate=2024-01-31
```

#### 4. Statistiques d'Appareil
```http
GET /api/mvp-stats/device/{deviceId}?limit=50
```

#### 5. Anomalies Récentes
```http
GET /api/mvp-stats/anomalies?limit=100
```

#### 6. Tableau de Bord
```http
GET /api/mvp-stats/dashboard
```

#### 7. Test de Connectivité
```http
GET /api/mvp-stats/test-connectivity/{deviceId}
```

#### 8. Configuration
```http
GET /api/mvp-stats/config
POST /api/mvp-stats/config
```

#### 9. Santé du Module
```http
GET /api/mvp-stats/health
```

### Configuration

#### Configuration par Défaut
```typescript
{
  timeout: 30000,           // 30 secondes
  retries: 2,               // 2 tentatives
  parallelCollectors: 5,    // 5 collecteurs parallèles
  useIperf3: true,          // Utiliser Iperf3
  useNmap: true,            // Utiliser Nmap
  anomalyThresholds: {
    cpu: 80,                // 80% CPU
    memory: 1000,           // 1000 MB
    bandwidth: 1,           // 1 Mbps
    latency: 100            // 100 ms
  }
}
```

#### Mise à Jour de la Configuration
```typescript
// Via l'API
POST /api/mvp-stats/config
{
  "timeout": 45000,
  "parallelCollectors": 10,
  "anomalyThresholds": {
    "cpu": 90,
    "memory": 500
  }
}

// Via le service
mvpStatsService.updateCollectionConfig({
  timeout: 45000,
  parallelCollectors: 10
});
```

## Stratégie de Collecte

### 1. Collecte Hybride
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Outils Tiers  │    │  Windows Natif  │    │    Fallback     │
│                 │    │                 │    │                 │
│ • Iperf3        │───▶│ • PowerShell    │───▶│ • Valeurs par   │
│ • Nmap          │    │ • Ping          │    │   défaut        │
│ • SNMP          │    │ • NetAdapter    │    │ • Erreurs       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2. Collecte Parallèle
- **Chunking** : Division des appareils en groupes
- **Limitation** : Contrôle du nombre de collecteurs parallèles
- **Pause** : Délais entre les chunks pour éviter la surcharge
- **Gestion d'erreurs** : Continuation même en cas d'échec partiel

### 3. Fallback Intelligent
1. **Essayer Iperf3** pour la bande passante
2. **Essayer Nmap** pour la latence
3. **Fallback Windows** pour les statistiques de base
4. **Valeurs par défaut** en cas d'échec total

## Détection d'Anomalies

### Types d'Anomalies
- **high-cpu** : CPU élevé
- **low-memory** : Mémoire faible
- **low-bandwidth** : Bande passante faible
- **high-latency** : Latence élevée
- **packet-loss** : Perte de paquets
- **service-down** : Service inaccessible

### Niveaux de Sévérité
- **info** : Information
- **warning** : Avertissement
- **critical** : Critique

### Seuils Configurables
```typescript
{
  cpu: {
    warning: 70,    // 70% CPU
    critical: 90    // 90% CPU
  },
  memory: {
    warning: 2000,  // 2000 MB
    critical: 1000  // 1000 MB
  },
  bandwidth: {
    warning: 5,     // 5 Mbps
    critical: 1     // 1 Mbps
  },
  latency: {
    warning: 100,   // 100 ms
    critical: 200   // 200 ms
  }
}
```

## Performance

### Optimisations
- **Collecte parallèle** : Traitement simultané d'appareils
- **Timeout configurable** : Éviter les blocages
- **Retry automatique** : Gestion des échecs temporaires
- **Cache des outils** : Vérification unique de disponibilité
- **Base de données optimisée** : Index et requêtes efficaces

### Métriques de Performance
```typescript
{
  collectionTime: 15000,      // 15 secondes
  processingTime: 500,        // 500 ms
  totalTime: 15500,           // 15.5 secondes
  memoryUsage: 128,           // 128 MB
  cpuUsage: 15                // 15% CPU
}
```

## Maintenance

### Nettoyage Automatique
```http
POST /api/mvp-stats/cleanup?daysToKeep=30
```

### Surveillance
```http
GET /api/mvp-stats/health
GET /api/mvp-stats/performance
```

### Logs
Le module utilise le système de logging NestJS avec des niveaux appropriés :
- **INFO** : Opérations normales
- **WARN** : Problèmes non critiques
- **ERROR** : Erreurs nécessitant attention

## Exemples d'Utilisation

### Collecte Simple
```typescript
// Collecte avec configuration par défaut
const result = await mvpStatsService.collectAllStats();

if (result.success) {
  console.log(`Collecte réussie: ${result.data.activeDevices}/${result.data.totalDevices} appareils`);
  console.log(`Anomalies détectées: ${result.data.globalAnomalies.count}`);
}
```

### Collecte Personnalisée
```typescript
// Collecte avec configuration personnalisée
const result = await mvpStatsService.collectAllStats({
  timeout: 60000,
  parallelCollectors: 10,
  useIperf3: false,
  anomalyThresholds: {
    cpu: 85,
    memory: 1500
  }
});
```

### Surveillance Continue
```typescript
// Collecte périodique
setInterval(async () => {
  try {
    const result = await mvpStatsService.collectAllStats();
    if (result.data.globalAnomalies.count > 0) {
      console.log('Anomalies détectées:', result.data.globalAnomalies.anomalies);
    }
  } catch (error) {
    console.error('Erreur collecte:', error.message);
  }
}, 300000); // Toutes les 5 minutes
```

## Dépannage

### Problèmes Courants

#### 1. Outils non disponibles
```
WARN: Iperf3 non disponible
WARN: Nmap non disponible
```
**Solution** : Installer les outils ou désactiver leur utilisation dans la configuration.

#### 2. Timeout de collecte
```
ERROR: Erreur collecte appareil: timeout
```
**Solution** : Augmenter le timeout dans la configuration.

#### 3. Erreurs de base de données
```
ERROR: Erreur sauvegarde base de données
```
**Solution** : Vérifier la connexion à la base de données et les permissions.

#### 4. Appareils non accessibles
```
WARN: 5 appareils non accessibles
```
**Solution** : Vérifier la connectivité réseau et les paramètres des appareils.

### Logs de Diagnostic
```bash
# Activer les logs détaillés
npm run start:dev

# Surveiller les logs en temps réel
tail -f logs/application.log | grep "MVP"
```

## Sécurité

### Bonnes Pratiques
1. **Authentification** : Protéger les endpoints sensibles
2. **Autorisation** : Limiter l'accès selon les rôles
3. **Validation** : Valider toutes les entrées utilisateur
4. **Logging** : Enregistrer les actions importantes
5. **Rate Limiting** : Limiter le nombre de requêtes

### Configuration Sécurisée
```typescript
// Désactiver les outils tiers si non nécessaires
{
  useIperf3: false,
  useNmap: false,
  timeout: 15000,  // Timeout plus court
  parallelCollectors: 3  // Moins de parallélisme
}
```

## Évolutions Futures

### Fonctionnalités Prévues
- **Machine Learning** : Détection d'anomalies avancée
- **Alertes en temps réel** : Notifications push/email
- **Graphiques interactifs** : Interface de visualisation
- **API WebSocket** : Mises à jour en temps réel
- **Export avancé** : Formats PDF, Excel
- **Intégration SIEM** : Connexion aux systèmes de sécurité

### Optimisations
- **Cache Redis** : Mise en cache des données fréquentes
- **Compression** : Réduction de la taille des données
- **Streaming** : Traitement en flux continu
- **Microservices** : Architecture distribuée

## Support

### Documentation
- **API Reference** : Documentation complète des endpoints
- **Examples** : Exemples d'utilisation pratiques
- **Troubleshooting** : Guide de résolution des problèmes

### Contact
- **Issues** : GitHub Issues pour les bugs
- **Discussions** : GitHub Discussions pour les questions
- **Wiki** : Documentation détaillée

---

**Version** : 1.0.0  
**Dernière mise à jour** : 2024  
**Compatibilité** : Windows 10/11, Node.js 18+  
**Licence** : MIT 