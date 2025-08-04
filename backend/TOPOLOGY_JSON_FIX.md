# Correction du problème de parsing JSON dans la génération de topologie

## Problème identifié

### Erreur rencontrée
```
Erreur : Erreur lors de la génération de la topologie: Erreur lors de la génération de topologie depuis la BD: Échec de la génération de topologie: Impossible de récupérer les appareils: "[object Object]" is not valid JSON
```

### Cause racine
Le problème se produisait dans le `DeviceRepository.getActiveDevices()` à la ligne 47 :

```typescript
stats: row.stats ? JSON.parse(row.stats) : {
```

**Pourquoi cela échouait :**
1. Le champ `stats` dans la base de données est de type `JSON` (MySQL)
2. Sequelize **parse automatiquement** les champs JSON en objets JavaScript lors de la récupération
3. Le code essayait ensuite de re-parser cet objet avec `JSON.parse()`
4. `JSON.parse()` attend une chaîne, mais recevait un objet déjà parsé
5. Résultat : `"[object Object]"` au lieu d'un objet valide

## Solution implémentée

### 1. Méthode `parseStatsField()` ajoutée

```typescript
private parseStatsField(stats: any, isActive: boolean): any {
  try {
    // Si stats est déjà un objet (parsé par Sequelize)
    if (typeof stats === 'object' && stats !== null) {
      return stats;
    }
    
    // Si stats est une chaîne JSON
    if (typeof stats === 'string') {
      return JSON.parse(stats);
    }
    
    // Valeur par défaut si stats est null/undefined
    return {
      status: isActive ? 'active' : 'inactive',
      cpu: 0,
      memory: 0,
      bandwidth: { download: 0, upload: 0 },
      latency: 0,
      uptime: '0',
      services: [],
    };
  } catch (error) {
    this.logger.warn(`[REPOSITORY] Erreur parsing stats: ${error.message}, utilisation des valeurs par défaut`);
    return {
      status: isActive ? 'active' : 'inactive',
      cpu: 0,
      memory: 0,
      bandwidth: { download: 0, upload: 0 },
      latency: 0,
      uptime: '0',
      services: [],
    };
  }
}
```

### 2. Remplacement des appels directs à `JSON.parse()`

**Avant :**
```typescript
stats: row.stats ? JSON.parse(row.stats) : { /* defaults */ }
```

**Après :**
```typescript
stats: this.parseStatsField(row.stats, row.isActive)
```

## Fichiers modifiés

### `backend/src/modules/topology/repositories/device.repository.ts`
- ✅ Ajout de la méthode `parseStatsField()`
- ✅ Remplacement de tous les appels `JSON.parse(row.stats)` par `this.parseStatsField(row.stats, row.isActive)`
- ✅ Gestion robuste des erreurs de parsing

### `backend/test-topology-fix.js`
- ✅ Script de test pour vérifier la correction
- ✅ Test des différents formats de données stats
- ✅ Validation de la requête complète

## Avantages de cette solution

1. **Robuste** : Gère tous les cas possibles (objet, chaîne, null, undefined)
2. **Rétrocompatible** : Fonctionne avec les données existantes
3. **Sécurisée** : Gestion d'erreur avec fallback vers des valeurs par défaut
4. **Maintenable** : Logique centralisée dans une méthode dédiée
5. **Loggée** : Messages d'avertissement en cas d'erreur de parsing

## Test de la correction

### 1. Exécuter le script de test
```bash
cd backend
node test-topology-fix.js
```

### 2. Redémarrer l'application
```bash
npm run start:dev
```

### 3. Tester la génération de topologie
- Aller sur la page de topologie
- Cliquer sur "Générer la topologie"
- Vérifier qu'aucune erreur de parsing JSON n'apparaît

## Vérification

Après la correction, la génération de topologie devrait fonctionner sans erreur. Les logs devraient afficher :

```
[REPOSITORY] X appareils actifs récupérés
[TOPOLOGY] X appareils récupérés en Xms
[TOPOLOGY] Topologie générée avec succès en Xms
```

## Notes importantes

- Cette correction est **rétrocompatible** avec les données existantes
- Le `AppareilRepository` gère déjà correctement ce cas (pas de modification nécessaire)
- La correction s'applique uniquement au `DeviceRepository` utilisé par le service de topologie
- Les valeurs par défaut garantissent que l'application continue de fonctionner même avec des données corrompues 