import { Injectable, Logger } from '@nestjs/common';
import { DeviceType } from '../device.model';
import { OuiService } from './oui.service';

export interface DeviceTypeDetectionResult {
  deviceType: DeviceType;
  confidence: number;
  method: 'mac' | 'ports' | 'hostname' | 'os' | 'fallback' | 'contextual';
  details: {
    macVendor?: string;
    openPorts?: number[];
    hostname?: string;
    os?: string;
    ttl?: number;
    scores?: Record<DeviceType, number>; // Added for contextual analysis
  };
}

export interface PortBasedDetection {
  [key: string]: {
    ports: number[];
    score: number;
    deviceType: DeviceType;
  };
}

@Injectable()
export class DeviceTypeService {
  private readonly logger = new Logger(DeviceTypeService.name);

  // Configuration de détection basée sur les ports
  private readonly portBasedDetection: PortBasedDetection = {
    router: {
      ports: [22, 23, 80, 443, 161, 162, 8080, 8443],
      score: 3,
      deviceType: DeviceType.ROUTER
    },
    switch: {
      ports: [22, 23, 80, 443, 161, 162],
      score: 3,
      deviceType: DeviceType.SWITCH
    },
    ap: {
      ports: [22, 80, 443, 161, 8080],
      score: 3,
      deviceType: DeviceType.AP
    },
    server: {
      ports: [22, 80, 443, 3389, 5985, 5986, 8080, 8443, 9000],
      score: 3,
      deviceType: DeviceType.SERVER
    },
    desktop: {
      ports: [135, 139, 445, 3389, 5985, 5986],
      score: 3,
      deviceType: DeviceType.DESKTOP
    },
    laptop: {
      ports: [135, 139, 445, 3389, 5985, 5986],
      score: 3,
      deviceType: DeviceType.LAPTOP
    },
    mobile: {
      ports: [80, 443, 8080, 8443],
      score: 2,
      deviceType: DeviceType.MOBILE
    },
    printer: {
      ports: [80, 443, 515, 631, 9100, 9101, 9102],
      score: 4,
      deviceType: DeviceType.PRINTER
    }
  };

  // Patterns de noms d'hôte pour la détection
  private readonly hostnamePatterns: Record<string, { pattern: RegExp; deviceType: DeviceType; score: number }> = {
    router: { pattern: /router|gateway|firewall|tplink|dlink|netgear|asus|linksys|infinitybox|modem/i, deviceType: DeviceType.ROUTER, score: 3 },
    switch: { pattern: /switch|hub|core|distribution/i, deviceType: DeviceType.SWITCH, score: 3 },
    ap: { pattern: /ap|access.?point|wireless|wifi/i, deviceType: DeviceType.AP, score: 3 },
    server: { pattern: /server|nas|storage|backup|mail|web|db|app|docker/i, deviceType: DeviceType.SERVER, score: 3 },
    printer: { pattern: /printer|print|hp|canon|epson|brother|lexmark|xerox|ricoh|sharp|kyocera/i, deviceType: DeviceType.PRINTER, score: 4 },
    mobile: { pattern: /mobile|phone|tablet|android|iphone|ipad|samsung|lg|motorola|nokia|xiaomi|oneplus|honor|oppo|vivo|realme|meizu|blackberry|htc|sony|google|pixel/i, deviceType: DeviceType.MOBILE, score: 4 },
    laptop: { pattern: /laptop|notebook|macbook|thinkpad|dell|hp|lenovo|acer|asus|msi|razer|alienware|macbook/i, deviceType: DeviceType.LAPTOP, score: 3 },
    desktop: { pattern: /desktop|pc|workstation|computer|imac|macpro|macmini/i, deviceType: DeviceType.DESKTOP, score: 2 }
  };

