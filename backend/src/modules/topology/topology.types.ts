import { DeviceType } from '../network/device.model';

// Types de base pour la topologie
export interface TopologyNode {
  id: string;
  deviceId?: string;
  hostname: string;
  ipAddress: string;
  macAddress?: string;
  deviceType: DeviceType;
  os?: string;
  isCentral: boolean;
  isVirtual: boolean;
  status: 'active' | 'inactive' | 'warning' | 'error';
  cpuUsage?: number;
  memoryUsage?: number;
  bandwidthMbps?: number;
  latencyMs?: number;
  uptimeSeconds?: number;
  vlan?: string;
  services?: ServiceInfo[];
  lastSeen?: Date;
  firstDiscovered?: Date;
  metadata?: Record<string, any>;
}

export interface ServiceInfo {
  port: number;
  protocol: 'tcp' | 'udp';
  service: string;
  version?: string;
}

export interface TopologyLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  linkType: 'LAN' | 'WAN' | 'WIFI' | 'VLAN' | 'SNMP' | 'SUBNET' | 'ASSUMED';
  confidence: 'high' | 'medium' | 'low';
  isVirtual: boolean;
  isAssumed: boolean;
  sourcePort?: number;
  targetPort?: number;
  bandwidthMbps?: number;
  latencyMs?: number;
  packetLoss?: number;
  vlanId?: string;
  reasoning?: string;
  metadata?: Record<string, any>;
}

export interface TopologyStats {
  totalNodes: number;
  totalLinks: number;
  centralNodeId?: string;
  averageLatency: number;
  averageBandwidth: number;
  connectivityScore: number;
  averageConfidence: number;
  generationTime?: number;
  snmpSuccessRate?: number;
  cacheHitRate?: number;
}

export interface Topology {
  id: string;
  name: string;
  version: string;
  source: 'manual' | 'scan' | 'auto' | 'scheduled' | 'database';
  generationMethod: string;
  nodes: TopologyNode[];
  links: TopologyLink[];
  stats: TopologyStats;
  centralNode?: {
    id: string;
    hostname: string;
    confidence: 'high' | 'medium' | 'low';
  };
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  expiresAt?: Date;
}

// Types pour les options de génération
export interface TopologyOptions {
  gatewayIp?: string;
  snmpCommunity?: string;
  snmpTimeout?: number;
  snmpRetries?: number;
  enableFallback?: boolean;
  confidenceThreshold?: number;
  maxParallelQueries?: number;
  cacheEnabled?: boolean;
  cacheTtl?: number;
  preferRouter?: boolean;
}

// Types pour les résultats SNMP
export interface MacTableEntry {
  mac: string;
  port: number;
  vlan?: number;
  timestamp: Date;
}

export interface SnmpResult {
  success: boolean;
  data?: MacTableEntry[];
  error?: string;
  responseTime?: number;
}

// Types pour les erreurs
export class TopologyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'TopologyError';
  }
}

export class SnmpError extends TopologyError {
  constructor(message: string, details?: any) {
    super(message, 'SNMP_ERROR', details);
    this.name = 'SnmpError';
  }
}

export class ValidationError extends TopologyError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

// Types pour les événements
export interface TopologyEvent {
  type: 'generated' | 'updated' | 'deleted' | 'error';
  topologyId: string;
  timestamp: Date;
  userId?: string;
  details?: any;
}

// Types pour les métriques de performance
export interface TopologyMetrics {
  generationTime: number;
  snmpQueries: number;
  snmpSuccessRate: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  warnings: number;
} 