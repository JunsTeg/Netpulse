import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DeviceType } from '../device.model';

export interface OuiVendor {
  oui: string;
  vendor: string;
  deviceType?: DeviceType;
  confidence?: number;
}

export interface DeviceTypeMapping {
  [key: string]: DeviceType;
}

@Injectable()
export class OuiService {
  private readonly logger = new Logger(OuiService.name);
  private ouiDb: Record<string, string> = {};
  private isLoaded = false;
  private readonly ouiDbPath: string;

  // Mapping des constructeurs vers les types d'appareils
  private readonly vendorToDeviceType: DeviceTypeMapping = {
    // Routeurs et équipements réseau
    'cisco': DeviceType.ROUTER,
    'juniper': DeviceType.ROUTER,
    'extreme': DeviceType.SWITCH,
    'aruba': DeviceType.AP,
    'ruckus': DeviceType.AP,
    'ubiquiti': DeviceType.AP,
    'tplink': DeviceType.ROUTER,
    'dlink': DeviceType.ROUTER,
    'netgear': DeviceType.ROUTER,
    'asus': DeviceType.ROUTER,
    'linksys': DeviceType.ROUTER,
    'huawei': DeviceType.ROUTER,
    'zte': DeviceType.ROUTER,
    'fortinet': DeviceType.ROUTER,
    'palo alto': DeviceType.ROUTER,
    'check point': DeviceType.ROUTER,
    'f5': DeviceType.ROUTER,
    'riverbed': DeviceType.ROUTER,
    'brocade': DeviceType.SWITCH,
    'dell': DeviceType.SWITCH,
    'hp': DeviceType.SWITCH,
    'lenovo': DeviceType.SWITCH,
    
    // Serveurs et équipements professionnels
    'ibm': DeviceType.SERVER,
    'intel': DeviceType.SERVER,
    'amd': DeviceType.SERVER,
    'vmware': DeviceType.SERVER,
    'microsoft': DeviceType.SERVER,
    'oracle': DeviceType.SERVER,
    'sun': DeviceType.SERVER,
    
    // Constructeurs mobiles
    'samsung': DeviceType.MOBILE,
    'lg': DeviceType.MOBILE,
    'motorola': DeviceType.MOBILE,
    'nokia': DeviceType.MOBILE,
    'sony': DeviceType.MOBILE,
    'xiaomi': DeviceType.MOBILE,
    'oneplus': DeviceType.MOBILE,
    'google': DeviceType.MOBILE,
    'htc': DeviceType.MOBILE,
    'blackberry': DeviceType.MOBILE,
    'honor': DeviceType.MOBILE,
    'oppo': DeviceType.MOBILE,
    'vivo': DeviceType.MOBILE,
    'realme': DeviceType.MOBILE,
    'meizu': DeviceType.MOBILE,
    
    // Imprimantes
    'canon': DeviceType.PRINTER,
    'epson': DeviceType.PRINTER,
    'brother': DeviceType.PRINTER,
    'lexmark': DeviceType.PRINTER,
    'xerox': DeviceType.PRINTER,
    'ricoh': DeviceType.PRINTER,
    'sharp': DeviceType.PRINTER,
    'kyocera': DeviceType.PRINTER,
    'konica': DeviceType.PRINTER,
    'minolta': DeviceType.PRINTER,
    'toshiba': DeviceType.PRINTER,
    'fujitsu': DeviceType.PRINTER,
    'panasonic': DeviceType.PRINTER,
    'sanyo': DeviceType.PRINTER,
    
    // Équipements industriels
    'philips': DeviceType.OTHER,
    'siemens': DeviceType.OTHER,
    'bosch': DeviceType.OTHER,
    'schneider': DeviceType.OTHER,
    'abb': DeviceType.OTHER,
    'rockwell': DeviceType.OTHER,
    'honeywell': DeviceType.OTHER,
    'emerson': DeviceType.OTHER,
    'yokogawa': DeviceType.OTHER,
    'omron': DeviceType.OTHER,
    'mitsubishi': DeviceType.OTHER,
    'fuji': DeviceType.OTHER,
    'hitachi': DeviceType.OTHER,
    'daikin': DeviceType.OTHER,
    'carrier': DeviceType.OTHER,
    'trane': DeviceType.OTHER,
    'lennox': DeviceType.OTHER,
    'rheem': DeviceType.OTHER,
    'goodman': DeviceType.OTHER,
    'american standard': DeviceType.OTHER,
  };

