import React, { useState, useEffect } from 'react';
import CIcon from '@coreui/icons-react';
import { cilMoon, cilSun } from '@coreui/icons';

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(true); // Par défaut en mode sombre

  useEffect(() => {
    // Récupérer la préférence sauvegardée
    const savedTheme = localStorage.getItem('netpulse-theme');
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
      applyTheme(savedTheme === 'dark' ? 'dark' : 'light');
    } else {
      // Par défaut en mode sombre
      applyTheme('dark');
    }
  }, []);

  const applyTheme = (theme) => {
    const body = document.body;
    
    // Supprimer les classes existantes
    body.classList.remove('netpulse-futuristic', 'netpulse-dark', 'netpulse-light');
    
    // Ajouter les nouvelles classes
    body.classList.add('netpulse-futuristic');
    body.classList.add(theme === 'dark' ? 'netpulse-dark' : 'netpulse-light');
    
    // Sauvegarder la préférence
    localStorage.setItem('netpulse-theme', theme);
  };

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    // Ajout de la classe pour la transition galactique
    const body = document.body;
    body.classList.add('theme-transition');
    setTimeout(() => {
      body.classList.remove('theme-transition');
    }, 800);
    setIsDark(!isDark);
    applyTheme(newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-btn"
      style={{
        background: 'transparent',
        border: 'none',
        color: isDark ? '#4a9eff' : '#1e3a8a',
        fontSize: '1.5rem',
        cursor: 'pointer',
        padding: '0.5rem',
        borderRadius: '50%',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      title={isDark ? 'Passer au mode clair' : 'Passer au mode sombre'}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isDark ? (
          <CIcon 
            icon={cilSun} 
            size="lg"
            style={{
              filter: 'drop-shadow(0 0 10px rgba(74, 158, 255, 0.5))',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        ) : (
          <CIcon 
            icon={cilMoon} 
            size="lg"
            style={{
              filter: 'drop-shadow(0 0 10px rgba(30, 58, 138, 0.5))',
              animation: 'pulse-light 2s ease-in-out infinite',
            }}
          />
        )}
      </div>
      
      {/* Effet de fond animé */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: isDark 
            ? 'radial-gradient(circle, rgba(74, 158, 255, 0.1) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(30, 58, 138, 0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          transform: 'scale(0)',
          transition: 'transform 0.3s ease',
        }}
        className="theme-toggle-bg"
      />
    </button>
  );
};

export default ThemeToggle; 