import React from 'react';
import { Navigate } from 'react-router-dom';
import { CSpinner } from '@coreui/react';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  // Affichage du spinner pendant la vérification
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <CSpinner color="primary" />
      </div>
    );
  }

  // Redirection vers la page de connexion si non authentifié
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Affichage du contenu protégé si authentifié
  return children;
};

export default ProtectedRoute; 