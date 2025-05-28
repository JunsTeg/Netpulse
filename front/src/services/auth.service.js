import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

// Configuration globale d'axios
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

class AuthService {
  // Methode pour enregistrer un nouvel utilisateur
  async register(username, email, password) {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        username,
        email,
        password,
      });
      if (response.data.access_token) {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Methode pour connecter un utilisateur
  async login(username, password) {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        username,
        password,
      });
      if (response.data.access_token) {
        localStorage.setItem('user', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Methode pour deconnecter l'utilisateur
  async logout() {
    try {
      await axios.post(`${API_URL}/auth/logout`);
      localStorage.removeItem('user');
      return true;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Methode pour recuperer l'utilisateur courant
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  }

  // Methode pour verifier si l'utilisateur est connecte
  isLoggedIn() {
    return !!this.getCurrentUser();
  }

  // Methode pour recuperer le token
  getToken() {
    const user = this.getCurrentUser();
    return user ? user.access_token : null;
  }

  // Methode pour gerer les erreurs
  handleError(error) {
    if (error.response) {
      // Erreur de reponse du serveur
      const message = error.response.data.message || 'Une erreur est survenue';
      throw new Error(message);
    } else if (error.request) {
      // Pas de reponse du serveur
      throw new Error('Impossible de contacter le serveur');
    } else {
      // Erreur lors de la configuration de la requete
      throw new Error('Erreur de configuration de la requete');
    }
  }
}

export default new AuthService(); 