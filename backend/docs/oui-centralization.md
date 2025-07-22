# Centralisation de la Gestion OUI - Documentation

## Vue d'ensemble

Ce document décrit la centralisation de la gestion OUI (Organizationally Unique Identifier) dans le module réseau de Netpulse. Cette refactorisation élimine les duplications de code et standardise la détection du type d'appareil.

## Problèmes Résolus

### Avant la centralisation
- **Duplication de code** : Chaque service avait sa propre implémentation de `mapStringToDeviceType()`
- **Incohérences** : Différents préfixes MAC et logiques de détection entre services
- **Gestion OUI multiple** : Chaque service chargeait sa propre instance de `oui-db.json`
- **Maintenance difficile** : Modifications nécessaires dans plusieurs fichiers

### Après la centralisation
- **Code unifié** : Un seul point de vérité pour la détection de type d'appareil
- **Cohérence** : Même logique de détection dans tous les services
- **Gestion centralisée** : Une seule instance de la base OUI
- **Maintenance simplifiée** : Modifications dans un seul endroit

## Architecture

### Services Centralisés

#### 1. OuiService (`src/modules/network/services/oui.service.ts`)

**Responsabilités :**
- Chargement et gestion de la base de données OUI
- Normalisation des adresses MAC
- Extraction des préfixes OUI
- Mapping des constructeurs vers les types d'appareils

**Méthodes principales :**
```typescript
// Détermine le type d'appareil basé sur l'adresse MAC
getDeviceTypeFromMac(macAddress: string): { deviceType: DeviceType; confidence: number; vendor?: string }

// Obtient les informations du constructeur
getVendorInfo(macAddress: string): { vendor: string; oui: string } | null

// Met à jour la base de données OUI
updateOuiDatabase(): Promise<void>

// Obtient les statistiques de la base OUI
getOuiStats(): { totalEntries: number; loaded: boolean; path: string }
```

#### 2. DeviceTypeService (`src/modules/network/services/device-type.service.ts`)

**Responsabilités :**
- Détection multi-méthodes du type d'appareil
- Gestion des patterns de détection
- Validation de cohérence
- Statistiques de détection

**Méthodes principales :**
```typescript
// Détection complète du type d'appareil
detectDeviceType(params: {
  macAddress?: string;
  openPorts?: number[];
  hostname?: string;
  os?: string;
  ttl?: number;
}): DeviceTypeDetectionResult

// Validation de cohérence
validateDeviceType(deviceType: DeviceType, openPorts: number[]): { isValid: boolean; confidence: number }

// Obtient les ports typiques pour un type d'appareil
getTypicalPorts(deviceType: DeviceType): number[]
```

## Méthodes de Détection

### 1. Détection par Adresse MAC (Priorité Élevée)
- **Confiance** : 0.7 - 0.9
- **Méthode** : Utilisation de la base OUI et des préfixes MAC connus
- **Avantages** : Très fiable pour les constructeurs connus

### 2. Détection par Ports Ouverts
- **Confiance** : 0.6 - 0.8
- **Méthode** : Analyse des ports typiques par type d'appareil
- **Avantages** : Fonctionne même sans adresse MAC

### 3. Détection par Nom d'Hôte
- **Confiance** : 0.5 - 0.7
- **Méthode** : Patterns regex sur le nom d'hôte
- **Avantages** : Rapide et efficace

### 4. Détection par OS
- **Confiance** : 0.4 - 0.6
- **Méthode** : Patterns sur le système d'exploitation
- **Avantages** : Complémentaire aux autres méthodes

### 5. Détection par TTL
- **Confiance** : 0.3 - 0.4
- **Méthode** : Analyse du Time To Live des paquets
- **Avantages** : Indicateur rapide mais peu précis

## Configuration

### Mapping des Constructeurs

Le service OUI utilise un mapping extensif des constructeurs vers les types d'appareils :

```typescript
private readonly vendorToDeviceType: DeviceTypeMapping = {
  'cisco': DeviceType.ROUTER,
  'juniper': DeviceType.ROUTER,
  'extreme': DeviceType.SWITCH,
  'aruba': DeviceType.AP,
  // ... plus de 100 mappings
}
```

### Préfixes MAC Connus

Pour une détection rapide, certains préfixes MAC sont directement mappés :

```typescript
private readonly knownMacPrefixes: Record<string, DeviceType> = {
  '00:50:56': DeviceType.SERVER, // VMware
  'B8:27:EB': DeviceType.SERVER, // Raspberry Pi
  '00:1A:79': DeviceType.ROUTER, // Router
  // ... plus de 200 préfixes
}
```

### Ports Typiques par Type d'Appareil

```typescript
private readonly portBasedDetection: PortBasedDetection = {
  router: {
    ports: [22, 23, 80, 443, 161, 162, 8080, 8443],
    score: 3,
    deviceType: DeviceType.ROUTER
  },
  // ... autres types
}
```

## Migration

### Script de Migration Automatisé

Un script de migration est fourni pour automatiser la transition :

```bash
# Exécuter la migration
npm run migrate:oui

# Ou directement
node scripts/migrate-oui-centralization.js
```

### Étapes de Migration

1. **Préparation**
   - Sauvegarde des fichiers existants
   - Vérification des dépendances

