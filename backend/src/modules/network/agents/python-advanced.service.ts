import { Injectable, Logger } from '@nestjs/common';
import { OuiService } from '../services/oui.service';
import { DeviceTypeService } from '../services/device-type.service';
import { exec } from "child_process"
import { promisify } from "util"
import { type Device, DeviceType, DeviceStatus, type ServiceInfo } from "../device.model"
import * as path from 'path'
import * as fs from 'fs'

const execAsync = promisify(exec)

interface PythonScanConfig {
  networkRange: string
  ports?: number[]
  threads?: number
  timeout?: number
  enableNmap?: boolean
  enableScapy?: boolean
  deepScan?: boolean; // Added deepScan option
}

interface PythonDevice {
  ip: string
  hostname?: string
  netbios_name?: string
  mac_address?: string
  vendor?: string
  open_ports: number[]
  services: { [port: number]: string }
  os_guess?: string
  os_version?: string
  device_type?: string
  vulnerabilities: string[]
  response_time: number
  ttl: number
  last_seen: string
  status: string
}

interface PythonScanResult {
  success: boolean
  devices: PythonDevice[]
  scan_info: {
    network_range: string
    scan_time: string
    total_devices: number
    scan_duration: number
  }
  statistics: {
    os_distribution: { [key: string]: number }
    device_types: { [key: string]: number }
    top_ports: { [key: string]: number }
    vulnerabilities: { [key: string]: number }
    vendors: { [key: string]: number }
  }
  error?: string
}

// Ajouter la fonction utilitaire IPv4 CIDR
function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0)
}
function isIPv4InCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/')
  const ipNum = ipToInt(ip)
  const rangeNum = ipToInt(range)
  const mask = ~(2 ** (32 - Number(bits)) - 1)
  return (ipNum & mask) === (rangeNum & mask)
}
function isMulticast(ip: string): boolean {
  const first = Number(ip.split('.')[0])
  return first >= 224 && first <= 239
}
function isAPIPA(ip: string): boolean {
  return ip.startsWith("169.254.")
}
function isBroadcast(ip: string, cidr?: string): boolean {
  const parts = ip.split('.')
  if (parts.length === 4 && parts[3] === '255') return true
  if (ip === '255.255.255.255' || ip === '0.0.0.0') return true
  if (cidr) {
    try {
      const [base, mask] = cidr.split('/')
      const baseParts = base.split('.').map(Number)
      const maskNum = parseInt(mask, 10)
      if (maskNum >= 24 && parts.length === 4) {
        const broadcast = [...baseParts]
        broadcast[3] = 255
        if (ip === broadcast.join('.')) return true
      }
    } catch {}
  }
  return false
}
function isValidDeviceIP(ip: string, cidr: string): boolean {
  return (
    ip !== "127.0.0.1" &&
    ip !== "::1" &&
    !isBroadcast(ip, cidr) &&
    !isMulticast(ip) &&
    !isAPIPA(ip) &&
    isIPv4InCIDR(ip, cidr)
  )
}

@Injectable()
export class PythonAdvancedService {
  private readonly logger = new Logger(PythonAdvancedService.name)

  constructor(
    private readonly ouiService: OuiService,
    private readonly deviceTypeService: DeviceTypeService,
  ) {}

  async executePythonScan(config: PythonScanConfig): Promise<PythonScanResult> {
    try {
      this.logger.log(`[PYTHON] Démarrage scan avancé: ${config.networkRange}`)

      const scriptPath = await this.createPythonScript(config)
      const result = await this.runPythonScript(scriptPath, config)

      return this.parsePythonResults(result)
    } catch (error) {
      this.logger.error(`[PYTHON] Erreur scan: ${error.message}`)
      return {
        success: false,
        devices: [],
        scan_info: {
          network_range: config.networkRange,
          scan_time: new Date().toISOString(),
          total_devices: 0,
          scan_duration: 0,
        },
        statistics: {
          os_distribution: {},
          device_types: {},
          top_ports: {},
          vulnerabilities: {},
          vendors: {},
        },
        error: error.message,
      }
    }
  }

