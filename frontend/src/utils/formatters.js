// Formatage des octets en unités lisibles
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Formatage de la vitesse en octets par seconde
export const formatSpeed = (bytesPerSecond) => {
  return formatBytes(bytesPerSecond) + '/s';
};

// Formatage de la date
export const formatDate = (date) => {
  return new Date(date).toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Formatage de la durée
export const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}j ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

// Formatage du pourcentage
export const formatPercentage = (value) => {
  return `${Math.round(value * 100) / 100}%`;
};

// Formatage de l'adresse MAC
export const formatMacAddress = (mac) => {
  if (!mac) return '';
  return mac.toUpperCase().replace(/([0-9A-F]{2})/g, '$1:').slice(0, -1);
};

// Formatage de l'adresse IP
export const formatIpAddress = (ip) => {
  if (!ip) return '';
  return ip;
};

// Formatage du type d'appareil
export const formatDeviceType = (type) => {
  const types = {
    router: 'Routeur',
    switch: 'Switch',
    ap: 'Point d\'Acces',
    server: 'Serveur',
    laptop: 'Portable',
    desktop: 'Ordinateur',
    mobile: 'Mobile',
    other: 'Autre'
  };
  return types[type] || type;
}; 