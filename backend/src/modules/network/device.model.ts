import { IsString, IsIP, IsMACAddress, IsEnum, IsOptional, IsNotEmpty, Matches } from 'class-validator';

export interface ServiceInfo {
  port: number;
  protocol: 'tcp' | 'udp';
  service: string;
  version?: string;
}

// Conversion des types en enums
export enum DeviceType {
  ROUTER = 'router',
  SWITCH = 'switch',
  AP = 'ap',
  SERVER = 'server',
  LAPTOP = 'laptop',
  DESKTOP = 'desktop',
  MOBILE = 'mobile',
  OTHER = 'other'
}

export enum DeviceStatus {
  ACTIVE = 'active',
  WARNING = 'warning',
  DANGER = 'danger',
  INACTIVE = 'inactive'
}

export interface DeviceStats {
  cpu: number;
  memory: number;
  uptime: string;
  status: DeviceStatus;
  services: ServiceInfo[];
}

export interface Device {
  id: string;
  hostname: string;
  ipAddress: string;
  macAddress: string;
  os: string;
  deviceType: DeviceType;
  stats: DeviceStats;
  lastSeen: Date;
  firstDiscovered: Date;
  createdAt?: Date;
  updatedAt?: Date;
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

// DTO pour la creation d'un appareil
export class CreateDeviceDto {
  @IsNotEmpty({ message: 'Le hostname est requis' })
  @IsString()
  @Matches(/^[a-zA-Z0-9-]+$/, { message: 'Le hostname doit contenir uniquement des lettres, chiffres et tirets' })
  hostname: string;

  @IsNotEmpty({ message: 'L\'adresse IP est requise' })
  @IsIP('4', { message: 'L\'adresse IP doit etre une IPv4 valide' })
  ipAddress: string;

  @IsNotEmpty({ message: 'L\'adresse MAC est requise' })
  @IsMACAddress({ no_colons: false }, { message: 'L\'adresse MAC doit etre valide (format: XX:XX:XX:XX:XX:XX)' })
  macAddress: string;

  @IsNotEmpty({ message: 'Le systeme d\'exploitation est requis' })
  @IsString()
  os: string;

  @IsNotEmpty({ message: 'Le type d\'appareil est requis' })
  @IsEnum(DeviceType, { message: 'Le type d\'appareil doit etre valide' })
  deviceType: DeviceType;
}

// DTO pour la mise a jour d'un appareil
export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9-]+$/, { message: 'Le hostname doit contenir uniquement des lettres, chiffres et tirets' })
  hostname?: string;

  @IsOptional()
  @IsIP('4', { message: 'L\'adresse IP doit etre une IPv4 valide' })
  ipAddress?: string;

  @IsOptional()
  @IsMACAddress({ no_colons: false }, { message: 'L\'adresse MAC doit etre valide (format: XX:XX:XX:XX:XX:XX)' })
  macAddress?: string;

  @IsOptional()
  @IsString()
  os?: string;

  @IsOptional()
  @IsEnum(DeviceType, { message: 'Le type d\'appareil doit etre valide' })
  deviceType?: DeviceType;

  @IsOptional()
  @IsEnum(DeviceStatus, { message: 'Le statut doit etre valide' })
  status?: DeviceStatus;
}