  // Préfixes MAC connus pour détection rapide
  private readonly knownMacPrefixes: Record<string, DeviceType> = {
    '00:50:56': DeviceType.SERVER, // VMware
    '00:0C:29': DeviceType.SERVER, // VMware
    '00:1C:14': DeviceType.SERVER, // VMware
    '00:05:69': DeviceType.SERVER, // VMware
    'B8:27:EB': DeviceType.SERVER, // Raspberry Pi
    'DC:A6:32': DeviceType.SERVER, // Raspberry Pi
    'E4:5F:01': DeviceType.SERVER, // Raspberry Pi
    '00:1A:79': DeviceType.ROUTER, // Router
    '00:1B:63': DeviceType.SWITCH, // Switch
    '00:1C:B3': DeviceType.SWITCH, // Switch
    '00:1A:2B': DeviceType.AP,     // Access Point
    '00:1C:0E': DeviceType.AP,     // Access Point
    '00:1E:8C': DeviceType.LAPTOP, // Laptop
    '00:1F:3F': DeviceType.LAPTOP, // Laptop
    '00:1D:7D': DeviceType.DESKTOP, // Desktop
    '00:1F:5B': DeviceType.DESKTOP, // Desktop
    '00:80:77': DeviceType.PRINTER, // HP Printer
    '00:21:5C': DeviceType.PRINTER, // HP Printer
    '00:17:C8': DeviceType.PRINTER, // HP Printer
    '00:18:FE': DeviceType.PRINTER, // HP Printer
    '00:1B:78': DeviceType.PRINTER, // HP Printer
    '00:1E:A7': DeviceType.PRINTER, // HP Printer
    '00:1F:29': DeviceType.PRINTER, // HP Printer
    '00:21:5A': DeviceType.PRINTER, // HP Printer
    '00:23:AE': DeviceType.PRINTER, // HP Printer
    '00:25:B3': DeviceType.PRINTER, // HP Printer
    '00:26:18': DeviceType.PRINTER, // HP Printer
    '00:27:13': DeviceType.PRINTER, // HP Printer
    '00:28:0E': DeviceType.PRINTER, // HP Printer
    '00:29:09': DeviceType.PRINTER, // HP Printer
    '00:2A:04': DeviceType.PRINTER, // HP Printer
    '00:2B:FF': DeviceType.PRINTER, // HP Printer
    '00:2C:FA': DeviceType.PRINTER, // HP Printer
    '00:2D:F5': DeviceType.PRINTER, // HP Printer
    '00:2E:F0': DeviceType.PRINTER, // HP Printer
    '00:2F:EB': DeviceType.PRINTER, // HP Printer
    '00:30:E6': DeviceType.PRINTER, // HP Printer
    '00:31:E1': DeviceType.PRINTER, // HP Printer
    '00:32:DC': DeviceType.PRINTER, // HP Printer
    '00:33:D7': DeviceType.PRINTER, // HP Printer
    '00:34:D2': DeviceType.PRINTER, // HP Printer
    '00:35:CD': DeviceType.PRINTER, // HP Printer
    '00:36:C8': DeviceType.PRINTER, // HP Printer
    '00:37:C3': DeviceType.PRINTER, // HP Printer
    '00:38:BE': DeviceType.PRINTER, // HP Printer
    '00:39:B9': DeviceType.PRINTER, // HP Printer
    '00:3A:B4': DeviceType.PRINTER, // HP Printer
    '00:3B:AF': DeviceType.PRINTER, // HP Printer
    '00:3C:AA': DeviceType.PRINTER, // HP Printer
    '00:3D:A5': DeviceType.PRINTER, // HP Printer
    '00:3E:A0': DeviceType.PRINTER, // HP Printer
    '00:3F:9B': DeviceType.PRINTER, // HP Printer
    '00:40:96': DeviceType.PRINTER, // HP Printer
    '00:41:91': DeviceType.PRINTER, // HP Printer
    '00:42:8C': DeviceType.PRINTER, // HP Printer
    '00:43:87': DeviceType.PRINTER, // HP Printer
    '00:44:82': DeviceType.PRINTER, // HP Printer
    '00:45:7D': DeviceType.PRINTER, // HP Printer
    '00:46:78': DeviceType.PRINTER, // HP Printer
    '00:47:73': DeviceType.PRINTER, // HP Printer
    '00:48:6E': DeviceType.PRINTER, // HP Printer
    '00:49:69': DeviceType.PRINTER, // HP Printer
    '00:4A:64': DeviceType.PRINTER, // HP Printer
    '00:4B:5F': DeviceType.PRINTER, // HP Printer
    '00:4C:5A': DeviceType.PRINTER, // HP Printer
    '00:4D:55': DeviceType.PRINTER, // HP Printer
    '00:4E:50': DeviceType.PRINTER, // HP Printer
    '00:4F:4B': DeviceType.PRINTER, // HP Printer
    '00:50:46': DeviceType.PRINTER, // HP Printer
    '00:51:41': DeviceType.PRINTER, // HP Printer
    '00:52:3C': DeviceType.PRINTER, // HP Printer
    '00:53:37': DeviceType.PRINTER, // HP Printer
    '00:54:32': DeviceType.PRINTER, // HP Printer
    '00:55:2D': DeviceType.PRINTER, // HP Printer
    '00:56:28': DeviceType.PRINTER, // HP Printer
    '00:57:23': DeviceType.PRINTER, // HP Printer
    '00:58:1E': DeviceType.PRINTER, // HP Printer
    '00:59:19': DeviceType.PRINTER, // HP Printer
    '00:5A:14': DeviceType.PRINTER, // HP Printer
    '00:5B:0F': DeviceType.PRINTER, // HP Printer
    '00:5C:0A': DeviceType.PRINTER, // HP Printer
    '00:5D:05': DeviceType.PRINTER, // HP Printer
    '00:5E:00': DeviceType.PRINTER, // HP Printer
    '00:5F:FB': DeviceType.PRINTER, // HP Printer
    '00:60:F6': DeviceType.PRINTER, // HP Printer
    '00:61:F1': DeviceType.PRINTER, // HP Printer
    '00:62:EC': DeviceType.PRINTER, // HP Printer
    '00:63:E7': DeviceType.PRINTER, // HP Printer
    '00:64:E2': DeviceType.PRINTER, // HP Printer
    '00:65:DD': DeviceType.PRINTER, // HP Printer
    '00:66:D8': DeviceType.PRINTER, // HP Printer
    '00:67:D3': DeviceType.PRINTER, // HP Printer
    '00:68:CE': DeviceType.PRINTER, // HP Printer
    '00:69:C9': DeviceType.PRINTER, // HP Printer
    '00:6A:C4': DeviceType.PRINTER, // HP Printer
    '00:6B:BF': DeviceType.PRINTER, // HP Printer
    '00:6C:BA': DeviceType.PRINTER, // HP Printer
    '00:6D:B5': DeviceType.PRINTER, // HP Printer
    '00:6E:B0': DeviceType.PRINTER, // HP Printer
    '00:6F:AB': DeviceType.PRINTER, // HP Printer
    '00:70:A6': DeviceType.PRINTER, // HP Printer
    '00:71:A1': DeviceType.PRINTER, // HP Printer
    '00:72:9C': DeviceType.PRINTER, // HP Printer
    '00:73:97': DeviceType.PRINTER, // HP Printer
    '00:74:92': DeviceType.PRINTER, // HP Printer
    '00:75:8D': DeviceType.PRINTER, // HP Printer
    '00:76:88': DeviceType.PRINTER, // HP Printer
    '00:77:83': DeviceType.PRINTER, // HP Printer
    '00:78:7E': DeviceType.PRINTER, // HP Printer
    '00:79:79': DeviceType.PRINTER, // HP Printer
    '00:7A:74': DeviceType.PRINTER, // HP Printer
    '00:7B:6F': DeviceType.PRINTER, // HP Printer
    '00:7C:6A': DeviceType.PRINTER, // HP Printer
    '00:7D:65': DeviceType.PRINTER, // HP Printer
    '00:7E:60': DeviceType.PRINTER, // HP Printer
    '00:7F:5B': DeviceType.PRINTER, // HP Printer
    '00:80:56': DeviceType.PRINTER, // HP Printer
    '00:81:51': DeviceType.PRINTER, // HP Printer
    '00:82:4C': DeviceType.PRINTER, // HP Printer
    '00:83:47': DeviceType.PRINTER, // HP Printer
    '00:84:42': DeviceType.PRINTER, // HP Printer
    '00:85:3D': DeviceType.PRINTER, // HP Printer
    '00:86:38': DeviceType.PRINTER, // HP Printer
    '00:87:33': DeviceType.PRINTER, // HP Printer
    '00:88:2E': DeviceType.PRINTER, // HP Printer
    '00:89:29': DeviceType.PRINTER, // HP Printer
    '00:8A:24': DeviceType.PRINTER, // HP Printer
    '00:8B:1F': DeviceType.PRINTER, // HP Printer
    '00:8C:1A': DeviceType.PRINTER, // HP Printer
    '00:8D:15': DeviceType.PRINTER, // HP Printer
    '00:8E:10': DeviceType.PRINTER, // HP Printer
    '00:8F:0B': DeviceType.PRINTER, // HP Printer
    '00:90:06': DeviceType.PRINTER, // HP Printer
    '00:91:01': DeviceType.PRINTER, // HP Printer
    '00:92:FC': DeviceType.PRINTER, // HP Printer
    '00:93:F7': DeviceType.PRINTER, // HP Printer
    '00:94:F2': DeviceType.PRINTER, // HP Printer
    '00:95:ED': DeviceType.PRINTER, // HP Printer
    '00:96:E8': DeviceType.PRINTER, // HP Printer
    '00:97:E3': DeviceType.PRINTER, // HP Printer
    '00:98:DE': DeviceType.PRINTER, // HP Printer
    '00:99:D9': DeviceType.PRINTER, // HP Printer
    '00:9A:D4': DeviceType.PRINTER, // HP Printer
    '00:9B:CF': DeviceType.PRINTER, // HP Printer
    '00:9C:CA': DeviceType.PRINTER, // HP Printer
    '00:9D:C5': DeviceType.PRINTER, // HP Printer
    '00:9E:C0': DeviceType.PRINTER, // HP Printer
    '00:9F:BB': DeviceType.PRINTER, // HP Printer
    '00:A0:B6': DeviceType.PRINTER, // HP Printer
    '00:A1:B1': DeviceType.PRINTER, // HP Printer
    '00:A2:AC': DeviceType.PRINTER, // HP Printer
    '00:A3:A7': DeviceType.PRINTER, // HP Printer
    '00:A4:A2': DeviceType.PRINTER, // HP Printer
    '00:A5:9D': DeviceType.PRINTER, // HP Printer
    '00:A6:98': DeviceType.PRINTER, // HP Printer
    '00:A7:93': DeviceType.PRINTER, // HP Printer
    '00:A8:8E': DeviceType.PRINTER, // HP Printer
    '00:A9:89': DeviceType.PRINTER, // HP Printer
    '00:AA:84': DeviceType.PRINTER, // HP Printer
    '00:AB:7F': DeviceType.PRINTER, // HP Printer
    '00:AC:7A': DeviceType.PRINTER, // HP Printer
    '00:AD:75': DeviceType.PRINTER, // HP Printer
    '00:AE:70': DeviceType.PRINTER, // HP Printer
    '00:AF:6B': DeviceType.PRINTER, // HP Printer
    '00:B0:66': DeviceType.PRINTER, // HP Printer
    '00:B1:61': DeviceType.PRINTER, // HP Printer
    '00:B2:5C': DeviceType.PRINTER, // HP Printer
    '00:B3:57': DeviceType.PRINTER, // HP Printer
    '00:B4:52': DeviceType.PRINTER, // HP Printer
    '00:B5:4D': DeviceType.PRINTER, // HP Printer
    '00:B6:48': DeviceType.PRINTER, // HP Printer
    '00:B7:43': DeviceType.PRINTER, // HP Printer
    '00:B8:3E': DeviceType.PRINTER, // HP Printer
    '00:B9:39': DeviceType.PRINTER, // HP Printer
    '00:BA:34': DeviceType.PRINTER, // HP Printer
    '00:BB:2F': DeviceType.PRINTER, // HP Printer
    '00:BC:2A': DeviceType.PRINTER, // HP Printer
    '00:BD:25': DeviceType.PRINTER, // HP Printer
    '00:BE:20': DeviceType.PRINTER, // HP Printer
    '00:BF:1B': DeviceType.PRINTER, // HP Printer
    '00:C0:16': DeviceType.PRINTER, // HP Printer
    '00:C1:11': DeviceType.PRINTER, // HP Printer
    '00:C2:0C': DeviceType.PRINTER, // HP Printer
    '00:C3:07': DeviceType.PRINTER, // HP Printer
    '00:C4:02': DeviceType.PRINTER, // HP Printer
    '00:C5:FD': DeviceType.PRINTER, // HP Printer
    '00:C6:F8': DeviceType.PRINTER, // HP Printer
    '00:C7:F3': DeviceType.PRINTER, // HP Printer
    '00:C8:EE': DeviceType.PRINTER, // HP Printer
    '00:C9:E9': DeviceType.PRINTER, // HP Printer
    '00:CA:E4': DeviceType.PRINTER, // HP Printer
    '00:CB:DF': DeviceType.PRINTER, // HP Printer
    '00:CC:DA': DeviceType.PRINTER, // HP Printer
    '00:CD:D5': DeviceType.PRINTER, // HP Printer
    '00:CE:D0': DeviceType.PRINTER, // HP Printer
    '00:CF:CB': DeviceType.PRINTER, // HP Printer
    '00:D0:C6': DeviceType.PRINTER, // HP Printer
    '00:D1:C1': DeviceType.PRINTER, // HP Printer
    '00:D2:BC': DeviceType.PRINTER, // HP Printer
    '00:D3:B7': DeviceType.PRINTER, // HP Printer
    '00:D4:B2': DeviceType.PRINTER, // HP Printer
    '00:D5:AD': DeviceType.PRINTER, // HP Printer
    '00:D6:A8': DeviceType.PRINTER, // HP Printer
    '00:D7:A3': DeviceType.PRINTER, // HP Printer
    '00:D8:9E': DeviceType.PRINTER, // HP Printer
    '00:D9:99': DeviceType.PRINTER, // HP Printer
    '00:DA:94': DeviceType.PRINTER, // HP Printer
    '00:DB:8F': DeviceType.PRINTER, // HP Printer
    '00:DC:8A': DeviceType.PRINTER, // HP Printer
    '00:DD:85': DeviceType.PRINTER, // HP Printer
    '00:DE:80': DeviceType.PRINTER, // HP Printer
    '00:DF:7B': DeviceType.PRINTER, // HP Printer
    '00:E0:76': DeviceType.PRINTER, // HP Printer
    '00:E1:71': DeviceType.PRINTER, // HP Printer
    '00:E2:6C': DeviceType.PRINTER, // HP Printer
    '00:E3:67': DeviceType.PRINTER, // HP Printer
    '00:E4:62': DeviceType.PRINTER, // HP Printer
    '00:E5:5D': DeviceType.PRINTER, // HP Printer
    '00:E6:58': DeviceType.PRINTER, // HP Printer
    '00:E7:53': DeviceType.PRINTER, // HP Printer
    '00:E8:4E': DeviceType.PRINTER, // HP Printer
    '00:E9:49': DeviceType.PRINTER, // HP Printer
    '00:EA:44': DeviceType.PRINTER, // HP Printer
    '00:EB:3F': DeviceType.PRINTER, // HP Printer
    '00:EC:3A': DeviceType.PRINTER, // HP Printer
    '00:ED:35': DeviceType.PRINTER, // HP Printer
    '00:EE:30': DeviceType.PRINTER, // HP Printer
    '00:EF:2B': DeviceType.PRINTER, // HP Printer
    '00:F0:26': DeviceType.PRINTER, // HP Printer
    '00:F1:21': DeviceType.PRINTER, // HP Printer
    '00:F2:1C': DeviceType.PRINTER, // HP Printer
    '00:F3:17': DeviceType.PRINTER, // HP Printer
    '00:F4:12': DeviceType.PRINTER, // HP Printer
    '00:F5:0D': DeviceType.PRINTER, // HP Printer
    '00:F6:08': DeviceType.PRINTER, // HP Printer
    '00:F7:03': DeviceType.PRINTER, // HP Printer
    '00:F8:FE': DeviceType.PRINTER, // HP Printer
    '00:F9:F9': DeviceType.PRINTER, // HP Printer
    '00:FA:F4': DeviceType.PRINTER, // HP Printer
    '00:FB:EF': DeviceType.PRINTER, // HP Printer
    '00:FC:EA': DeviceType.PRINTER, // HP Printer
    '00:FD:E5': DeviceType.PRINTER, // HP Printer
    '00:FE:E0': DeviceType.PRINTER, // HP Printer
    '00:FF:DB': DeviceType.PRINTER, // HP Printer
  };