  private getOptimizedPorts(deepMode: boolean, customPorts?: number[]): number[] {
    const fastPorts = [22, 80, 443, 445, 3389, 515, 9100, 161, 8080];
    const fullPorts = [21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 993, 995, 1723, 3306, 3389, 5900, 8080, 515, 9100, 161];
    if (customPorts && Array.isArray(customPorts)) return customPorts;
    return deepMode ? fullPorts : fastPorts;
  }

  private async createPythonScript(config: PythonScanConfig): Promise<string> {
    const ports = this.getOptimizedPorts(!!config.deepScan, config.ports);
    const threads = config.threads || 200;
    const timeout = config.timeout || 0.3;
    const script = `#!/usr/bin/env python3
"""
Scanner réseau Python ultra-avancé pour Windows
Intégration avec le module NestJS
"""

import asyncio
import socket
import subprocess
import threading
import json
import time
import re
import struct
import platform
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Tuple
import ipaddress

@dataclass
class NetworkDevice:
    ip: str
    hostname: Optional[str] = None
    netbios_name: Optional[str] = None
    mac_address: Optional[str] = None
    vendor: Optional[str] = None
    open_ports: List[int] = None
    services: Dict[int, str] = None
    os_guess: Optional[str] = None
    os_version: Optional[str] = None
    device_type: Optional[str] = None
    vulnerabilities: List[str] = None
    response_time: float = 0.0
    ttl: int = 0
    last_seen: str = ""
    status: str = "unknown"
    
    def __post_init__(self):
        if self.open_ports is None:
            self.open_ports = []
        if self.services is None:
            self.services = {}
        if self.vulnerabilities is None:
            self.vulnerabilities = []
        if not self.last_seen:
            self.last_seen = datetime.now().isoformat()

class UltimatePythonScanner:
    def __init__(self, network_range="${config.networkRange}", threads=${threads}, timeout=${timeout}):
        self.network_range = network_range
        self.threads = threads
        self.timeout = timeout
        self.results = []
        self.lock = threading.Lock()
        
        # Configuration des ports
        self.ports = [${ports.join(",")}]
        
        # Base de données des vendors MAC
        self.mac_vendors = {
            "00:1A:2B": "Cisco",
            "00:50:56": "VMware",
            "08:00:27": "VirtualBox",
            "00:0C:29": "VMware",
            "00:15:5D": "Microsoft Hyper-V",
            "AA:BB:CC": "Apple",
            "00:1B:63": "Apple",
        }
        
        # Signatures de services
        self.service_signatures = {
            21: {"banner": b"220", "name": "FTP"},
            22: {"banner": b"SSH", "name": "SSH"},
            23: {"banner": b"Telnet", "name": "Telnet"},
            25: {"banner": b"220", "name": "SMTP"},
            80: {"banner": b"HTTP", "name": "HTTP"},
            110: {"banner": b"+OK", "name": "POP3"},
            143: {"banner": b"* OK", "name": "IMAP"},
            443: {"banner": None, "name": "HTTPS"},
            993: {"banner": None, "name": "IMAPS"},
            995: {"banner": None, "name": "POP3S"},
            135: {"banner": None, "name": "RPC"},
            139: {"banner": None, "name": "NetBIOS"},
            445: {"banner": None, "name": "SMB"},
            1433: {"banner": None, "name": "MSSQL"},
            3306: {"banner": None, "name": "MySQL"},
            3389: {"banner": None, "name": "RDP"},
            5432: {"banner": None, "name": "PostgreSQL"},
        }
    
    def generate_ip_list(self) -> List[str]:
        """Génère la liste d'IPs à partir de la notation CIDR"""
        try:
            network = ipaddress.IPv4Network(self.network_range, strict=False)
            return [str(ip) for ip in network.hosts()]
        except Exception as e:
            print(f"Erreur dans la plage réseau: {e}")
            return []
    
    def ping_host(self, ip: str) -> Tuple[bool, float, int]:
        """Test de connectivité avec mesure de latence et TTL"""
        try:
            if platform.system().lower() == "windows":
                result = subprocess.run(
                    ['ping', '-n', '1', '-w', str(self.timeout * 1000), ip],
                    capture_output=True, text=True, timeout=5
                )
                
                if result.returncode == 0:
                    time_match = re.search(r'time[<=](\\d+)ms', result.stdout)
                    ttl_match = re.search(r'TTL=(\\d+)', result.stdout)
                    
                    response_time = float(time_match.group(1)) if time_match else 0.0
                    ttl = int(ttl_match.group(1)) if ttl_match else 0
                    
                    return True, response_time, ttl
            else:
                result = subprocess.run(
                    ['ping', '-c', '1', '-W', str(self.timeout), ip],
                    capture_output=True, text=True, timeout=5
                )
                
                if result.returncode == 0:
                    time_match = re.search(r'time=(\\d+\\.?\\d*).*ms', result.stdout)
                    ttl_match = re.search(r'ttl=(\\d+)', result.stdout)
                    
                    response_time = float(time_match.group(1)) if time_match else 0.0
                    ttl = int(ttl_match.group(1)) if ttl_match else 0
                    
                    return True, response_time, ttl
                    
        except Exception:
            pass
        
        return False, 0.0, 0
    
    def scan_port_with_banner(self, ip: str, port: int) -> Tuple[bool, str]:
        """Scan de port avec détection de service par banner grabbing"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            
            result = sock.connect_ex((ip, port))
            if result == 0:
                service_name = f"Port {port}"
                
                # Tentative de banner grabbing
                try:
                    if port in self.service_signatures:
                        sock.settimeout(2)
                        
                        # Envoi d'une requête selon le service
                        if port == 80:
                            sock.send(b"GET / HTTP/1.0\\r\\n\\r\\n")
                        elif port == 21:
                            pass  # FTP envoie automatiquement un banner
                        elif port == 22:
                            pass  # SSH envoie automatiquement un banner
                        
                        banner = sock.recv(1024)
                        if banner:
                            banner_str = banner.decode('utf-8', errors='ignore').strip()
                            service_name = f"{self.service_signatures[port]['name']} - {banner_str[:50]}"
                
                except Exception:
                    service_name = self.service_signatures.get(port, {}).get('name', f"Port {port}")
                
                sock.close()
                return True, service_name
            
            sock.close()
            return False, ""
            
        except Exception:
            return False, ""
    
    def get_hostname(self, ip: str) -> Optional[str]:
        """Résolution DNS inverse"""
        try:
            hostname = socket.gethostbyaddr(ip)[0]
            return hostname
        except Exception:
            return None
    
    def get_mac_address(self, ip: str) -> Tuple[Optional[str], Optional[str]]:
        """Récupération de l'adresse MAC et du vendor"""
        try:
            if platform.system().lower() == "windows":
                result = subprocess.run(
                    ['arp', '-a', ip], capture_output=True, text=True, timeout=5
                )
                
                if result.returncode == 0:
                    mac_pattern = r'([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})'
                    match = re.search(mac_pattern, result.stdout.lower())
                    
                    if match:
                        mac = match.group(1).replace('-', ':').upper()
                        vendor = self.identify_vendor(mac)
                        return mac, vendor
            else:
                result = subprocess.run(
                    ['arp', '-n', ip], capture_output=True, text=True, timeout=5
                )
                
                if result.returncode == 0:
                    mac_pattern = r'([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})'
                    match = re.search(mac_pattern, result.stdout.lower())
                    
                    if match:
                        mac = match.group(1).upper()
                        vendor = self.identify_vendor(mac)
                        return mac, vendor
                        
        except Exception:
            pass
        
        return None, None
    
    def identify_vendor(self, mac: str) -> Optional[str]:
        """Identification du vendor à partir de l'adresse MAC"""
        if not mac:
            return None
        
        oui = mac[:8]  # Les 3 premiers octets
        return self.mac_vendors.get(oui, "Unknown")
    
    def get_netbios_info(self, ip: str) -> Optional[str]:
        """Récupération des informations NetBIOS (Windows)"""
        try:
            if platform.system().lower() == "windows":
                result = subprocess.run(
                    ['nbtstat', '-A', ip], capture_output=True, text=True, timeout=10
                )
                
                if result.returncode == 0:
                    lines = result.stdout.split('\\n')
                    for line in lines:
                        if '<00>' in line and 'UNIQUE' in line:
                            name = line.split()[0].strip()
                            return name
        except Exception:
            pass
        
        return None
    
    def detect_os(self, ip: str, open_ports: List[int], ttl: int) -> Tuple[str, int]:
        """Détection de l'OS par fingerprinting"""
        os_guess = "Unknown"
        confidence = 0
        
        # Analyse basée sur les ports
        windows_ports = [135, 139, 445, 3389, 5985, 5986]
        linux_ports = [22, 111, 2049]
        
        windows_score = sum(1 for port in windows_ports if port in open_ports)
        linux_score = sum(1 for port in linux_ports if port in open_ports)
        
        if windows_score > linux_score:
            os_guess = "Windows"
            confidence += windows_score * 20
        elif linux_score > 0:
            os_guess = "Linux/Unix"
            confidence += linux_score * 15
        
        # Analyse TTL
        if ttl > 0:
            if 64 <= ttl <= 65:
                if os_guess == "Unknown":
                    os_guess = "Linux/Unix"
                confidence += 15
            elif 128 <= ttl <= 129:
                if os_guess == "Unknown":
                    os_guess = "Windows"
                confidence += 15
            elif ttl >= 255:
                os_guess = "Network Device"
                confidence += 10
        
        # Ports spécifiques
        if 3389 in open_ports:
            os_guess = "Windows"
            confidence += 30
        
        if 22 in open_ports and 3389 not in open_ports:
            if os_guess == "Unknown":
                os_guess = "Linux/Unix"
            confidence += 20
        
        return os_guess, min(confidence, 100)
    
    def classify_device(self, hostname: Optional[str], open_ports: List[int], os_guess: str) -> str:
        """Classification du type d'appareil"""
        if hostname:
            hostname_lower = hostname.lower()
            
            # Patterns de hostname
            patterns = {
                "router": ["router", "gateway", "switch", "ap-", "access", "linksys", "netgear"],
                "server": ["server", "srv", "dc-", "exchange", "sql", "web", "mail"],
                "workstation": ["desktop", "pc-", "workstation", "laptop", "computer"],
                "mobile": ["phone", "mobile", "android", "iphone", "ipad", "tablet"],
                "printer": ["printer", "print", "hp-", "canon", "epson", "brother"],
                "nas": ["nas", "storage", "synology", "qnap"],
            }
            
            for device_type, keywords in patterns.items():
                if any(keyword in hostname_lower for keyword in keywords):
                    return device_type.title()
        
        # Classification par ports
        if 80 in open_ports and 443 in open_ports:
            if len(open_ports) < 10:
                return "Network Device"
            else:
                return "Web Server"
        
        if 3389 in open_ports or (135 in open_ports and 445 in open_ports):
            return "Windows Computer"
        
        if 22 in open_ports:
            if any(port in open_ports for port in [80, 443, 25, 110, 143]):
                return "Linux Server"
            else:
                return "Linux Computer"
        
        if len(open_ports) > 15:
            return "Server"
        
        if 631 in open_ports:  # CUPS
            return "Printer"
        
        return "Unknown Device"
    
    def detect_vulnerabilities(self, ip: str, open_ports: List[int], os_guess: str, services: Dict[int, str]) -> List[str]:
        """Détection de vulnérabilités basiques"""
        vulnerabilities = []
        
        # Ports dangereux
        dangerous_ports = {
            21: "FTP (Unencrypted)",
            23: "Telnet (Unencrypted)",
            135: "RPC (Potential RCE)",
            139: "NetBIOS (Information Disclosure)",
            445: "SMB (EternalBlue Risk)" if os_guess == "Windows" else "SMB Exposed",
            1433: "MSSQL Database Exposed",
            3306: "MySQL Database Exposed",
            5432: "PostgreSQL Database Exposed",
            6379: "Redis Database Exposed",
            27017: "MongoDB Database Exposed",
        }
        
        for port in open_ports:
            if port in dangerous_ports:
                vulnerabilities.append(dangerous_ports[port])
        
        # Vérifications spécifiques
        if 80 in open_ports and 443 not in open_ports:
            vulnerabilities.append("HTTP without HTTPS")
        
        if 21 in open_ports:
            vulnerabilities.append("Anonymous FTP possible")
        
        if len(open_ports) > 20:
            vulnerabilities.append("Too many open ports")
        
        return vulnerabilities
    
    def scan_host_complete(self, ip: str) -> Optional[NetworkDevice]:
        """Scan complet d'un hôte avec toutes les techniques"""
        # Test de connectivité
        is_alive, response_time, ttl = self.ping_host(ip)
        if not is_alive:
            return None
        
        # Création de l'objet device
        device = NetworkDevice(
            ip=ip,
            response_time=response_time,
            ttl=ttl,
            status="online"
        )
        
        # Résolution hostname
        device.hostname = self.get_hostname(ip)
        
        # Informations MAC
        device.mac_address, device.vendor = self.get_mac_address(ip)
        
        # NetBIOS (Windows)
        device.netbios_name = self.get_netbios_info(ip)
        
        # Scan de ports avec services
        with ThreadPoolExecutor(max_workers=20) as executor:
            port_futures = {
                executor.submit(self.scan_port_with_banner, ip, port): port 
                for port in self.ports
            }
            
            for future in as_completed(port_futures):
                port = port_futures[future]
                try:
                    is_open, service = future.result()
                    if is_open:
                        device.open_ports.append(port)
                        device.services[port] = service
                except Exception:
                    pass
        
        # Tri des ports
        device.open_ports.sort()
        
        # Détection OS
        device.os_guess, confidence = self.detect_os(ip, device.open_ports, ttl)
        
        # Classification du type d'appareil
        device.device_type = self.classify_device(device.hostname, device.open_ports, device.os_guess)
        
        # Détection de vulnérabilités
        device.vulnerabilities = self.detect_vulnerabilities(ip, device.open_ports, device.os_guess, device.services)
        
        return device
    
    def run_scan(self) -> List[NetworkDevice]:
        """Exécution du scan complet"""
        # Génération de la liste d'IPs
        ip_list = self.generate_ip_list()
        total_ips = len(ip_list)
        
        start_time = time.time()
        
        # Scan parallèle
        with ThreadPoolExecutor(max_workers=self.threads) as executor:
            futures = {executor.submit(self.scan_host_complete, ip): ip for ip in ip_list}
            
            for future in as_completed(futures):
                try:
                    result = future.result()
                    if result:
                        with self.lock:
                            self.results.append(result)
                except Exception:
                    pass
        
        return self.results
    
    def generate_report(self) -> Dict:
        """Génération d'un rapport détaillé"""
        if not self.results:
            return {}
        
        # Statistiques générales
        stats = {
            "scan_info": {
                "network_range": self.network_range,
                "scan_time": datetime.now().isoformat(),
                "total_devices": len(self.results),
                "scan_duration": 0
            },
            "os_distribution": {},
            "device_types": {},
            "top_ports": {},
            "vulnerabilities": {},
            "vendors": {},
            "devices": [asdict(device) for device in self.results]
        }
        
        # Calculs statistiques
        for device in self.results:
            # OS
            os = device.os_guess or "Unknown"
            stats["os_distribution"][os] = stats["os_distribution"].get(os, 0) + 1
            
            # Types d'appareils
            dev_type = device.device_type or "Unknown"
            stats["device_types"][dev_type] = stats["device_types"].get(dev_type, 0) + 1
            
            # Ports
            for port in device.open_ports:
                stats["top_ports"][str(port)] = stats["top_ports"].get(str(port), 0) + 1
            
            # Vulnérabilités
            for vuln in device.vulnerabilities:
                stats["vulnerabilities"][vuln] = stats["vulnerabilities"].get(vuln, 0) + 1
            
            # Vendors
            if device.vendor:
                stats["vendors"][device.vendor] = stats["vendors"].get(device.vendor, 0) + 1
        
        return stats

def main():
    try:
        scanner = UltimatePythonScanner()
        
        # Lancement du scan
        results = scanner.run_scan()
        
        # Génération du rapport
        report = scanner.generate_report()
        
        # Sortie JSON
        output = {
            "success": True,
            "devices": [asdict(device) for device in results],
            "scan_info": report["scan_info"],
            "statistics": {
                "os_distribution": report["os_distribution"],
                "device_types": report["device_types"],
                "top_ports": report["top_ports"],
                "vulnerabilities": report["vulnerabilities"],
                "vendors": report["vendors"]
            }
        }
        
        print(json.dumps(output, indent=2, default=str))
        
    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e),
            "devices": [],
            "scan_info": {
                "network_range": "${config.networkRange}",
                "scan_time": datetime.now().isoformat(),
                "total_devices": 0,
                "scan_duration": 0
            },
            "statistics": {
                "os_distribution": {},
                "device_types": {},
                "top_ports": {},
                "vulnerabilities": {},
                "vendors": {}
            }
        }
        print(json.dumps(error_output, indent=2, default=str))

if __name__ == "__main__":
    main()
`

    const fs = require("fs").promises
    const path = require("path")
    
    // Création du dossier temp s'il n'existe pas
    const tempDir = path.join(process.cwd(), "temp")
    try {
      await fs.access(tempDir)
    } catch (error) {
      this.logger.log(`[PYTHON] Création du dossier temp: ${tempDir}`)
      await fs.mkdir(tempDir, { recursive: true })
    }
    
    const scriptPath = path.join(tempDir, `python-scan-${Date.now()}.py`)
    await fs.writeFile(scriptPath, script, "utf8")

    return scriptPath
  }

