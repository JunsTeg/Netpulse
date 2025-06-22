export interface NetworkTopologyData {
  devices: Array<{
    id: string
    ip: string
    type: string
    connections: Array<{
      target: string
      type: "LAN" | "WAN" | "WIFI"
      metrics: {
        bandwidth: number
        latency: number
        packetLoss: number
      }
    }>
  }>
  connections: Array<{
    source: string
    target: string
    type: "LAN" | "WAN" | "WIFI"
    metrics: {
      bandwidth: number
      latency: number
      packetLoss: number
    }
  }>
  stats: {
    totalDevices: number
    activeDevices: number
    averageLatency: number
    averagePacketLoss: number
    totalBandwidth: { download: number; upload: number }
  }
}

export interface NetworkScanProgress {
  currentStep: string
  progress: number
  devicesFound: number
  currentDevice?: string
}
