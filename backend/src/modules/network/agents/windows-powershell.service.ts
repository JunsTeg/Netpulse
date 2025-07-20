import { Injectable, Logger } from "@nestjs/common"
import { exec } from "child_process"
import { promisify } from "util"
import { type Device, DeviceType, DeviceStatus, type ServiceInfo } from "../device.model"
import { getOuiDatabaseSingleton, getDeviceTypeFromMac } from '../../../utils/oui-util'
import * as path from 'path'

const execAsync = promisify(exec)

// Déplacer les fonctions utilitaires en dehors de la classe
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

interface PowerShellScanConfig {
  networkRange: string
  ports?: number[]
  deepScan?: boolean
  stealth?: boolean
  threads?: number
}

interface PowerShellDevice {
  ip: string
  hostname?: string
  netbiosName?: string
  macAddress?: string
  vendor?: string
  openPorts: number[]
  services: { [port: number]: string }
  os?: string
  osVersion?: string
  deviceType?: string
  vulnerabilities: string[]
  responseTime: number
  ttl: number
  status: "online" | "offline"
  lastSeen: Date
}

interface PowerShellScanResult {
  success: boolean
  devices: PowerShellDevice[]
  statistics: {
    totalHosts: number
    activeHosts: number
    scanDuration: number
    averageResponseTime: number
    vulnerableDevices: number
  }
  error?: string
}

@Injectable()
export class WindowsPowerShellService {
  private readonly logger = new Logger(WindowsPowerShellService.name)

  async executePowerShellScan(config: PowerShellScanConfig): Promise<PowerShellScanResult> {
    try {
      this.logger.log(`[POWERSHELL] Démarrage scan ultra-puissant: ${config.networkRange}`)

      const scriptPath = await this.createPowerShellScript(config)
      const result = await this.runPowerShellScript(scriptPath)

      return this.parsePowerShellResults(result)
    } catch (error) {
      this.logger.error(`[POWERSHELL] Erreur scan: ${error.message}`)
      return {
        success: false,
        devices: [],
        statistics: {
          totalHosts: 0,
          activeHosts: 0,
          scanDuration: 0,
          averageResponseTime: 0,
          vulnerableDevices: 0,
        },
        error: error.message,
      }
    }
  }