2. **Migration**
   - Suppression des imports fs/path pour oui-db
   - Ajout des imports des services centralisés
   - Mise à jour des constructeurs
   - Remplacement des appels de fonctions

3. **Validation**
   - Tests des fonctionnalités
   - Vérification de la cohérence
   - Nettoyage du code obsolète

## Utilisation

### Dans un Service Existant

```typescript
import { Injectable } from '@nestjs/common';
import { OuiService } from '../services/oui.service';
import { DeviceTypeService } from '../services/device-type.service';

@Injectable()
export class MonService {
  constructor(
    private readonly ouiService: OuiService,
    private readonly deviceTypeService: DeviceTypeService,
  ) {}

  async detectDeviceType(macAddress: string, openPorts: number[]) {
    const result = this.deviceTypeService.detectDeviceType({
      macAddress,
      openPorts
    });
    
    return result;
  }
}
```

### Dans le Module

```typescript
@Module({
  providers: [
    OuiService,
    DeviceTypeService,
    // ... autres services
  ],
  exports: [
    OuiService,
    DeviceTypeService,
    // ... autres exports
  ],
})
export class NetworkModule {}
```

## Tests

### Tests Unitaires

```typescript
describe('OuiService', () => {
  it('should detect router from MAC address', () => {
    const result = ouiService.getDeviceTypeFromMac('00:1A:79:12:34:56');
    expect(result.deviceType).toBe(DeviceType.ROUTER);
    expect(result.confidence).toBeGreaterThan(0.7);
  });
});
```

### Tests d'Intégration

```typescript
describe('DeviceTypeService Integration', () => {
  it('should detect device type from multiple sources', () => {
    const result = deviceTypeService.detectDeviceType({
      macAddress: '00:1A:79:12:34:56',
      openPorts: [22, 80, 443],
      hostname: 'router-gateway'
    });
    
    expect(result.deviceType).toBe(DeviceType.ROUTER);
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});
```

## Maintenance

### Mise à Jour de la Base OUI

```typescript
// Mise à jour programmatique
await ouiService.updateOuiDatabase();

// Ou via script
node scripts/generate-oui-db.js
```

### Ajout de Nouveaux Constructeurs

```typescript
// Dans OuiService
private readonly vendorToDeviceType: DeviceTypeMapping = {
  // ... existants
  'nouveau-constructeur': DeviceType.ROUTER,
};
```

### Ajout de Nouveaux Préfixes MAC

```typescript
// Dans OuiService
private readonly knownMacPrefixes: Record<string, DeviceType> = {
  // ... existants
  'AA:BB:CC': DeviceType.SERVER,
};
```

## Monitoring et Statistiques

### Statistiques de Détection

```typescript
const stats = deviceTypeService.getDetectionStats();
console.log('OUI Stats:', stats.ouiStats);
console.log('Port-based types:', stats.portBasedTypes);
```

### Logs de Détection

Les services centralisés fournissent des logs détaillés :

```
[DEVICE-TYPE] Détection pour: MAC=00:1A:79:12:34:56, Ports=22,80,443, Hostname=router-gateway, OS=Linux, TTL=64
[DEVICE-TYPE] Détection MAC réussie: ROUTER (confiance: 0.9)
```

## Performance

### Optimisations

1. **Cache en mémoire** : La base OUI est chargée une seule fois
2. **Détection rapide** : Préfixes MAC connus pour détection immédiate
3. **Fallback intelligent** : Méthodes de détection en cascade
4. **Validation** : Vérification de cohérence des résultats

### Métriques

- **Temps de chargement OUI** : < 100ms
- **Détection par MAC** : < 1ms
- **Détection multi-source** : < 10ms
- **Mémoire utilisée** : ~2MB pour la base OUI complète

## Troubleshooting

### Problèmes Courants

1. **Base OUI non trouvée**
   ```
   [OUI] Erreur chargement oui-db.json: ENOENT: no such file or directory
   ```
   **Solution** : Vérifier que le fichier `utils/oui-db.json` existe

2. **Détection incorrecte**
   ```
   [DEVICE-TYPE] Aucune détection réussie, fallback vers OTHER
   ```
   **Solution** : Vérifier les patterns et ajouter de nouveaux mappings

3. **Erreurs de dépendance**
   ```
   Error: Cannot resolve dependencies of OuiService
   ```
   **Solution** : Vérifier que les services sont bien déclarés dans le module

### Debug

Activer les logs de debug :

```typescript
// Dans le service
this.logger.debug(`[DEVICE-TYPE] Détection détaillée: ${JSON.stringify(params)}`);
```

## Évolutions Futures

### Fonctionnalités Planifiées

1. **API REST** : Endpoints pour la détection de type d'appareil
2. **Machine Learning** : Amélioration de la détection par IA
3. **Base de données** : Stockage des détections en base
4. **Interface web** : Interface de gestion des mappings
5. **Synchronisation** : Mise à jour automatique de la base OUI

### Extensibilité

Le système est conçu pour être facilement extensible :

- Ajout de nouvelles méthodes de détection
- Support de nouveaux types d'appareils
- Intégration avec d'autres systèmes
- API publique pour les développeurs

## Conclusion

La centralisation de la gestion OUI apporte une amélioration significative de la maintenabilité, de la cohérence et des performances du système de détection de type d'appareil. Cette architecture permet une évolution future plus facile et une meilleure qualité du code. 