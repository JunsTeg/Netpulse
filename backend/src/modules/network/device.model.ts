export interface ServiceInfo {
  port: number;
  name: string;
  version?: string;
}

export interface DeviceStats {
  cpu: number;
  memory: number;
  uptime: string;
  vlan?: string;
  bandwidth?: string;
  status: 'active' | 'warning' | 'danger' | 'inactive';
  openPorts?: number[];
  services?: ServiceInfo[];
}

export interface Device {
  id: string;
  hostname: string;
  ipAddress: string;
  macAddress: string;
  os: string;
  deviceType: 'router' | 'switch' | 'ap' | 'server' | 'laptop' | 'desktop' | 'mobile' | 'other';
  stats: DeviceStats;
  lastSeen: Date;
  firstDiscovered: Date;
  createdAt?: Date;
}

export interface NmapScanConfig {
  target: string;
  ports?: string;
  osDetection?: boolean;
  serviceDetection?: boolean;
  timing?: number;
  sudo?: boolean;
}

export interface NmapScanResult {
  success: boolean;
  devices: Device[];
  error?: string;
  scanTime: Date;
  scanDuration: number;
}

// Configuration des ports par type d'appareil
export const DEVICE_PORTS = {
  router: [80, 443, 8080, 8443, 22, 23], // Ports de gestion des routeurs
  switch: [22, 23, 80, 443, 161], // SNMP + ports de gestion
  ap: [80, 443, 8080, 8443, 22], // Points d'accès
  server: [21, 22, 23, 25, 80, 443, 445, 3306, 3389, 5432, 6379, 27017], // Serveurs
  laptop: [80, 443, 445, 3389, 5900], // Ordinateurs portables
  desktop: [80, 443, 445, 3389, 5900], // Ordinateurs fixes
  mobile: [80, 443, 5222, 5223, 5228, 5229, 5230], // Mobiles (ports courants)
  other: [80, 443, 445, 3389] // Ports par défaut
} as const;

// Ports communs à scanner pour la découverte initiale
export const COMMON_PORTS = [21, 22, 23, 25, 80, 443, 445, 3389, 8080, 8443];