  // Patterns d'OS pour la détection
  private readonly osPatterns: Record<string, { pattern: RegExp; deviceType: DeviceType; score: number }> = {
    router: { pattern: /ios|nx-os|junos|fortios|paloalto/i, deviceType: DeviceType.ROUTER, score: 4 },
    switch: { pattern: /ios|nx-os|catos|ios-xe/i, deviceType: DeviceType.SWITCH, score: 4 },
    server: { pattern: /linux|unix|centos|ubuntu|debian|redhat|windows.?server/i, deviceType: DeviceType.SERVER, score: 3 },
    desktop: { pattern: /windows|macos|linux/i, deviceType: DeviceType.DESKTOP, score: 2 },
    mobile: { pattern: /android|ios|mobile/i, deviceType: DeviceType.MOBILE, score: 3 }
  };

  constructor(private readonly ouiService: OuiService) {}

  /**
   * Détermine le type d'appareil en utilisant plusieurs méthodes avec analyse contextuelle
   */
  public detectDeviceType(params: {
    macAddress?: string;
    openPorts?: number[];
    hostname?: string;
    os?: string;
    ttl?: number;
  }): DeviceTypeDetectionResult {
    const { macAddress, openPorts, hostname, os, ttl } = params;
    
    this.logger.debug(`[DEVICE-TYPE] Détection contextuelle pour: MAC=${macAddress}, Ports=${openPorts?.join(',')}, Hostname=${hostname}, OS=${os}, TTL=${ttl}`);

    // Analyse contextuelle complète
    const contextAnalysis = this.performContextAnalysis(params);
    
    // Si l'analyse contextuelle donne un résultat fiable, l'utiliser
    if (contextAnalysis.confidence >= 0.8) {
      this.logger.debug(`[DEVICE-TYPE] Détection contextuelle réussie: ${contextAnalysis.deviceType} (confiance: ${contextAnalysis.confidence})`);
      return contextAnalysis;
    }

    // Sinon, utiliser la méthode hiérarchique classique
    return this.performHierarchicalDetection(params);
  }

  /**
   * Analyse contextuelle complète combinant tous les indices
   */
  private performContextAnalysis(params: {
    macAddress?: string;
    openPorts?: number[];
    hostname?: string;
    os?: string;
    ttl?: number;
  }): DeviceTypeDetectionResult {
    const { macAddress, openPorts, hostname, os, ttl } = params;
    
    // Scores pour chaque type d'appareil
    const scores: Record<DeviceType, number> = {
      [DeviceType.ROUTER]: 0,
      [DeviceType.SWITCH]: 0,
      [DeviceType.AP]: 0,
      [DeviceType.SERVER]: 0,
      [DeviceType.DESKTOP]: 0,
      [DeviceType.LAPTOP]: 0,
      [DeviceType.MOBILE]: 0,
      [DeviceType.PRINTER]: 0,
      [DeviceType.OTHER]: 0
    };

    // 1. Analyse par MAC (vendeur + préfixes spécifiques)
    if (macAddress) {
      const macAnalysis = this.analyzeMacAddress(macAddress);
      scores[macAnalysis.deviceType] += macAnalysis.score;
      this.logger.debug(`[CONTEXT] MAC ${macAddress}: ${macAnalysis.deviceType} (+${macAnalysis.score})`);
    }

    // 2. Analyse par hostname (patterns spécifiques)
    if (hostname) {
      const hostnameAnalysis = this.analyzeHostname(hostname);
      scores[hostnameAnalysis.deviceType] += hostnameAnalysis.score;
      this.logger.debug(`[CONTEXT] Hostname ${hostname}: ${hostnameAnalysis.deviceType} (+${hostnameAnalysis.score})`);
    }

    // 3. Analyse par OS (signatures spécifiques)
    if (os) {
      const osAnalysis = this.analyzeOS(os);
      scores[osAnalysis.deviceType] += osAnalysis.score;
      this.logger.debug(`[CONTEXT] OS ${os}: ${osAnalysis.deviceType} (+${osAnalysis.score})`);
    }

    // 4. Analyse par ports (combinaisons spécifiques)
    if (openPorts && openPorts.length > 0) {
      const portAnalysis = this.analyzePorts(openPorts);
      scores[portAnalysis.deviceType] += portAnalysis.score;
      this.logger.debug(`[CONTEXT] Ports ${openPorts.join(',')}: ${portAnalysis.deviceType} (+${portAnalysis.score})`);
    }

    // 5. Analyse par TTL (signatures réseau)
    if (ttl) {
      const ttlAnalysis = this.analyzeTTL(ttl);
      scores[ttlAnalysis.deviceType] += ttlAnalysis.score;
      this.logger.debug(`[CONTEXT] TTL ${ttl}: ${ttlAnalysis.deviceType} (+${ttlAnalysis.score})`);
    }

    // 6. Règles contextuelles spéciales
    const contextRules = this.applyContextRules(params);
    for (const [deviceType, score] of Object.entries(contextRules)) {
      scores[deviceType as DeviceType] += score;
      this.logger.debug(`[CONTEXT] Règle contextuelle: ${deviceType} (+${score})`);
    }

    // Trouver le type avec le score le plus élevé
    const maxScore = Math.max(...Object.values(scores));
    const bestType = Object.keys(scores).find(type => scores[type as DeviceType] === maxScore) as DeviceType;

    // Normaliser la confiance (0-1)
    const confidence = Math.min(maxScore / 10, 1);

    return {
      deviceType: bestType,
      confidence,
      method: 'contextual',
      details: {
        macVendor: macAddress ? this.getVendorFromMac(macAddress) : undefined,
        openPorts,
        hostname,
        os,
        ttl,
        scores: scores // Inclure tous les scores pour debug
      }
    };
  }

