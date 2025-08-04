import { Injectable, Logger } from '@nestjs/common';
import * as snmp from 'net-snmp';
import { 
  MacTableEntry, 
  SnmpResult, 
  SnmpError, 
  TopologyOptions 
} from '../topology.types';

@Injectable()
export class SnmpService {
  private readonly logger = new Logger(SnmpService.name);
  private readonly cache = new Map<string, { data: MacTableEntry[], timestamp: number }>();
  private readonly defaultOptions: Required<Pick<TopologyOptions, 'snmpTimeout' | 'snmpRetries' | 'cacheTtl'>> = {
    snmpTimeout: 5000,
    snmpRetries: 2,
    cacheTtl: 300000, // 5 minutes
  };

  /**
   * Récupère la table MAC d'un switch via SNMP
   */
  async getMacTable(
    switchIp: string, 
    community = 'public', 
    options: Partial<TopologyOptions> = {}
  ): Promise<SnmpResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    const cacheKey = `${switchIp}:${community}`;

    try {
      // Vérifier le cache
      if (opts.cacheTtl > 0) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < opts.cacheTtl) {
          this.logger.debug(`[SNMP] Cache hit pour ${switchIp}`);
          return {
            success: true,
            data: cached.data,
            responseTime: Date.now() - startTime,
          };
        }
      }

      this.logger.debug(`[SNMP] Requête MAC table pour ${switchIp}`);
      const macTable = await this.queryMacTable(switchIp, community, opts);
      
      // Mettre en cache
      if (opts.cacheTtl > 0) {
        this.cache.set(cacheKey, { 
          data: macTable, 
          timestamp: Date.now() 
        });
      }

      return {
        success: true,
        data: macTable,
        responseTime: Date.now() - startTime,
      };

    } catch (error) {
      this.logger.warn(`[SNMP] Erreur pour ${switchIp}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Requête SNMP parallèle pour plusieurs switches
   */
  async getMacTablesParallel(
    switches: Array<{ id: string; ipAddress: string }>,
    community = 'public',
    options: Partial<TopologyOptions> = {}
  ): Promise<Map<string, MacTableEntry[]>> {
    const results = new Map<string, MacTableEntry[]>();
    const maxParallel = options.maxParallelQueries || 5;
    
    this.logger.log(`[SNMP] Requêtes parallèles pour ${switches.length} switches (max: ${maxParallel})`);

    // Diviser en groupes pour éviter de surcharger
    for (let i = 0; i < switches.length; i += maxParallel) {
      const batch = switches.slice(i, i + maxParallel);
      
      const promises = batch.map(async (sw) => {
        const result = await this.getMacTable(sw.ipAddress, community, options);
        return {
          switchId: sw.id,
          switchIp: sw.ipAddress,
          success: result.success,
          data: result.data || [],
          error: result.error,
        };
      });

      const batchResults = await Promise.allSettled(promises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { switchId, data, success, error } = result.value;
          if (success) {
            results.set(switchId, data);
          } else {
            this.logger.warn(`[SNMP] Échec pour ${result.value.switchIp}: ${error}`);
            results.set(switchId, []);
          }
        } else {
          this.logger.error(`[SNMP] Erreur inattendue: ${result.reason}`);
        }
      });

      // Pause entre les batches pour éviter la surcharge
      if (i + maxParallel < switches.length) {
        await this.delay(100);
      }
    }

    return results;
  }

  /**
   * Vérifie la connectivité SNMP d'un appareil
   */
  async checkSnmpConnectivity(
    ipAddress: string, 
    community = 'public',
    timeout = 3000
  ): Promise<boolean> {
    try {
      const session = snmp.createSession(ipAddress, community, {
        timeout,
        retries: 1,
      });

      return new Promise((resolve) => {
        const oid = '1.3.6.1.2.1.1.1.0'; // sysDescr
        session.get([oid], (error: any) => {
          session.close();
          resolve(!error);
        });
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Nettoie le cache SNMP
   */
  clearCache(): void {
    const beforeSize = this.cache.size;
    this.cache.clear();
    this.logger.log(`[SNMP] Cache nettoyé: ${beforeSize} entrées supprimées`);
  }

  /**
   * Obtient les statistiques du cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Requête SNMP brute pour la table MAC
   */
  private async queryMacTable(
    switchIp: string, 
    community: string, 
    options: Required<Pick<TopologyOptions, 'snmpTimeout' | 'snmpRetries'>>
  ): Promise<MacTableEntry[]> {
    return new Promise((resolve, reject) => {
      const session = snmp.createSession(switchIp, community, {
        timeout: options.snmpTimeout,
        retries: options.snmpRetries,
      });

      const macTable: MacTableEntry[] = [];
      const macTableOid = '1.3.6.1.2.1.17.4.3.1.2'; // dot1dTpFdbPort
      
      // Valeurs SNMP pour les erreurs courantes
      const SNMP_NoSuchInstance = 128;
      const SNMP_NoSuchObject = 129;
      const SNMP_EndOfMibView = 130;

      const walkCallback = (varbind: any) => {
        if (
          varbind.type === SNMP_NoSuchInstance ||
          varbind.type === SNMP_NoSuchObject ||
          varbind.type === SNMP_EndOfMibView
        ) {
          return;
        }

        try {
          const oidParts = varbind.oid.split('.');
          const mac = oidParts.slice(-6)
            .map((x: string) => (+x).toString(16).padStart(2, '0'))
            .join(':');

          macTable.push({
            mac,
            port: varbind.value,
            timestamp: new Date(),
          });
        } catch (error) {
          this.logger.warn(`[SNMP] Erreur parsing MAC pour ${switchIp}: ${error.message}`);
        }
      };

      const doneCallback = (error: any) => {
        session.close();
        if (error) {
          reject(new SnmpError(`Erreur SNMP pour ${switchIp}: ${error.message}`, { switchIp, error }));
        } else {
          resolve(macTable);
        }
      };

      (session as any).walk(macTableOid, 40, walkCallback, doneCallback);
    });
  }

  /**
   * Délai utilitaire
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 