  constructor() {
    this.ouiDbPath = path.resolve(__dirname, '../../../../src/utils/oui-db.json');
    this.loadOuiDatabase();
  }

  /**
   * Charge la base de données OUI depuis le fichier JSON
   */
  private async loadOuiDatabase(): Promise<void> {
    try {
      if (this.isLoaded) {
        return;
      }

      this.logger.log('[OUI] Chargement de la base de données OUI...');
      
      if (!fs.existsSync(this.ouiDbPath)) {
        this.logger.error(`[OUI] Fichier oui-db.json introuvable: ${this.ouiDbPath}`);
        this.ouiDb = {};
        return;
      }

      const ouiRaw = fs.readFileSync(this.ouiDbPath, 'utf-8');
      this.ouiDb = JSON.parse(ouiRaw);
      
      this.isLoaded = true;
      this.logger.log(`[OUI] Base de données OUI chargée avec ${Object.keys(this.ouiDb).length} entrées`);
    } catch (error) {
      this.logger.error(`[OUI] Erreur lors du chargement de la base OUI: ${error.message}`);
      this.ouiDb = {};
    }
  }

  /**
   * Normalise une adresse MAC
   */
  private normalizeMacAddress(macAddress: string): string {
    if (!macAddress) return '';
    
    // Supprime les caractères non hexadécimaux et convertit en majuscules
    const clean = macAddress.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    
    // Formate en format XX:XX:XX:XX:XX:XX
    return clean.match(/.{1,2}/g)?.join(':') || '';
  }