  /**
   * Analyse MAC avec patterns spécifiques
   */
  private analyzeMacAddress(macAddress: string): { deviceType: DeviceType; score: number } {
    const oui = macAddress.substring(0, 8).toUpperCase();
    const vendor = this.getVendorFromMac(macAddress);
    
    // Patterns MAC spécifiques pour chaque type
    const macPatterns = {
      [DeviceType.MOBILE]: {
        prefixes: ['B6:E1:3A', '00:1A:11', '00:1B:63', '00:1C:B3', '00:1D:7D', '00:1E:8C', '00:1F:3F', '00:21:5C', '00:23:AE', '00:25:B3'],
        vendors: ['apple', 'samsung', 'lg', 'motorola', 'nokia', 'sony', 'xiaomi', 'oneplus', 'honor', 'oppo', 'vivo', 'realme', 'meizu', 'blackberry', 'htc', 'google'],
        score: 8
      },
      [DeviceType.ROUTER]: {
        prefixes: ['00:1A:79', '00:1B:63', '00:1C:B3', '00:1D:7D', '00:1E:8C', '00:1F:3F'],
        vendors: ['cisco', 'juniper', 'extreme', 'tplink', 'dlink', 'netgear', 'asus', 'linksys', 'huawei', 'zte', 'fortinet', 'palo alto', 'check point', 'f5', 'riverbed'],
        score: 8
      },
      [DeviceType.SERVER]: {
        prefixes: ['00:50:56', '00:0C:29', '00:1C:14', '00:05:69', 'B8:27:EB', 'DC:A6:32', 'E4:5F:01'],
        vendors: ['vmware', 'ibm', 'intel', 'amd', 'microsoft', 'oracle', 'sun', 'dell', 'hp'],
        score: 8
      },
      [DeviceType.DESKTOP]: {
        prefixes: ['00:1D:7D', '00:1F:5B', '00:1E:8C', '00:1F:3F'],
        vendors: ['dell', 'hp', 'lenovo', 'acer', 'asus', 'msi', 'razer', 'alienware'],
        score: 6
      },
      [DeviceType.LAPTOP]: {
        prefixes: ['00:1E:8C', '00:1F:3F', '00:1D:7D', '00:1F:5B'],
        vendors: ['dell', 'hp', 'lenovo', 'acer', 'asus', 'msi', 'razer', 'alienware', 'apple'],
        score: 6
      },
      [DeviceType.PRINTER]: {
        prefixes: ['00:80:77', '00:21:5C', '00:17:C8', '00:18:FE', '00:1B:78', '00:1E:A7', '00:1F:29'],
        vendors: ['hp', 'canon', 'epson', 'brother', 'lexmark', 'xerox', 'ricoh', 'sharp', 'kyocera', 'konica', 'minolta', 'toshiba', 'fujitsu', 'panasonic', 'sanyo'],
        score: 8
      }
    };

    for (const [deviceType, pattern] of Object.entries(macPatterns)) {
      if (pattern.prefixes.includes(oui) || (vendor && pattern.vendors.some(v => vendor.toLowerCase().includes(v)))) {
        return { deviceType: deviceType as DeviceType, score: pattern.score };
      }
    }

    return { deviceType: DeviceType.OTHER, score: 1 };
  }

