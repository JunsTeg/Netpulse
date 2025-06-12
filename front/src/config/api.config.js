// Configuration de l'API
export const API_CONFIG = {
  // URL de base de l'API
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  
  // Prefixes des differentes sections
  PREFIXES: {
    MAIN: 'api',
    AUTH: 'auth',
    USERS: 'users',
    PROFILE: 'profile',
    SETTINGS: 'settings',
    VERSION: 'v1'
  },
  
  // Routes completes
  ROUTES: {
    AUTH: {
      REGISTER: '/api/auth/register',
      LOGIN: '/api/auth/login',
      LOGOUT: '/api/auth/logout',
      VALIDATE_TOKEN: '/api/auth/validate-token',
      REFRESH_TOKEN: '/api/auth/refresh-token',
    },
    USERS: {
      ALL: '/api/users',
      GET: (id) => `/api/users/${id}`,
      CREATE: '/api/users',
      UPDATE: (id) => `/api/users/${id}`,
      DELETE: (id) => `/api/users/${id}`,
      ME: '/api/users/me',
      PROFILE: '/api/users/profile',
      SETTINGS: '/api/users/settings',
    }
  },
  
  // Messages de reponse
  RESPONSES: {
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
  }
};

// Fonction utilitaire pour construire les URLs
export const buildApiUrl = (path) => {
  return `${API_CONFIG.BASE_URL}${path}`;
}; 