import { DeviceType } from './device.model';

// Types pour le module network
export interface NetworkTopologyData {
  devices: Array<{
    id: string;
    ip: string;
    type: DeviceType;
    connections: Array<{
      target: string;
      type: 'LAN' | 'WAN';
      metrics: {
        bandwidth: number;
        latency: number;
        packetLoss: number;
      };
    }>;
  }>;
  connections: Array<{
    source: string;
    target: string;
    type: 'LAN' | 'WAN';
    metrics: {
      bandwidth: number;
      latency: number;
      packetLoss: number;
    };
  }>;
  stats: {
    totalDevices: number;
    activeDevices: number;
    averageLatency: number;
    averagePacketLoss: number;
    totalBandwidth: {
      download: number;
      upload: number;
    };
  };
}

export interface NetworkTopologyRecord {
  id: string;
  name: string;
  data: string; // JSON stringified NetworkTopologyData
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type NetworkTopology = NetworkTopologyRecord; 