  /**
   * Analyse hostname avec patterns très spécifiques
   */
  private analyzeHostname(hostname: string): { deviceType: DeviceType; score: number } {
    const hostnameLower = hostname.toLowerCase();
    
    // Patterns très spécifiques pour chaque type
    const hostnamePatterns = {
      [DeviceType.MOBILE]: {
        patterns: [
          /iphone/i, /ipad/i, /android/i, /samsung/i, /galaxy/i, /lg/i, /motorola/i, /nokia/i, /sony/i, /xiaomi/i, /oneplus/i, /honor/i, /oppo/i, /vivo/i, /realme/i, /meizu/i, /blackberry/i, /htc/i, /google/i, /pixel/i,
          /mobile/i, /phone/i, /tablet/i, /smartphone/i, /handset/i
        ],
        score: 8
      },
      [DeviceType.ROUTER]: {
        patterns: [
          /router/i, /gateway/i, /firewall/i, /tplink/i, /dlink/i, /netgear/i, /asus/i, /linksys/i, /infinitybox/i, /modem/i, /isp/i, /isprouter/i,
          /cisco/i, /juniper/i, /extreme/i, /huawei/i, /zte/i, /fortinet/i, /paloalto/i, /checkpoint/i, /f5/i, /riverbed/i
        ],
        score: 8
      },
      [DeviceType.SERVER]: {
        patterns: [
          /server/i, /nas/i, /storage/i, /backup/i, /mail/i, /web/i, /db/i, /app/i, /docker/i, /kubernetes/i, /k8s/i, /vm/i, /virtual/i, /esx/i, /vsphere/i,
          /rack/i, /blade/i, /tower/i, /dell/i, /hp/i, /ibm/i, /sun/i, /oracle/i, /microsoft/i
        ],
        score: 8
      },
      [DeviceType.DESKTOP]: {
        patterns: [
          /desktop/i, /pc/i, /workstation/i, /computer/i, /imac/i, /macpro/i, /macmini/i, /dell/i, /hp/i, /lenovo/i, /acer/i, /asus/i, /msi/i, /razer/i, /alienware/i
        ],
        score: 6
      },
      [DeviceType.LAPTOP]: {
        patterns: [
          /laptop/i, /notebook/i, /macbook/i, /thinkpad/i, /dell/i, /hp/i, /lenovo/i, /acer/i, /asus/i, /msi/i, /razer/i, /alienware/i, /ultrabook/i, /chromebook/i
        ],
        score: 6
      },
      [DeviceType.PRINTER]: {
        patterns: [
          /printer/i, /print/i, /hp/i, /canon/i, /epson/i, /brother/i, /lexmark/i, /xerox/i, /ricoh/i, /sharp/i, /kyocera/i, /konica/i, /minolta/i, /toshiba/i, /fujitsu/i, /panasonic/i, /sanyo/i,
          /mfp/i, /scanner/i, /copier/i, /plotter/i
        ],
        score: 8
      }
    };

    for (const [deviceType, pattern] of Object.entries(hostnamePatterns)) {
      if (pattern.patterns.some(p => p.test(hostnameLower))) {
        return { deviceType: deviceType as DeviceType, score: pattern.score };
      }
    }

    return { deviceType: DeviceType.OTHER, score: 1 };
  }

