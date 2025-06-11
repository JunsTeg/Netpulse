// Configuration de l'API
const API_CONFIG = {
  // URL de base de l'API
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  
  // Configuration des headers par defaut
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  
  // Timeout des requetes en millisecondes
  timeout: 5000,
  
  // Configuration des credentials
  withCredentials: true,
};

export default API_CONFIG; 