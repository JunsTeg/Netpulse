import API_CONFIG from '../config/api.config';

class ApiService {
  constructor() {
    this.baseURL = API_CONFIG.baseURL;
    this.headers = API_CONFIG.headers;
    console.log('Configuration API initiale:', {
      baseURL: this.baseURL,
      headers: this.headers
    });
  }

  // Methode generique pour les requetes
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    console.log('=== DETAILS DE LA REQUETE ===');
    console.log('URL complete:', url);
    console.log('Endpoint:', endpoint);
    console.log('Base URL:', this.baseURL);

    const config = {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
      credentials: 'include',
      mode: 'cors', // Ajout explicite du mode CORS
    };
    console.log('Configuration complete:', {
      method: config.method,
      headers: config.headers,
      credentials: config.credentials,
      mode: config.mode,
      body: config.body ? JSON.parse(config.body) : undefined
    });

    try {
      console.log('Envoi de la requete...');
      const response = await fetch(url, config);
      console.log('=== REPONSE DU SERVEUR ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur complete:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText
        });
        throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Donnees recues:', data);
      return data;
    } catch (error) {
      console.error('=== ERREUR DETAILLEE ===');
      console.error('Type:', error.name);
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      throw error;
    }
  }

  // Methodes CRUD
  async get(endpoint) {
    console.log('=== REQUETE GET ===');
    return this.request(endpoint, { 
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
  }

  async post(endpoint, data) {
    console.log('=== REQUETE POST ===');
    console.log('Donnees a envoyer:', data);
    return this.request(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// Export une instance unique du service
export default new ApiService(); 