  /**
   * Analyse OS avec signatures spécifiques
   */
  private analyzeOS(os: string): { deviceType: DeviceType; score: number } {
    const osLower = os.toLowerCase();
    
    const osPatterns = {
      [DeviceType.MOBILE]: {
        patterns: [/ios/i, /android/i, /mobile/i, /iphone/i, /ipad/i, /samsung/i, /galaxy/i, /oneui/i, /miui/i, /emui/i, /coloros/i, /oxygenos/i],
        score: 7
      },
      [DeviceType.ROUTER]: {
        patterns: [/ios/i, /nx-os/i, /junos/i, /fortios/i, /paloalto/i, /checkpoint/i, /f5/i, /riverbed/i, /extreme/i, /aruba/i, /ruckus/i, /ubiquiti/i],
        score: 8
      },
      [DeviceType.SERVER]: {
        patterns: [/linux/i, /unix/i, /centos/i, /ubuntu/i, /debian/i, /redhat/i, /windows.?server/i, /esx/i, /vsphere/i, /vmware/i, /docker/i, /kubernetes/i],
        score: 7
      },
      [DeviceType.DESKTOP]: {
        patterns: [/windows/i, /macos/i, /linux/i, /ubuntu/i, /debian/i, /centos/i, /fedora/i, /arch/i, /gentoo/i],
        score: 5
      },
      [DeviceType.LAPTOP]: {
        patterns: [/windows/i, /macos/i, /linux/i, /ubuntu/i, /debian/i, /centos/i, /fedora/i, /arch/i, /gentoo/i],
        score: 5
      },
      [DeviceType.PRINTER]: {
        patterns: [/printer/i, /print/i, /scanner/i, /mfp/i, /copier/i, /plotter/i],
        score: 6
      }
    };

    for (const [deviceType, pattern] of Object.entries(osPatterns)) {
      if (pattern.patterns.some(p => p.test(osLower))) {
        return { deviceType: deviceType as DeviceType, score: pattern.score };
      }
    }

    return { deviceType: DeviceType.OTHER, score: 1 };
  }

  /**
   * Analyse ports avec combinaisons spécifiques
   */
  private analyzePorts(openPorts: number[]): { deviceType: DeviceType; score: number } {
    const portCombinations = {
      [DeviceType.MOBILE]: {
        ports: [80, 443, 8080, 8443],
        score: 4
      },
      [DeviceType.ROUTER]: {
        ports: [22, 23, 80, 443, 161, 162, 8080, 8443],
        score: 6
      },
      [DeviceType.SERVER]: {
        ports: [22, 80, 443, 3389, 5985, 5986, 8080, 8443, 9000, 3306, 5432, 6379, 27017],
        score: 7
      },
      [DeviceType.DESKTOP]: {
        ports: [135, 139, 445, 3389, 5985, 5986],
        score: 5
      },
      [DeviceType.LAPTOP]: {
        ports: [135, 139, 445, 3389, 5985, 5986],
        score: 5
      },
      [DeviceType.PRINTER]: {
        ports: [80, 443, 515, 631, 9100, 9101, 9102],
        score: 8
      }
    };

    for (const [deviceType, pattern] of Object.entries(portCombinations)) {
      const matchingPorts = openPorts.filter(port => pattern.ports.includes(port));
      if (matchingPorts.length > 0) {
        const score = (matchingPorts.length / Math.max(openPorts.length, pattern.ports.length)) * pattern.score;
        return { deviceType: deviceType as DeviceType, score };
      }
    }

    return { deviceType: DeviceType.OTHER, score: 1 };
  }

