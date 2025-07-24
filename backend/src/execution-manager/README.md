# Gestionnaire d'exécution centralisé

## Présentation
Ce module permet d'orchestrer toutes les tâches du backend (scans, génération de topologie, opérations utilisateur, logs, scripts, etc.) de façon centralisée, priorisée et robuste.

## Utilisation

### 1. Soumission d'une tâche
- Utiliser le service `ExecutionManagerService` pour soumettre une tâche (ex: ScanTask, TopologyTask, UserTask, LogTask, UtilTask).
- Exemple :
```typescript
const task = new ScanTask(() => this.scanNetwork(config.target, userId), { userId, priority: 10 });
this.executionManager.submit(task);
```
- Pour une tâche immédiate (lecture, CRUD rapide), utiliser `isImmediate: true`.

### 2. Suivi et annulation
- L'API interne expose :
  - `GET /internal/execution-manager/tasks` : liste des tâches en cours et en attente
  - `GET /internal/execution-manager/tasks/:id` : détail d'une tâche
  - `DELETE /internal/execution-manager/tasks/:id` : annulation d'une tâche
  - `GET /internal/execution-manager/logs` : logs d'exécution
  - `GET /internal/execution-manager/metrics` : métriques globales

### 3. Déconnexion
- Appeler `this.executionManager.disconnect()` pour arrêter toutes les tâches (ex: lors d'un logout ou d'un arrêt serveur).

### 4. Ajout d'un nouveau type de tâche
- Créer une classe héritant de `ExecutionTask` dans `tasks/`.
- Définir la logique métier dans la méthode `run()`.
- Définir la priorité, le contexte utilisateur, etc.

### 5. Bonnes pratiques
- Toujours soumettre les tâches longues ou potentiellement bloquantes au gestionnaire.
- Utiliser le slot réservé pour les tâches immédiates.
- Définir les callbacks de rollback/cleanup pour chaque tâche si besoin.
- Consulter les logs et métriques pour le monitoring.

## Exemple d'intégration dans un service
```typescript
import { ExecutionManagerService } from '../execution-manager/execution-manager.service';
import { ScanTask } from '../execution-manager/tasks/scan.task';

@Injectable()
export class NetworkService {
  constructor(private readonly executionManager: ExecutionManagerService) {}

  async submitScan(config, userId) {
    const task = new ScanTask(() => this.scanNetwork(config.target, userId), { userId, priority: 10 });
    this.executionManager.submit(task);
    return task.id;
  }
}
```

## Contact
Pour toute question, contacter l'équipe backend. 