  private async createPowerShellScript(config: PowerShellScanConfig): Promise<string> {
    const script = `
# Scanner Réseau Ultra-Puissant PowerShell
param(
    [string]$NetworkRange = "${config.networkRange}",
    [int[]]$Ports = @(${(config.ports || [22, 23, 53, 80, 135, 139, 443, 445, 993, 995, 1723, 3389, 5900, 8080]).join(",")}),
    [bool]$DeepScan = $${config.deepScan || false},
    [bool]$Stealth = $${config.stealth || false},
    [int]$Threads = ${config.threads || 20}
)

$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

# Classes pour les résultats
class NetworkDevice {
    [string]$IP
    [string]$Hostname
    [string]$NetBIOSName
    [string]$MACAddress
    [string]$Vendor
    [array]$OpenPorts
    [hashtable]$Services
    [string]$OS
    [string]$OSVersion
    [string]$DeviceType
    [array]$Vulnerabilities
    [int]$ResponseTime
    [int]$TTL
    [string]$Status
    [datetime]$LastSeen
}

# Fonction pour obtenir la plage d'IPs
function Get-IPRange {
    param([string]$CIDR)
    
    $network, $prefixLength = $CIDR.Split('/')
    $ip = [System.Net.IPAddress]::Parse($network)
    $mask = [System.Net.IPAddress]::Parse(([System.Net.IPAddress]::new([uint32]([Math]::Pow(2, 32) - [Math]::Pow(2, 32 - [int]$prefixLength)))).IPAddressToString)
    
    $networkBytes = $ip.GetAddressBytes()
    $maskBytes = $mask.GetAddressBytes()
    
    $startBytes = @()
    $endBytes = @()
    
    for ($i = 0; $i -lt 4; $i++) {
        $startBytes += $networkBytes[$i] -band $maskBytes[$i]
        $endBytes += $networkBytes[$i] -bor (255 - $maskBytes[$i])
    }
    
    $start = [System.Net.IPAddress]::new($startBytes).ToString()
    $end = [System.Net.IPAddress]::new($endBytes).ToString()
    
    $ipList = @()
    $startIP = [System.Net.IPAddress]::Parse($start)
    $endIP = [System.Net.IPAddress]::Parse($end)
    
    $startBytes = $startIP.GetAddressBytes()
    $endBytes = $endIP.GetAddressBytes()
    
    $currentIP = $startBytes[3]
    $maxIP = $endBytes[3]
    $baseIP = "$($startBytes[0]).$($startBytes[1]).$($startBytes[2])"
    
    for ($i = $currentIP + 1; $i -lt $maxIP; $i++) {
        $ipList += "$baseIP.$i"
    }
    
    return $ipList
}

# Test de ping avancé
function Test-AdvancedPing {
    param([string]$IP)
    
    try {
        $ping = New-Object System.Net.NetworkInformation.Ping
        $reply = $ping.Send($IP, 2000)
        
        if ($reply.Status -eq "Success") {
            return @{
                Success = $true
                ResponseTime = $reply.RoundtripTime
                TTL = $reply.Options.Ttl
            }
        }
    }
    catch {}
    
    return @{ Success = $false; ResponseTime = -1; TTL = -1 }
}

# Scan de port avancé
function Test-PortAdvanced {
    param([string]$IP, [int]$Port)
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpClient.BeginConnect($IP, $Port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(1000, $false)
        
        if ($wait) {
            try {
                $tcpClient.EndConnect($connect)
                $service = Get-ServiceInfo -Port $Port
                $tcpClient.Close()
                return @{ Open = $true; Service = $service }
            }
            catch {
                $tcpClient.Close()
                return @{ Open = $true; Service = "Unknown" }
            }
        }
        else {
            $tcpClient.Close()
            return @{ Open = $false; Service = $null }
        }
    }
    catch {
        return @{ Open = $false; Service = $null }
    }
}

# Détection de service
function Get-ServiceInfo {
    param([int]$Port)
    
    $services = @{
        21 = "FTP"; 22 = "SSH"; 23 = "Telnet"; 25 = "SMTP"; 53 = "DNS"
        80 = "HTTP"; 110 = "POP3"; 135 = "RPC"; 139 = "NetBIOS"; 143 = "IMAP"
        443 = "HTTPS"; 445 = "SMB"; 993 = "IMAPS"; 995 = "POP3S"
        1433 = "MSSQL"; 3306 = "MySQL"; 3389 = "RDP"; 5432 = "PostgreSQL"
        5985 = "WinRM HTTP"; 5986 = "WinRM HTTPS"
    }
    
    return $services[$Port] -or "Port $Port"
}

# Récupération MAC via ARP
function Get-MACAddress {
    param([string]$IP)
    
    try {
        $arp = arp -a $IP 2>$null
        if ($arp) {
            $macMatch = $arp | Select-String "([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})"
            if ($macMatch) {
                return $macMatch.Matches[0].Value.Replace('-', ':').ToUpper()
            }
        }
    }
    catch {}
    return $null
}

# Résolution hostname
function Get-HostnameFromIP {
    param([string]$IP)
    
    try {
        $hostname = [System.Net.Dns]::GetHostEntry($IP).HostName
        return $hostname
    }
    catch {}
    return $null
}

# Informations NetBIOS
function Get-NetBIOSInfo {
    param([string]$IP)
    
    try {
        $result = nbtstat -A $IP 2>$null
        if ($result) {
            foreach ($line in $result) {
                if ($line -match "^\\s*(\\S+)\\s+<00>\\s+UNIQUE") {
                    return $matches[1]
                }
            }
        }
    }
    catch {}
    return $null
}

# Détection OS par fingerprinting
function Get-OSFingerprint {
    param([string]$IP, [array]$OpenPorts, [int]$TTL)
    
    $osGuess = "Unknown"
    $confidence = 0
    
    # Analyse ports
    if ($OpenPorts -contains 3389) { $osGuess = "Windows"; $confidence += 30 }
    if ($OpenPorts -contains 135 -or $OpenPorts -contains 445) { $osGuess = "Windows"; $confidence += 25 }
    if ($OpenPorts -contains 22 -and $OpenPorts -notcontains 3389) { $osGuess = "Linux/Unix"; $confidence += 20 }
    
    # Analyse TTL
    switch ($TTL) {
        {$_ -in 64..65} { if ($osGuess -eq "Unknown") { $osGuess = "Linux/Unix" }; $confidence += 15 }
        {$_ -in 128..129} { if ($osGuess -eq "Unknown") { $osGuess = "Windows" }; $confidence += 15 }
        {$_ -in 255..256} { $osGuess = "Network Device"; $confidence += 10 }
    }
    
    return @{ OS = $osGuess; Confidence = $confidence }
}

# Classification type d'appareil
function Get-DeviceType {
    param([string]$Hostname, [array]$OpenPorts, [string]$OS)
    
    if ($Hostname) {
        $hostname = $Hostname.ToLower()
        if ($hostname -match "router|gateway|switch|ap-") { return "Network Device" }
        if ($hostname -match "server|srv|dc-") { return "Server" }
        if ($hostname -match "desktop|pc
        if ($hostname -match "server|srv|dc-") { return "Server" }
        if ($hostname -match "desktop|pc-|laptop") { return "Workstation" }
        if ($hostname -match "phone|mobile|android|iphone") { return "Mobile Device" }
    }
    
    # Classification par ports
    if ($OpenPorts -contains 80 -and $OpenPorts -contains 443 -and $OpenPorts.Count -lt 10) { return "Network Device" }
    if ($OpenPorts -contains 3389 -or ($OpenPorts -contains 135 -and $OpenPorts -contains 445)) { return "Windows Computer" }
    if ($OpenPorts -contains 22 -and $OpenPorts -contains 80) { return "Linux Server" }
    if ($OpenPorts.Count -gt 10) { return "Server" }
    
    return "Unknown Device"
}

# Détection vulnérabilités
function Get-BasicVulnerabilities {
    param([array]$OpenPorts, [string]$OS)
    
    $vulnerabilities = @()
    
    if ($OpenPorts -contains 23) { $vulnerabilities += "Telnet (Unencrypted)" }
    if ($OpenPorts -contains 21) { $vulnerabilities += "FTP (Potentially Unencrypted)" }
    if ($OpenPorts -contains 135) { $vulnerabilities += "RPC (Potential RCE)" }
    if ($OpenPorts -contains 445 -and $OS -eq "Windows") { $vulnerabilities += "SMB (EternalBlue Risk)" }
    if ($OpenPorts -contains 1433) { $vulnerabilities += "MSSQL Exposed" }
    if ($OpenPorts -contains 3306) { $vulnerabilities += "MySQL Exposed" }
    
    return $vulnerabilities
}

# Scan d'un hôte
function Invoke-HostScan {
    param([string]$IP)
    
    # Test connectivité
    $pingResult = Test-AdvancedPing -IP $IP
    if (-not $pingResult.Success) { return $null }
    
    # Création device
    $device = [NetworkDevice]::new()
    $device.IP = $IP
    $device.Status = "online"
    $device.ResponseTime = $pingResult.ResponseTime
    $device.TTL = $pingResult.TTL
    $device.LastSeen = Get-Date
    
    # Informations de base
    $device.Hostname = Get-HostnameFromIP -IP $IP
    $device.NetBIOSName = Get-NetBIOSInfo -IP $IP
    $device.MACAddress = Get-MACAddress -IP $IP
    
    # Scan ports
    $device.OpenPorts = @()
    $device.Services = @{}
    
    foreach ($port in $Ports) {
        $portResult = Test-PortAdvanced -IP $IP -Port $port
        if ($portResult.Open) {
            $device.OpenPorts += $port
            $device.Services[$port] = $portResult.Service
        }
    }
    
    # Détection OS
    $osInfo = Get-OSFingerprint -IP $IP -OpenPorts $device.OpenPorts -TTL $device.TTL
    $device.OS = $osInfo.OS
    
    # Type d'appareil
    $device.DeviceType = Get-DeviceType -Hostname $device.Hostname -OpenPorts $device.OpenPorts -OS $device.OS
    
    # Vulnérabilités
    $device.Vulnerabilities = Get-BasicVulnerabilities -OpenPorts $device.OpenPorts -OS $device.OS
    
    return $device
}

# Scan principal
$startTime = Get-Date
$ipList = Get-IPRange -CIDR $NetworkRange
$results = [System.Collections.Concurrent.ConcurrentBag[NetworkDevice]]::new()

$ipList | ForEach-Object -ThrottleLimit $Threads -Parallel {
    $device = & $using:function:Invoke-HostScan -IP $_
    if ($device) {
        $using:results.Add($device)
    }
}

$scanDuration = (Get-Date) - $startTime
$devices = $results.ToArray()

# Statistiques
$stats = @{
    totalHosts = $ipList.Count
    activeHosts = $devices.Count
    scanDuration = $scanDuration.TotalSeconds
    averageResponseTime = if ($devices.Count -gt 0) { ($devices | Measure-Object ResponseTime -Average).Average } else { 0 }
    vulnerableDevices = ($devices | Where-Object { $_.Vulnerabilities.Count -gt 0 }).Count
}

# Sortie JSON
$output = @{
    success = $true
    devices = $devices
    statistics = $stats
}

$output | ConvertTo-Json -Depth 10
`

    const fs = require("fs").promises
    const scriptPath = `./temp/powershell-scan-${Date.now()}.ps1`
    await fs.writeFile(scriptPath, script, "utf8")

    return scriptPath
  }