  /**
   * Analyse TTL avec signatures réseau
   */
  private analyzeTTL(ttl: number): { deviceType: DeviceType; score: number } {
    if (ttl >= 120 && ttl <= 130) {
      return { deviceType: DeviceType.DESKTOP, score: 4 }; // Windows
    } else if (ttl >= 60 && ttl <= 70) {
      return { deviceType: DeviceType.SERVER, score: 4 }; // Linux/Unix
    } else if (ttl >= 240) {
      return { deviceType: DeviceType.PRINTER, score: 3 }; // Imprimantes
    } else if (ttl >= 30 && ttl <= 50) {
      return { deviceType: DeviceType.MOBILE, score: 3 }; // Appareils mobiles
    } else if (ttl >= 64 && ttl <= 128) {
      return { deviceType: DeviceType.ROUTER, score: 3 }; // Équipements réseau
    }

    return { deviceType: DeviceType.OTHER, score: 1 };
  }

  /**
   * Règles contextuelles spéciales
   */
  private applyContextRules(params: {
    macAddress?: string;
    openPorts?: number[];
    hostname?: string;
    os?: string;
    ttl?: number;
  }): Record<DeviceType, number> {
    const scores: Record<DeviceType, number> = {
      [DeviceType.ROUTER]: 0,
      [DeviceType.SWITCH]: 0,
      [DeviceType.AP]: 0,
      [DeviceType.SERVER]: 0,
      [DeviceType.DESKTOP]: 0,
      [DeviceType.LAPTOP]: 0,
      [DeviceType.MOBILE]: 0,
      [DeviceType.PRINTER]: 0,
      [DeviceType.OTHER]: 0
    };

    const { macAddress, openPorts, hostname, os } = params;

    // Règles spéciales
    if (hostname?.toLowerCase().includes('iphone')) {
      scores[DeviceType.MOBILE] += 10; // Bonus majeur pour iPhone
    }
    if (hostname?.toLowerCase().includes('docker')) {
      scores[DeviceType.SERVER] += 5; // Docker = serveur
    }
    if (hostname?.toLowerCase().includes('infinitybox')) {
      scores[DeviceType.ROUTER] += 8; // InfinityBox = routeur
    }
    if (os?.toLowerCase().includes('ios') && hostname?.toLowerCase().includes('iphone')) {
      scores[DeviceType.MOBILE] += 5; // iOS + iPhone = mobile
    }
    if (openPorts?.includes(3389) && os?.toLowerCase().includes('windows')) {
      scores[DeviceType.DESKTOP] += 3; // RDP + Windows = desktop
    }

    return scores;
  }

