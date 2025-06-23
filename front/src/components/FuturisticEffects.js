import React, { useEffect, useState } from 'react';

const FuturisticEffects = ({ children, type = 'neon' }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const getEffectStyles = () => {
    const baseStyles = {
      transition: 'all 0.3s ease',
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
    };

    if (type === 'neon') {
      return {
        ...baseStyles,
        textShadow: '0 0 5px #4a9eff, 0 0 10px #4a9eff',
        animation: 'neonPulse 2s ease-in-out infinite',
      };
    }

    return baseStyles;
  };

  return (
    <div style={getEffectStyles()}>
      {children}
    </div>
  );
};

// Composant pour les boutons futuristiques
export const FuturisticButton = ({ children, variant = 'primary', ...props }) => {
  const getButtonStyles = () => {
    const baseStyles = {
      border: 'none',
      borderRadius: '8px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      padding: '12px 24px',
      fontSize: '14px',
    };

    if (variant === 'primary') {
      return {
        ...baseStyles,
        background: 'linear-gradient(45deg, #4a9eff, #6bb3ff)',
        color: 'white',
        boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)',
      };
    }

    return baseStyles;
  };

  return (
    <button style={getButtonStyles()} {...props}>
      {children}
    </button>
  );
};

// Composant pour les cartes futuristiques
export const FuturisticCard = ({ children, title, ...props }) => {
  return (
    <div
      style={{
        background: 'rgba(26, 31, 58, 0.8)',
        border: '1px solid #2a3f5f',
        borderRadius: '12px',
        boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
      }}
      {...props}
    >
      {title && (
        <div
          style={{
            background: 'rgba(74, 158, 255, 0.1)',
            borderBottom: '1px solid #2a3f5f',
            padding: '1rem',
          }}
        >
          <h5 style={{ color: '#4a9eff', fontWeight: 'bold', margin: 0 }}>
            {title}
          </h5>
        </div>
      )}
      <div style={{ padding: '1rem', color: '#e8f4fd' }}>
        {children}
      </div>
    </div>
  );
};

// Composant pour les indicateurs de statut futuristiques
export const StatusIndicator = ({ status, size = 'medium' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          color: '#00d4aa',
          label: 'En ligne',
          animation: 'pulse 2s ease-in-out infinite',
        };
      case 'offline':
        return {
          color: '#ff6b6b',
          label: 'Hors ligne',
          animation: 'none',
        };
      case 'warning':
        return {
          color: '#ffb74a',
          label: 'Attention',
          animation: 'pulse 1s ease-in-out infinite',
        };
      case 'maintenance':
        return {
          color: '#4a9eff',
          label: 'Maintenance',
          animation: 'twinkle 3s ease-in-out infinite',
        };
      default:
        return {
          color: '#a8c7e8',
          label: 'Inconnu',
          animation: 'none',
        };
    }
  };

  const config = getStatusConfig();
  const sizeStyles = {
    small: { width: '8px', height: '8px' },
    medium: { width: '12px', height: '12px' },
    large: { width: '16px', height: '16px' },
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div
        style={{
          ...sizeStyles[size],
          borderRadius: '50%',
          backgroundColor: config.color,
          boxShadow: `0 0 10px ${config.color}`,
          animation: config.animation,
        }}
      />
      <span style={{ color: '#e8f4fd', fontSize: '0.9rem' }}>
        {config.label}
      </span>
    </div>
  );
};

export default FuturisticEffects; 