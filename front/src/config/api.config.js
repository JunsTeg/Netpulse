// Configuration de l'API
const API_CONFIG = {
  // URL de base de l'API avec fallback
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  
  // Environnement actuel
  ENV: import.meta.env.VITE_APP_ENV || 'development',
  
  // Configuration des headers par defaut
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  
  // Prefixes des differentes sections
  PREFIXES: {
    MAIN: 'api',
    AUTH: 'auth',
    USERS: 'users',
    PROFILE: 'profile',
    SETTINGS: 'settings',
    VERSION: 'v1'
  },
  
  // Routes completes avec gestion dynamique de l'URL de base
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
    },
    NETWORK: {
      SCAN: '/api/network/scan',
      DEVICES: '/api/network/devices',
      DEVICE: (id) => `/api/network/devices/${id}`,
      TOPOLOGY: '/api/network/topology',
      STATS: (id) => `/api/network/devices/${id}/stats`,
      DETECT: '/api/network/detect',
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

// Fonction utilitaire pour construire les URLs avec gestion des environnements
const buildApiUrl = (path) => {
  const baseUrl = API_CONFIG.BASE_URL;
  // Suppression des doubles slashes sauf pour http(s)://
  const cleanPath = path.replace(/([^:]\/)\/+/g, '$1');
  return `${baseUrl}${cleanPath}`;
};

// Fonction pour obtenir l'URL de l'API en fonction de l'environnement
const getApiUrl = () => {
  return API_CONFIG.BASE_URL;
};

// Export par defaut de la configuration
export default API_CONFIG;

// Export nomme pour la compatibilite
export { API_CONFIG, buildApiUrl, getApiUrl }; 