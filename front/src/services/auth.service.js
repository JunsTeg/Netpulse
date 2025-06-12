import axios from 'axios';
import { API_CONFIG, buildApiUrl } from '../config/api.config';

// Configuration globale d'axios
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

class AuthService {
  // Methode pour enregistrer un nouvel utilisateur
  async register(username, email, password) {
    try {
      const response = await axios.post(buildApiUrl(API_CONFIG.ROUTES.AUTH.REGISTER), {
        username,
        email,
        password,
      });
      if (response.data.access_token) {
        const userData = {
          access_token: response.data.access_token,
          id: response.data.user.id,
          username: response.data.user.username,
          email: response.data.user.email
        };
        localStorage.setItem('user', JSON.stringify(userData));
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Methode pour connecter un utilisateur
  async login(username, password) {
    try {
      const response = await axios.post(buildApiUrl(API_CONFIG.ROUTES.AUTH.LOGIN), {
        username,
        password,
      });
      if (response.data.access_token) {
        const userData = {
          access_token: response.data.access_token,
          id: response.data.user.id,
          username: response.data.user.username,
          email: response.data.user.email
        };
        localStorage.setItem('user', JSON.stringify(userData));
        this.setAuthHeader(response.data.access_token);
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Methode pour deconnecter l'utilisateur
  async logout() {
    try {
      const token = this.getToken();
      if (token) {
        await axios.post(buildApiUrl(API_CONFIG.ROUTES.AUTH.LOGOUT), {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      return true;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Methode pour recuperer l'utilisateur courant
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Erreur lors du parsing des donnees utilisateur:', error);
        localStorage.removeItem('user');
        return null;
      }
    }
    return null;
  }

  // Methode pour verifier si l'utilisateur est connecte
  isLoggedIn() {
    const user = this.getCurrentUser();
    return !!(user && user.access_token && user.id);
  }

  // Methode pour recuperer le token
  getToken() {
    const user = this.getCurrentUser();
    return user ? user.access_token : null;
  }

  // Methode pour configurer le header d'authentification
  setAuthHeader(token) {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }

  // Methode pour recuperer le profil utilisateur
  async getProfile() {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('Token d\'authentification manquant');
      }
      const response = await axios.get(buildApiUrl(API_CONFIG.ROUTES.USERS.ME), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const currentUser = this.getCurrentUser();
      const updatedUserData = {
        ...currentUser,
        ...response.data,
        access_token: currentUser.access_token
      };
      localStorage.setItem('user', JSON.stringify(updatedUserData));
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Methode pour mettre a jour le profil utilisateur
  async updateProfile(profileData) {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('Token d\'authentification manquant');
      }

      // Validation des champs modifiables
      const allowedFields = ['username', 'email', 'isActive'];
      const filteredData = Object.keys(profileData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = profileData[key];
          return obj;
        }, {});

      const response = await axios.put(buildApiUrl(API_CONFIG.ROUTES.USERS.ME), filteredData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Mise a jour des donnees dans le localStorage
      const currentUser = this.getCurrentUser();
      const updatedUserData = {
        ...currentUser,
        ...response.data,
        access_token: currentUser.access_token
      };
      localStorage.setItem('user', JSON.stringify(updatedUserData));

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Methode pour gerer les erreurs
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data.message || 'Une erreur est survenue';
      
      switch (status) {
        case 400:
          throw new Error(message);
        case 401:
          localStorage.removeItem('user');
          delete axios.defaults.headers.common['Authorization'];
          throw new Error(message);
        case 403:
          throw new Error(message);
        case 404:
          throw new Error(message);
        case 409:
          throw new Error(message);
        default:
          throw new Error(message);
      }
    } else if (error.request) {
      throw new Error('Impossible de contacter le serveur');
    } else {
      throw new Error('Erreur de configuration de la requete');
    }
  }
}

export default new AuthService(); 