// Configuration des prefixes d'API
export const API_PREFIXES = {
  // Prefixes des differentes sections
  AUTH: 'auth',
  USERS: 'users',
  PROFILE: 'profile',
  SETTINGS: 'settings',
  
  // Version de l'API (pour future utilisation)
  VERSION: 'v1'
} as const;

// Configuration des routes completes
export const API_ROUTES = {
  // Routes d'authentification
  AUTH: {
    REGISTER: `/${API_PREFIXES.AUTH}/register`,
    LOGIN: `/${API_PREFIXES.AUTH}/login`,
    LOGOUT: `/${API_PREFIXES.AUTH}/logout`,
    VALIDATE_TOKEN: `/${API_PREFIXES.AUTH}/validate-token`,
    REFRESH_TOKEN: `/${API_PREFIXES.AUTH}/refresh-token`,
  },
  
  // Routes utilisateurs
  USERS: {
    ME: `/${API_PREFIXES.USERS}/me`,
    PROFILE: `/${API_PREFIXES.USERS}/profile`,
    SETTINGS: `/${API_PREFIXES.USERS}/settings`,
  }
} as const;

// Configuration des reponses d'API
export const API_RESPONSES = {
  SUCCESS: {
    OK: 'Operation reussie',
    CREATED: 'Ressource creee avec succes',
    UPDATED: 'Ressource mise a jour avec succes',
    DELETED: 'Ressource supprimee avec succes',
  },
  ERROR: {
    UNAUTHORIZED: 'Non autorise',
    FORBIDDEN: 'Acces refuse',
    NOT_FOUND: 'Ressource non trouvee',
    CONFLICT: 'Conflit detecte',
    VALIDATION_ERROR: 'Erreur de validation',
    SERVER_ERROR: 'Erreur serveur',
  }
} as const; 