  private async runPowerShellScript(scriptPath: string): Promise<string> {
    try {
      const command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
      const { stdout, stderr } = await execAsync(command, {
        timeout: 300000, // 5 minutes timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      })

      if (stderr) {
        this.logger.warn(`[POWERSHELL] Warnings: ${stderr}`)
      }

      // Nettoyage du fichier temporaire
      const fs = require("fs").promises
      try {
        await fs.unlink(scriptPath)
      } catch (error) {
        this.logger.warn(`[POWERSHELL] Erreur suppression fichier temporaire: ${error.message}`)
      }

      return stdout
    } catch (error) {
      this.logger.error(`[POWERSHELL] Erreur exécution script: ${error.message}`)
      throw error
    }
  }

  private parsePowerShellResults(output: string): PowerShellScanResult {
    try {
      const result = JSON.parse(output)

      if (!result.success) {
        throw new Error(result.error || "Scan PowerShell échoué")
      }

      // Filtrage rigoureux des IPs
      const cidr = result.scan_info?.network_range || result.statistics?.network_range || ""
      return {
        success: true,
        devices: result.devices
          .filter((device: any) => isValidDeviceIP(device.IP, cidr))
          .map((device: any) => ({
            ip: device.IP,
            hostname: device.Hostname,
            netbiosName: device.NetBIOSName,
            macAddress: device.MACAddress,
            vendor: device.Vendor,
            openPorts: device.OpenPorts || [],
            services: device.Services || {},
            os: device.OS,
            osVersion: device.OSVersion,
            deviceType: device.DeviceType,
            vulnerabilities: device.Vulnerabilities || [],
            responseTime: device.ResponseTime || 0,
            ttl: device.TTL || 0,
            status: device.Status === "online" ? "online" : "offline",
            lastSeen: new Date(device.LastSeen),
          })),
        statistics: result.statistics,
      }
    } catch (error) {
      this.logger.error(`[POWERSHELL] Erreur parsing résultats: ${error.message}`)
      throw new Error(`Erreur parsing résultats PowerShell: ${error.message}`)
    }
  }

  // Conversion vers le format Device de votre modèle
  convertToDeviceModel(psDevice: PowerShellDevice): Device {
    const services: ServiceInfo[] = Object.entries(psDevice.services).map(([port, service]) => ({
      port: Number.parseInt(port),
      protocol: "tcp" as const,
      service: service,
      version: undefined,
    }))

    return {
      id: `ps-${psDevice.ip.replace(/\./g, "-")}-${Date.now()}`,
      hostname: psDevice.hostname || `device-${psDevice.ip.replace(/\./g, "-")}`,
      ipAddress: psDevice.ip,
      macAddress: psDevice.macAddress || "",
      os: psDevice.os || "Unknown",
      deviceType: this.mapDeviceType(psDevice.deviceType),
      stats: {
        cpu: 0,
        memory: 0,
        uptime: "0",
        status: psDevice.status === "online" ? DeviceStatus.ACTIVE : DeviceStatus.INACTIVE,
        services,
      },
      lastSeen: psDevice.lastSeen,
      firstDiscovered: new Date(),
    }
  }

  private mapDeviceType(psDeviceType?: string): DeviceType {
    if (!psDeviceType) return DeviceType.OTHER

    const typeMap: { [key: string]: DeviceType } = {
      "Network Device": DeviceType.ROUTER,
      Router: DeviceType.ROUTER,
      Switch: DeviceType.SWITCH,
      "Access Point": DeviceType.AP,
      Server: DeviceType.SERVER,
      "Linux Server": DeviceType.SERVER,
      "Windows Computer": DeviceType.DESKTOP,
      Workstation: DeviceType.DESKTOP,
      "Mobile Device": DeviceType.MOBILE,
      Printer: DeviceType.PRINTER,
      NAS: DeviceType.SERVER,
      "NAS Device": DeviceType.SERVER,
      "TV": DeviceType.OTHER,
      "Camera": DeviceType.OTHER,
    }
    return typeMap[psDeviceType] || DeviceType.OTHER
  }

  async enrichDeviceInfo(device: Device): Promise<Device> {
    // Charger la base OUI une seule fois
    const ouiDb = getOuiDatabaseSingleton(path.resolve(__dirname, '../../../utils/oui-db.json'))
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
    // 3. OS (PowerShell)
    let os = device.os
    if (!os || os === 'Unknown') {
      os = await this.getOSFromPowerShell(device.ipAddress) || os
      if (os && os !== 'Unknown') {
        this.logger.debug(`[ENRICH] OS enrichi via PowerShell pour ${device.ipAddress}: ${os}`)
      }
    }
    // 4. Type d'appareil via OUI
    let deviceType = device.deviceType
    if (macAddress) {
      const ouiType = getDeviceTypeFromMac(macAddress, ouiDb)
      if (ouiType) {
        deviceType = this.mapStringToDeviceType(ouiType)
      }
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

  // Ajout des méthodes utilitaires d'enrichissement multi-source
  private async getMACAddress(ip: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`arp -a ${ip}`)
      const macMatch = stdout.match(/([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2})/i)
      return macMatch ? macMatch[1].replace(/-/g, ":") : ""
    } catch (error) {
      this.logger.error(`[ENRICH] Erreur récupération MAC ${ip}: ${error.message}`)
      return ""
    }
  }

  private async getHostnameFromDNS(ip: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`nslookup ${ip}`)
      const match = stdout.match(/Name:\s*(.+)/)
      return match ? match[1].trim() : ip
    } catch (error) {
      return ip
    }
  }