  /**
   * Extrait le préfixe OUI (3 premiers octets) d'une adresse MAC
   */
  private extractOui(macAddress: string): string {
    const normalized = this.normalizeMacAddress(macAddress);
    return normalized.split(':').slice(0, 3).join(':');
  }

  /**
   * Détermine le type d'appareil basé sur l'adresse MAC
   */
  public getDeviceTypeFromMac(macAddress: string): { deviceType: DeviceType; confidence: number; vendor?: string } {
    if (!macAddress) {
      return { deviceType: DeviceType.OTHER, confidence: 0 };
    }

    const oui = this.extractOui(macAddress);
    const vendor = this.ouiDb[oui];

    // 1. Vérification des préfixes MAC connus (confiance élevée)
    if (this.knownMacPrefixes[oui]) {
      return {
        deviceType: this.knownMacPrefixes[oui],
        confidence: 0.9,
        vendor: vendor || 'Unknown'
      };
    }

    // 2. Recherche dans la base OUI par nom de constructeur
    if (vendor) {
      const deviceType = this.getDeviceTypeFromVendor(vendor);
      return {
        deviceType,
        confidence: 0.7,
        vendor
      };
    }

    // 3. Fallback vers OTHER
    return {
      deviceType: DeviceType.OTHER,
      confidence: 0.1,
      vendor: 'Unknown'
    };
  }

