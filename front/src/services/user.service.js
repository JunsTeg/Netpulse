import axios from 'axios';
import { API_CONFIG, buildApiUrl } from '../config/api.config';
import authService from './auth.service';

class UserService {
  // Recuperer tous les utilisateurs
  async getAllUsers() {
    try {
      const token = authService.getToken();
      if (!token) {
        throw new Error('Token d\'authentification manquant');
      }
      const response = await axios.get(buildApiUrl(API_CONFIG.ROUTES.USERS.ALL), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Recuperer un utilisateur par son ID
  async getUserById(id) {
    try {
      const token = authService.getToken();
      if (!token) {
        throw new Error('Token d\'authentification manquant');
      }
      const response = await axios.get(buildApiUrl(API_CONFIG.ROUTES.USERS.GET(id)), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Creer un nouvel utilisateur
  async createUser(userData) {
    try {
      const response = await axios.post(buildApiUrl(API_CONFIG.ROUTES.AUTH.REGISTER), userData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Mettre a jour un utilisateur
  async updateUser(id, userData) {
    try {
      const token = authService.getToken();
      if (!token) {
        throw new Error('Token d\'authentification manquant');
      }

      // Validation des champs modifiables
      const allowedFields = ['username', 'email', 'isActive', 'password'];
      const filteredData = Object.keys(userData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          // On n'inclut le mot de passe que s'il n'est pas vide
          if (key === 'password' && (!userData[key] || userData[key].trim() === '')) {
            return obj;
          }
          obj[key] = userData[key];
          return obj;
        }, {});

      console.log('Donnees filtreees pour la mise a jour:', filteredData);

      const response = await axios.put(buildApiUrl(API_CONFIG.ROUTES.USERS.UPDATE(id)), filteredData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Supprimer un utilisateur
  async deleteUser(id) {
    try {
      const token = authService.getToken();
      if (!token) {
        throw new Error('Token d\'authentification manquant');
      }
      const response = await axios.delete(buildApiUrl(API_CONFIG.ROUTES.USERS.DELETE(id)), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Gestion des erreurs
  handleError(error) {
    if (error.response) {
      if (error.response.status === 401) {
        // Token manquant ou invalide
        authService.logout(); // Utilise la methode de deconnexion du service d'auth
        throw new Error('Session expiree ou invalide. Veuillez vous reconnecter.');
      }
      throw new Error(error.response.data.message || 'Une erreur est survenue');
    }
    throw new Error('Erreur de connexion au serveur');
  }
}

export default new UserService(); 