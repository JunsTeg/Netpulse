export enum DeviceType {
  ROUTER = "router",
  SWITCH = "switch",
  AP = "ap",
  SERVER = "server",
  DESKTOP = "desktop",
  LAPTOP = "laptop",
  MOBILE = "mobile",
  PRINTER = "printer",
  OTHER = "other",
}

export enum DeviceStatus {
  ACTIVE = "active",
  WARNING = "warning",
  DANGER = "danger",
  INACTIVE = "inactive",
}

export interface ServiceInfo {
  port: number
  protocol: "tcp" | "udp"
  service: string
  version?: string
}

export interface Device {
  id: string
  hostname: string
  ipAddress: string
  macAddress: string
  os: string
  deviceType: DeviceType
  stats: {
    cpu: number
    memory: number
    uptime: string
    status: DeviceStatus
    services: ServiceInfo[]
    latency?: number
    bandwidth?: { download: number; upload: number }
    securityScore?: number
    vulnerabilities?: string[]
    lastStatsError?: string // Ajout du champ pour message d'erreur collecte stats
  }
  lastSeen: Date
  firstDiscovered: Date
}

export interface NmapScanConfig {
  target: string
  ports?: string
  osDetection?: boolean
  serviceDetection?: boolean
  timing?: number
  sudo?: boolean
  deepMode?: boolean
  customPorts?: string | number[]
}

export interface NmapScanResult {
  success: boolean
  devices: Device[]
  error?: string
  scanTime: Date
  scanDuration: number
}

export const DEVICE_PORTS = {
  [DeviceType.ROUTER]: [22, 23, 80, 443, 161, 162],
  [DeviceType.SWITCH]: [22, 23, 80, 443, 161, 162],
  [DeviceType.AP]: [22, 80, 443, 161],
  [DeviceType.SERVER]: [22, 80, 443, 3389, 5985, 5986],
  [DeviceType.DESKTOP]: [135, 139, 445, 3389],
  [DeviceType.LAPTOP]: [135, 139, 445, 3389],
  [DeviceType.MOBILE]: [80, 443, 8080],
  [DeviceType.PRINTER]: [80, 443, 515, 631, 9100],
  [DeviceType.OTHER]: [22, 80, 443],
}