  private async runPythonScript(scriptPath: string, config: PythonScanConfig): Promise<string> {
    try {
      const path = require("path")
      const fs = require("fs").promises
      
      // Vérification que le fichier existe
      try {
        await fs.access(scriptPath)
      } catch (error) {
        throw new Error(`Script Python introuvable: ${scriptPath}`)
      }
      
      const command = `python "${scriptPath}"`
      this.logger.log(`[PYTHON] Exécution: ${command}`)
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 600000, // 10 minutes timeout
        maxBuffer: 20 * 1024 * 1024, // 20MB buffer
      })

      if (stderr) {
        this.logger.warn(`[PYTHON] Warnings: ${stderr}`)
      }

      // Nettoyage du fichier temporaire
      try {
        await fs.unlink(scriptPath)
        this.logger.log(`[PYTHON] Fichier temporaire supprimé: ${scriptPath}`)
      } catch (error) {
        this.logger.warn(`[PYTHON] Erreur suppression fichier temporaire: ${error.message}`)
      }

      return stdout
    } catch (error) {
      this.logger.error(`[PYTHON] Erreur exécution script: ${error.message}`)
      throw error
    }
  }

  private parsePythonResults(output: string): PythonScanResult {
    try {
      const result = JSON.parse(output)
      if (!result.success) {
        throw new Error(result.error || "Scan Python échoué")
      }
      // Filtrage rigoureux des IPs
      const cidr = result.scan_info?.network_range || ""
      if (result.devices && Array.isArray(result.devices)) {
        result.devices = result.devices.filter((device: any) => isValidDeviceIP(device.ip, cidr))
      }
      return result
    } catch (error) {
      this.logger.error(`[PYTHON] Erreur parsing résultats: ${error.message}`)
      throw new Error(`Erreur parsing résultats Python: ${error.message}`)
    }
  }

  // Conversion vers le format Device de votre modèle
  convertToDeviceModel(pyDevice: PythonDevice): Device {
    const services: ServiceInfo[] = Object.entries(pyDevice.services).map(([port, service]) => ({
      port: Number.parseInt(port),
      protocol: "tcp" as const,
      service: service,
      version: undefined,
    }))

    return {
      id: `py-${pyDevice.ip.replace(/\./g, "-")}-${Date.now()}`,
      hostname: pyDevice.hostname || `device-${pyDevice.ip.replace(/\./g, "-")}`,
      ipAddress: pyDevice.ip,
      macAddress: pyDevice.mac_address || "",
      os: pyDevice.os_guess || "Unknown",
      deviceType: this.mapDeviceType(pyDevice.device_type),
      stats: {
        cpu: 0,
        memory: 0,
        uptime: "0",
        status: pyDevice.status === "online" ? DeviceStatus.ACTIVE : DeviceStatus.INACTIVE,
        services,
      },
      lastSeen: new Date(pyDevice.last_seen),
      firstDiscovered: new Date(),
    }
  }

  private mapDeviceType(pyDeviceType?: string): DeviceType {
    if (!pyDeviceType) return DeviceType.OTHER

    const typeMap: { [key: string]: DeviceType } = {
      "Network Device": DeviceType.ROUTER,
      Router: DeviceType.ROUTER,
      Switch: DeviceType.SWITCH,
      "Access Point": DeviceType.AP,
      "Web Server": DeviceType.SERVER,
      "Linux Server": DeviceType.SERVER,
      "Windows Computer": DeviceType.DESKTOP,
      "Linux Computer": DeviceType.DESKTOP,
      Workstation: DeviceType.DESKTOP,
      "Mobile Device": DeviceType.MOBILE,
      Printer: DeviceType.PRINTER,
      NAS: DeviceType.SERVER,
      "NAS Device": DeviceType.SERVER,
      TV: DeviceType.OTHER,
      Camera: DeviceType.OTHER,
    }
    return typeMap[pyDeviceType] || DeviceType.OTHER
  }

  private async getOSFromPython(ip: string): Promise<string> {
    try {
      const ports = [22, 23, 80, 135, 139, 443, 445, 515, 548, 631, 9100, 3389, 554, 8080, 8888, 1900]
      const openPorts: number[] = []
      const banners: Record<number, string> = {}
      const net = require('net')
      const timeout = 1000
      for (const port of ports) {
        await new Promise<void>(resolve => {
          const socket = new net.Socket()
          let banner = ''
          let isOpen = false
          socket.setTimeout(timeout)
          socket.connect(port, ip, () => {
            isOpen = true
          })
          socket.on('data', (data: Buffer) => {
            banner += data.toString('utf8')
            socket.destroy()
          })
          socket.on('timeout', () => {
            socket.destroy()
          })
          socket.on('error', () => {
            socket.destroy()
          })
          socket.on('close', () => {
            if (isOpen) {
              openPorts.push(port)
              if (banner) banners[port] = banner.slice(0, 100)
            }
            resolve()
          })
        })
      }
      let ttl = 0
      try {
        const { stdout } = await execAsync(`ping -n 1 -w 1000 ${ip}`)
        const ttlMatch = stdout.match(/TTL=(\d+)/i)
        if (ttlMatch) ttl = parseInt(ttlMatch[1], 10)
      } catch {}
      const hostname = await this.getHostnameFromDNS(ip)
      const mac = await this.getMACAddress(ip)
      let macVendor = ''
      if (mac) {
        const oui = mac.slice(0, 8).toUpperCase()
        if (oui.startsWith('00:1A:2B') || oui.startsWith('00:50:56')) macVendor = 'Cisco/VMware'
        else if (oui.startsWith('B8:27:EB') || oui.startsWith('DC:A6:32')) macVendor = 'Raspberry Pi'
        else if (oui.startsWith('00:1B:63') || oui.startsWith('00:1C:B3')) macVendor = 'Apple'
        else if (oui.startsWith('00:1A:79')) macVendor = 'Router'
        else if (oui.startsWith('00:1D:7D') || oui.startsWith('00:1F:5B')) macVendor = 'Desktop'
        else if (oui.startsWith('00:1E:8C') || oui.startsWith('00:1F:3F')) macVendor = 'Mobile'
        else if (oui.startsWith('00:80:77') || oui.startsWith('00:21:5C')) macVendor = 'HP/Printer'
      }
      let score: Record<string, number> = { Windows: 0, Linux: 0, Mac: 0, Printer: 0, IoT: 0 }
      if (openPorts.some(p => [135, 139, 445, 3389, 5985, 5986].includes(p))) score.Windows += 3
      if (openPorts.includes(22)) score.Linux += 2
      if (openPorts.includes(548)) score.Mac += 2
      if (openPorts.some(p => [9100, 515, 631].includes(p))) score.Printer += 3
      if (openPorts.some(p => [80, 443, 23, 554, 8080, 8888, 1900].includes(p))) score.IoT += 1
      if (ttl >= 120 && ttl <= 130) score.Windows += 2
      if (ttl >= 60 && ttl <= 70) score.Linux += 2
      if (ttl >= 240) score.Printer += 1
      if (banners[22]?.toLowerCase().includes('openssh')) score.Linux += 3
      if (banners[3389]?.toLowerCase().includes('rdp')) score.Windows += 2
      if (banners[9100]?.toLowerCase().includes('hp')) score.Printer += 2
      if (hostname.match(/router|box|tplink|dlink/i)) score.IoT += 2
      if (hostname.match(/hp|canon|epson|brother|printer/i)) score.Printer += 2
      if (hostname.match(/mac|apple/i)) score.Mac += 2
      if (macVendor.match(/HP|Printer/i)) score.Printer += 2
      if (macVendor.match(/Apple/i)) score.Mac += 2
      if (macVendor.match(/Cisco|Router/i)) score.IoT += 1
      this.logger.debug(`[OS DETECTION] ${ip} - Ports: ${openPorts.join(', ')} | TTL: ${ttl} | Hostname: ${hostname} | MAC: ${mac} (${macVendor}) | Banners: ${JSON.stringify(banners)}`)
      this.logger.debug(`[OS DETECTION] Scores: ${JSON.stringify(score)}`)
      const maxScore = Math.max(...Object.values(score))
      const probableOS = Object.keys(score).find(os => score[os] === maxScore && maxScore > 0)
      return probableOS || 'Unknown'
    } catch (error) {
      this.logger.error(`[OS DETECTION] Erreur détection OS pour ${ip}: ${error.message}`)
      return 'Unknown'
    }
  }

  private async getHostnameFromDNS(ip: string): Promise<string> {
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);
      const { stdout } = await execAsync(`nslookup ${ip}`);
      const match = stdout.match(/Name:\s*(.+)/);
      return match ? match[1].trim() : ip;
    } catch (error) {
      return ip;
    }
  }

  private async getMACAddress(ip: string): Promise<string> {
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);
      const { stdout } = await execAsync(`arp -a ${ip}`);
      const macMatch = stdout.match(/([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2})/i);
      return macMatch ? macMatch[1].replace(/-/g, ":") : "";
    } catch (error) {
      this.logger.error(`[PYTHON] Erreur récupération MAC ${ip}: ${error.message}`);
      return "";
    }
  }

  async enrichDeviceInfo(device: Device): Promise<Device> {
    // 1. MAC address (ARP)
    let macAddress = device.macAddress
    if (!macAddress) {
      const mac = await this.getMACAddress(device.ipAddress)
      if (mac) {
        macAddress = mac
        this.logger.debug(`[ENRICH] MAC enrichi via ARP pour ${device.ipAddress}: ${mac}`)
      }
    }
    // 2. Hostname (DNS)
    let hostname = device.hostname
    if (!hostname || hostname === device.ipAddress) {
      const dns = await this.getHostnameFromDNS(device.ipAddress)
      if (dns && dns !== device.ipAddress) {
        hostname = dns
        this.logger.debug(`[ENRICH] Hostname enrichi via DNS pour ${device.ipAddress}: ${dns}`)
      }
    }
    // 3. OS (Python)
    let os = device.os
    if (!os || os === 'Unknown') {
      os = await this.getOSFromPython(device.ipAddress) || os
      if (os && os !== 'Unknown') {
        this.logger.debug(`[ENRICH] OS enrichi via Python pour ${device.ipAddress}: ${os}`)
      }
    }
    // 4. Type d'appareil via service centralisé
    let deviceType = device.deviceType
    if (macAddress) {
      const detectionResult = this.deviceTypeService.detectDeviceType({ macAddress })
      deviceType = detectionResult.deviceType
    }
    // 5. Fusion intelligente
    return {
      ...device,
      macAddress: macAddress || device.macAddress,
      hostname: hostname || device.hostname,
      os: os || device.os,
      deviceType: deviceType || device.deviceType,
    }
  }

  // Map string (OUI type ou vendor) vers DeviceType enum
  private mapStringToDeviceType(type: string): DeviceType {
    if (!type) return DeviceType.OTHER
    const t = type.toLowerCase()
    if (t.includes('router')) return DeviceType.ROUTER
    if (t.includes('switch')) return DeviceType.SWITCH
    if (t.includes('access point') || t === 'ap') return DeviceType.AP
    if (t.includes('server') || t.includes('nas')) return DeviceType.SERVER
    if (t.includes('desktop') || t.includes('workstation')) return DeviceType.DESKTOP
    if (t.includes('laptop') || t.includes('notebook')) return DeviceType.LAPTOP
    if (t.includes('mobile') || t.includes('phone') || t.includes('tablet')) return DeviceType.MOBILE
    if (t.includes('printer')) return DeviceType.PRINTER
    return DeviceType.OTHER
  }
}




