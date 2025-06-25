import React, { useState, useEffect } from 'react';
import CIcon from '@coreui/icons-react';
import { cilMoon, cilSun } from '@coreui/icons';

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(false); // Par défaut en mode clair

  useEffect(() => {
    // Récupérer la préférence sauvegardée
    const savedTheme = localStorage.getItem('netpulse-theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      setIsDark(true);
    } else {
      document.body.classList.remove('dark-mode');
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    const currentlyDark = document.body.classList.contains('dark-mode');
    if (currentlyDark) {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('netpulse-theme', 'light');
      setIsDark(false);
    } else {
      document.body.classList.add('dark-mode');
      localStorage.setItem('netpulse-theme', 'dark');
      setIsDark(true);
    }
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
          />
        ) : (
          <CIcon 
            icon={cilMoon} 
            size="lg"
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