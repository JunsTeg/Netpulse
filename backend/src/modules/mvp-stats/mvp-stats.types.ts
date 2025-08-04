import { Device, DeviceStatus } from '../network/device.model';

// Types pour les données collectées
export interface MvpSystemStats {
  cpu: number;
  memory: number;
  source: 'windows-native' | 'iperf3' | 'nmap' | 'fallback';
  timestamp: Date;
  error?: string;
  success?: boolean;
}

export interface MvpNetworkStats {
  bandwidth: {
    download: number; // Mbps
    upload: number;   // Mbps
  };
  latency: number;    // ms
  jitter?: number;    // ms
  packetLoss?: number; // %
  adapters?: Array<{
    name: string;
    receivedBytes: number;
    sentBytes: number;
    receivedPackets: number;
    sentPackets: number;
  }>;
  source: 'windows-native' | 'iperf3' | 'nmap' | 'fallback';
  success: boolean;
  error?: string;
}

export interface MvpAnomaly {
  type: 'high-cpu' | 'low-memory' | 'low-bandwidth' | 'high-latency' | 'packet-loss' | 'service-down';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  deviceId?: string;
}

export interface MvpAnomalyReport {
  count: number;
  anomalies: MvpAnomaly[];
  timestamp: Date;
  error?: string;
}

// Données collectées par appareil
export interface MvpDeviceStats {
  deviceId: string;
  hostname: string;
  ipAddress: string;
  deviceType: string;
  system: MvpSystemStats;
  network: MvpNetworkStats;
  anomalies: MvpAnomaly[];
  collectionStatus: 'success' | 'partial' | 'failed';
  collectionTime: number; // ms
  error?: string;
}

// Données agrégées pour tous les appareils
export interface MvpGlobalStats {
  timestamp: Date;
  totalDevices: number;
  activeDevices: number;
  failedDevices: number;
  devices: MvpDeviceStats[];
  globalAnomalies: MvpAnomalyReport;
  summary: {
    avgCpu: number;
    avgMemory: number;
    avgBandwidth: number;
    avgLatency: number;
    totalAnomalies: number;
  };
  collectionDuration: number; // ms
  performanceMetrics?: MvpPerformanceMetrics;
}

// Configuration pour la collecte
export interface MvpCollectionConfig {
  timeout: number; // ms
  retries: number;
  parallelCollectors: number;
  useIperf3: boolean;
  useNmap: boolean;
  anomalyThresholds: {
    cpu: number;
    memory: number;
    bandwidth: number;
    latency: number;
  };
}

// Réponse formatée pour l'API
export interface MvpApiResponse {
  success: boolean;
  data: MvpGlobalStats;
  message: string;
  errors?: string[];
  warnings?: string[];
  metadata: {
    version: string;
    collectionTime: Date;
    toolsAvailable: {
      iperf3: boolean;
      nmap: boolean;
      tshark: boolean;
    };
  };
}

// Types pour le traitement des données
export interface MvpDataProcessingResult {
  processed: boolean;
  data: any;
  errors: string[];
  warnings: string[];
}

// Types pour la validation
export interface MvpValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Types pour les seuils d'anomalies
export interface MvpAnomalyThresholds {
  cpu: {
    warning: number;
    critical: number;
  };
  memory: {
    warning: number;
    critical: number;
  };
  bandwidth: {
    warning: number;
    critical: number;
  };
  latency: {
    warning: number;
    critical: number;
  };
  packetLoss: {
    warning: number;
    critical: number;
  };
}

// Types pour les outils tiers
export interface MvpToolsAvailability {
  iperf3: boolean;
  nmap: boolean;
  tshark: boolean;
  powershell: boolean;
  ping: boolean;
}

// Types pour les métriques de performance
export interface MvpPerformanceMetrics {
  collectionTime: number;
  processingTime: number;
  totalTime: number;
  memoryUsage: number;
  cpuUsage: number;
} 