  /**
   * Méthode hiérarchique classique (fallback)
   */
  private performHierarchicalDetection(params: {
    macAddress?: string;
    openPorts?: number[];
    hostname?: string;
    os?: string;
    ttl?: number;
  }): DeviceTypeDetectionResult {
    const { macAddress, openPorts, hostname, os, ttl } = params;

    // 1. Détection basée sur l'adresse MAC (priorité élevée)
    if (macAddress) {
      const macResult = this.detectFromMac(macAddress);
      this.logger.debug(`[DEVICE-TYPE] Résultat MAC: ${macResult.deviceType} (confiance: ${macResult.confidence})`);
      if (macResult.confidence >= 0.7) {
        this.logger.debug(`[DEVICE-TYPE] Détection MAC réussie: ${macResult.deviceType} (confiance: ${macResult.confidence})`);
        return macResult;
      }
    }

    // 2. Détection basée sur les ports ouverts
    if (openPorts && openPorts.length > 0) {
      const portResult = this.detectFromPorts(openPorts);
      this.logger.debug(`[DEVICE-TYPE] Résultat ports: ${portResult.deviceType} (confiance: ${portResult.confidence})`);
      if (portResult.confidence >= 0.6) {
        this.logger.debug(`[DEVICE-TYPE] Détection ports réussie: ${portResult.deviceType} (confiance: ${portResult.confidence})`);
        return portResult;
      }
    }

    // 3. Détection basée sur le nom d'hôte
    if (hostname) {
      const hostnameResult = this.detectFromHostname(hostname);
      this.logger.debug(`[DEVICE-TYPE] Résultat hostname: ${hostnameResult.deviceType} (confiance: ${hostnameResult.confidence})`);
      if (hostnameResult.confidence >= 0.5) {
        this.logger.debug(`[DEVICE-TYPE] Détection hostname réussie: ${hostnameResult.deviceType} (confiance: ${hostnameResult.confidence})`);
        return hostnameResult;
      }
    }

    // 4. Détection basée sur l'OS
    if (os) {
      const osResult = this.detectFromOS(os);
      this.logger.debug(`[DEVICE-TYPE] Résultat OS: ${osResult.deviceType} (confiance: ${osResult.confidence})`);
      if (osResult.confidence >= 0.4) {
        this.logger.debug(`[DEVICE-TYPE] Détection OS réussie: ${osResult.deviceType} (confiance: ${osResult.confidence})`);
        return osResult;
      }
    }

    // 5. Détection basée sur le TTL
    if (ttl) {
      const ttlResult = this.detectFromTTL(ttl);
      this.logger.debug(`[DEVICE-TYPE] Résultat TTL: ${ttlResult.deviceType} (confiance: ${ttlResult.confidence})`);
      if (ttlResult.confidence >= 0.3) {
        this.logger.debug(`[DEVICE-TYPE] Détection TTL réussie: ${ttlResult.deviceType} (confiance: ${ttlResult.confidence})`);
        return ttlResult;
      }
    }

    // 6. Fallback vers OTHER
    this.logger.debug(`[DEVICE-TYPE] Aucune détection réussie, fallback vers OTHER`);
    return {
      deviceType: DeviceType.OTHER,
      confidence: 0.1,
      method: 'fallback',
      details: {}
    };
  }

  /**
   * Détection basée sur l'adresse MAC
   */
  private detectFromMac(macAddress: string): DeviceTypeDetectionResult {
    const result = this.ouiService.getDeviceTypeFromMac(macAddress);
    
    return {
      deviceType: result.deviceType,
      confidence: result.confidence,
      method: 'mac',
      details: {
        macVendor: result.vendor
      }
    };
  }

  /**
   * Détection basée sur les ports ouverts
   */
  private detectFromPorts(openPorts: number[]): DeviceTypeDetectionResult {
    const scores: Record<DeviceType, number> = {
      [DeviceType.ROUTER]: 0,
      [DeviceType.SWITCH]: 0,
      [DeviceType.AP]: 0,
      [DeviceType.SERVER]: 0,
      [DeviceType.DESKTOP]: 0,
      [DeviceType.LAPTOP]: 0,
      [DeviceType.MOBILE]: 0,
      [DeviceType.PRINTER]: 0,
      [DeviceType.OTHER]: 0
    };

    // Calcul des scores pour chaque type d'appareil
    for (const [key, config] of Object.entries(this.portBasedDetection)) {
      const matchingPorts = openPorts.filter(port => config.ports.includes(port));
      if (matchingPorts.length > 0) {
        scores[config.deviceType] += (matchingPorts.length / config.ports.length) * config.score;
      }
    }

    // Recherche du type avec le score le plus élevé
    const maxScore = Math.max(...Object.values(scores));
    const bestType = Object.keys(scores).find(type => scores[type as DeviceType] === maxScore) as DeviceType;

    return {
      deviceType: bestType,
      confidence: maxScore / 10, // Normalisation entre 0 et 1
      method: 'ports',
      details: {
        openPorts
      }
    };
  }