  /**
   * Détermine le type d'appareil basé sur le nom du constructeur
   */
  private getDeviceTypeFromVendor(vendor: string): DeviceType {
    if (!vendor) return DeviceType.OTHER;

    const vendorLower = vendor.toLowerCase();

    // Cas spéciaux pour Apple (iPhone/iPad vs Mac)
    if (vendorLower.includes('apple')) {
      // Apple peut être mobile ou desktop selon le contexte
      // On retourne MOBILE par défaut car plus courant dans un réseau
      return DeviceType.MOBILE;
    }

    // Recherche exacte dans le mapping principal
    for (const [key, deviceType] of Object.entries(this.vendorToDeviceType)) {
      if (vendorLower.includes(key.toLowerCase())) {
        return deviceType;
      }
    }

    // Recherche par mots-clés spécifiques (plus précis que le mapping)
    if (vendorLower.includes('router') || vendorLower.includes('gateway') || vendorLower.includes('firewall')) {
      return DeviceType.ROUTER;
    }
    if (vendorLower.includes('switch') || vendorLower.includes('hub') || vendorLower.includes('core')) {
      return DeviceType.SWITCH;
    }
    if (vendorLower.includes('access point') || vendorLower.includes('ap') || vendorLower.includes('wireless') || vendorLower.includes('wifi')) {
      return DeviceType.AP;
    }
    if (vendorLower.includes('server') || vendorLower.includes('nas') || vendorLower.includes('storage') || vendorLower.includes('rack')) {
      return DeviceType.SERVER;
    }
    if (vendorLower.includes('desktop') || vendorLower.includes('workstation') || vendorLower.includes('pc') || vendorLower.includes('computer')) {
      return DeviceType.DESKTOP;
    }
    if (vendorLower.includes('laptop') || vendorLower.includes('notebook') || vendorLower.includes('macbook')) {
      return DeviceType.LAPTOP;
    }
    if (vendorLower.includes('mobile') || vendorLower.includes('phone') || vendorLower.includes('tablet') || vendorLower.includes('smartphone') || vendorLower.includes('iphone') || vendorLower.includes('ipad')) {
      return DeviceType.MOBILE;
    }
    if (vendorLower.includes('printer') || vendorLower.includes('print') || vendorLower.includes('scanner') || vendorLower.includes('mfp')) {
      return DeviceType.PRINTER;
    }

    // Si aucun mot-clé trouvé, essayer de deviner par le nom du vendeur
    if (vendorLower.includes('dell') || vendorLower.includes('hp') || vendorLower.includes('lenovo')) {
      // Ces vendeurs font principalement des ordinateurs
      return DeviceType.DESKTOP;
    }
    if (vendorLower.includes('samsung') || vendorLower.includes('lg') || vendorLower.includes('motorola') || vendorLower.includes('nokia')) {
      // Ces vendeurs font principalement des mobiles
      return DeviceType.MOBILE;
    }

    return DeviceType.OTHER;
  }