  private async getOSFromPowerShell(ip: string): Promise<string> {
    try {
      // 1. Ports clés à scanner
      const ports = [22, 23, 80, 135, 139, 443, 445, 515, 548, 631, 9100, 3389, 554, 8080, 8888, 1900]
      const openPorts: number[] = []
      const banners: Record<number, string> = {}
      const net = require('net')
      const timeout = 1000

      // Scan ports et collecte bannières
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

      // 2. TTL via ping
      let ttl = 0
      try {
        const { stdout } = await execAsync(`ping -n 1 -w 1000 ${ip}`)
        const ttlMatch = stdout.match(/TTL=(\d+)/i)
        if (ttlMatch) ttl = parseInt(ttlMatch[1], 10)
      } catch {}

      // 3. Hostname
      const hostname = await this.getHostnameFromDNS(ip)

      // 4. MAC Vendor
      const mac = await this.getMACAddress(ip)
      let macVendor = ''
      if (mac) {
        const oui = mac.slice(0, 8).toUpperCase()
        // Table OUI simplifiée
        if (oui.startsWith('00:1A:2B') || oui.startsWith('00:50:56')) macVendor = 'Cisco/VMware'
        else if (oui.startsWith('B8:27:EB') || oui.startsWith('DC:A6:32')) macVendor = 'Raspberry Pi'
        else if (oui.startsWith('00:1B:63') || oui.startsWith('00:1C:B3')) macVendor = 'Apple'
        else if (oui.startsWith('00:1A:79')) macVendor = 'Router'
        else if (oui.startsWith('00:1D:7D') || oui.startsWith('00:1F:5B')) macVendor = 'Desktop'
        else if (oui.startsWith('00:1E:8C') || oui.startsWith('00:1F:3F')) macVendor = 'Mobile'
        else if (oui.startsWith('00:80:77') || oui.startsWith('00:21:5C')) macVendor = 'HP/Printer'
      }

      // 5. Détection par scoring
      let score: Record<string, number> = { Windows: 0, Linux: 0, Mac: 0, Printer: 0, IoT: 0 }
      // Ports Windows
      if (openPorts.some(p => [135, 139, 445, 3389, 5985, 5986].includes(p))) score.Windows += 3
      // Ports Linux
      if (openPorts.includes(22)) score.Linux += 2
      // Ports Mac
      if (openPorts.includes(548)) score.Mac += 2
      // Ports imprimante
      if (openPorts.some(p => [9100, 515, 631].includes(p))) score.Printer += 3
      // Ports IoT/Box
      if (openPorts.some(p => [80, 443, 23, 554, 8080, 8888, 1900].includes(p))) score.IoT += 1
      // TTL
      if (ttl >= 120 && ttl <= 130) score.Windows += 2
      if (ttl >= 60 && ttl <= 70) score.Linux += 2
      if (ttl >= 240) score.Printer += 1
      // Bannières
      if (banners[22]?.toLowerCase().includes('openssh')) score.Linux += 3
      if (banners[3389]?.toLowerCase().includes('rdp')) score.Windows += 2
      if (banners[9100]?.toLowerCase().includes('hp')) score.Printer += 2
      // Hostname
      if (hostname.match(/router|box|tplink|dlink/i)) score.IoT += 2
      if (hostname.match(/hp|canon|epson|brother|printer/i)) score.Printer += 2
      if (hostname.match(/mac|apple/i)) score.Mac += 2
      // MAC Vendor
      if (macVendor.match(/HP|Printer/i)) score.Printer += 2
      if (macVendor.match(/Apple/i)) score.Mac += 2
      if (macVendor.match(/Cisco|Router/i)) score.IoT += 1
      // Logs détaillés
      this.logger.debug(`[OS DETECTION] ${ip} - Ports: ${openPorts.join(', ')} | TTL: ${ttl} | Hostname: ${hostname} | MAC: ${mac} (${macVendor}) | Banners: ${JSON.stringify(banners)}`)
      this.logger.debug(`[OS DETECTION] Scores: ${JSON.stringify(score)}`)
      // Décision finale
      const maxScore = Math.max(...Object.values(score))
      const probableOS = Object.keys(score).find(os => score[os] === maxScore && maxScore > 0)
      return probableOS || 'Unknown'
    } catch (error) {
      this.logger.error(`[OS DETECTION] Erreur détection OS pour ${ip}: ${error.message}`)
      return 'Unknown'
    }
  }
}