  /**
   * Détection basée sur le nom d'hôte
   */
  private detectFromHostname(hostname: string): DeviceTypeDetectionResult {
    for (const [key, config] of Object.entries(this.hostnamePatterns)) {
      if (config.pattern.test(hostname)) {
        return {
          deviceType: config.deviceType,
          confidence: config.score / 5, // Normalisation entre 0 et 1
          method: 'hostname',
          details: {
            hostname
          }
        };
      }
    }

    return {
      deviceType: DeviceType.OTHER,
      confidence: 0.1,
      method: 'hostname',
      details: {
        hostname
      }
    };
  }

  /**
   * Détection basée sur l'OS
   */
  private detectFromOS(os: string): DeviceTypeDetectionResult {
    for (const [key, config] of Object.entries(this.osPatterns)) {
      if (config.pattern.test(os)) {
        return {
          deviceType: config.deviceType,
          confidence: config.score / 5, // Normalisation entre 0 et 1
          method: 'os',
          details: {
            os
          }
        };
      }
    }

    return {
      deviceType: DeviceType.OTHER,
      confidence: 0.1,
      method: 'os',
      details: {
        os
      }
    };
  }

  /**
   * Détection basée sur le TTL
   */
  private detectFromTTL(ttl: number): DeviceTypeDetectionResult {
    let deviceType = DeviceType.OTHER;
    let confidence = 0.1;

    if (ttl >= 120 && ttl <= 130) {
      deviceType = DeviceType.DESKTOP; // Windows
      confidence = 0.3;
    } else if (ttl >= 60 && ttl <= 70) {
      deviceType = DeviceType.SERVER; // Linux/Unix
      confidence = 0.3;
    } else if (ttl >= 240) {
      deviceType = DeviceType.PRINTER; // Imprimantes
      confidence = 0.2;
    } else if (ttl >= 30 && ttl <= 50) {
      deviceType = DeviceType.MOBILE; // Appareils mobiles
      confidence = 0.2;
    }

    return {
      deviceType,
      confidence,
      method: 'os',
      details: {
        ttl
      }
    };
  }

  /**
   * Obtient les ports typiques pour un type d'appareil
   */
  public getTypicalPorts(deviceType: DeviceType): number[] {
    const config = Object.values(this.portBasedDetection).find(c => c.deviceType === deviceType);
    return config?.ports || [];
  }

  /**
   * Valide si un type d'appareil est cohérent avec les ports ouverts
   */
  public validateDeviceType(deviceType: DeviceType, openPorts: number[]): { isValid: boolean; confidence: number } {
    if (!openPorts || openPorts.length === 0) {
      return { isValid: true, confidence: 0.5 };
    }

    const typicalPorts = this.getTypicalPorts(deviceType);
    const matchingPorts = openPorts.filter(port => typicalPorts.includes(port));
    const confidence = matchingPorts.length / Math.max(openPorts.length, typicalPorts.length);

    return {
      isValid: confidence >= 0.3,
      confidence
    };
  }

  /**
   * Obtient les statistiques de détection
   */
  public getDetectionStats(): {
    ouiStats: { totalEntries: number; loaded: boolean; path: string };
    portBasedTypes: string[];
    hostnamePatterns: string[];
    osPatterns: string[];
  } {
    return {
      ouiStats: this.ouiService.getOuiStats(),
      portBasedTypes: Object.keys(this.portBasedDetection),
      hostnamePatterns: Object.keys(this.hostnamePatterns),
      osPatterns: Object.keys(this.osPatterns)
    };
  }

  /**
   * Obtient le vendeur depuis une adresse MAC
   */
  private getVendorFromMac(macAddress: string): string | null {
    try {
      const oui = macAddress.substring(0, 8).toUpperCase();
      // Ici on pourrait utiliser le service OUI, mais pour l'instant on retourne null
      return null;
    } catch {
      return null;
    }
  }
} 