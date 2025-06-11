import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
      const response = await axios.post(`${API_URL}/auth/login`, {
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
        // Configuration du token pour les futures requetes
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
        await axios.post(`${API_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      localStorage.removeItem('user');
      // Suppression du header d'authentification
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
      const response = await axios.get(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Mise a jour des donnees utilisateur dans le localStorage
      const currentUser = this.getCurrentUser();
      const updatedUserData = {
        ...currentUser,
        ...response.data,
        access_token: currentUser.access_token // On garde le token
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

      const response = await axios.put(`${API_URL}/users/me`, filteredData, {
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
      // Erreur de reponse du serveur
      const message = error.response.data.message || 'Une erreur est survenue';
      if (error.response.status === 401) {
        // Si l'utilisateur n'est plus authentifie, on le deconnecte
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
      }
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