  /**
   * Obtient les informations du constructeur pour une adresse MAC
   */
  public getVendorInfo(macAddress: string): { vendor: string; oui: string } | null {
    if (!macAddress) return null;

    const oui = this.extractOui(macAddress);
    const vendor = this.ouiDb[oui];

    if (vendor) {
      return { vendor, oui };
    }

    return null;
  }

  /**
   * Met à jour la base de données OUI
   */
  public async updateOuiDatabase(): Promise<void> {
    this.isLoaded = false;
    await this.loadOuiDatabase();
  }

  /**
   * Obtient les statistiques de la base OUI
   */
  public getOuiStats(): { totalEntries: number; loaded: boolean; path: string } {
    return {
      totalEntries: Object.keys(this.ouiDb).length,
      loaded: this.isLoaded,
      path: this.ouiDbPath
    };
  }

  /**
   * Recherche des constructeurs par nom
   */
  public searchVendors(query: string): Array<{ oui: string; vendor: string }> {
    if (!query || query.length < 2) return [];

    const results: Array<{ oui: string; vendor: string }> = [];
    const queryLower = query.toLowerCase();

    for (const [oui, vendor] of Object.entries(this.ouiDb)) {
      if (vendor.toLowerCase().includes(queryLower)) {
        results.push({ oui, vendor });
      }
    }

    return results.slice(0, 50); // Limite à 50 résultats
  }
} 