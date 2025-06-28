import { useState, useEffect, useCallback } from 'react';
import authService from '../services/auth.service';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fonction pour vérifier l'authentification
  const checkAuth = useCallback(() => {
    try {
      const currentUser = authService.getCurrentUser();
      const isLoggedIn = authService.isLoggedIn();
      
      if (isLoggedIn && currentUser) {
        setIsAuthenticated(true);
        setUser(currentUser);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        // Déconnexion automatique si le token est expiré
        authService.logout();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    } catch (error) {
      console.error('[AUTH] Erreur lors de la vérification:', error);
      setIsAuthenticated(false);
      setUser(null);
      authService.logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  }, []);

  // Vérification initiale
  useEffect(() => {
    checkAuth();
    setLoading(false);
  }, [checkAuth]);

  // Vérification périodique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      checkAuth();
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, [checkAuth]);

  // Vérification lors du focus de la fenêtre
  useEffect(() => {
    const handleFocus = () => {
      checkAuth();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkAuth]);

  return {
    isAuthenticated,
    user,
    loading,
    checkAuth
  };
}; 