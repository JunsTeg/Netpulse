import axios from 'axios';
import { API_CONFIG, buildApiUrl } from '../config/api.config';

class UserService {
  // Recuperer tous les utilisateurs
  async getAllUsers() {
    try {
      const response = await axios.get(buildApiUrl(API_CONFIG.ROUTES.USERS.ALL), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
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
      const response = await axios.get(buildApiUrl(API_CONFIG.ROUTES.USERS.GET(id)), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
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
      const response = await axios.put(buildApiUrl(API_CONFIG.ROUTES.USERS.UPDATE(id)), userData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
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
      const response = await axios.delete(buildApiUrl(API_CONFIG.ROUTES.USERS.DELETE(id)), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
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
      throw new Error(error.response.data.message || 'Une erreur est survenue');
    }
    throw new Error('Erreur de connexion au serveur');
  }
}

export default new UserService(); 