import { Test, TestingModule } from '@nestjs/testing';
import { NetworkDetectorService } from '../src/modules/network/network-detector.service';
import { EnhancedNetworkService } from '../src/modules/network/enhanced-network.service';
import { NetworkService } from '../src/modules/network/network.service';
import { NetworkGateway } from '../src/modules/network/network.gateway';

describe('Scan Auto System Verification', () => {
  let networkDetector: NetworkDetectorService;
  let enhancedNetworkService: EnhancedNetworkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NetworkDetectorService,
        EnhancedNetworkService,
        {
          provide: NetworkService,
          useValue: {
            scanNetwork: jest.fn(),
          },
        },
        {
          provide: NetworkGateway,
          useValue: {
            broadcastDeviceChanges: jest.fn(),
          },
        },
      ],
    }).compile();

    networkDetector = module.get<NetworkDetectorService>(NetworkDetectorService);
    enhancedNetworkService = module.get<EnhancedNetworkService>(EnhancedNetworkService);
  });

  describe('NetworkDetectorService', () => {
    it('should detect active network correctly', async () => {
      const result = await networkDetector['detectActiveNetwork']();
      
      // Vérifier que le résultat est soit null soit un objet avec les propriétés attendues
      if (result) {
        expect(result).toHaveProperty('cidr');
        expect(result).toHaveProperty('interface');
        expect(result).toHaveProperty('localIP');
        expect(result).toHaveProperty('gateway');
        expect(typeof result.cidr).toBe('string');
        expect(result.cidr).toMatch(/^\d+\.\d+\.\d+\.0\/24$/);
      }
    });

    it('should execute enhanced scan with proper configuration', async () => {
      const mockResult = {
        success: true,
        devices: [],
        scanMethod: 'hybrid',
        scanDuration: 1000,
        statistics: {
          totalDevices: 0,
          activeDevices: 0,
          vulnerableDevices: 0,
          averageResponseTime: 0,
          osDistribution: {},
          deviceTypes: {},
          topPorts: {},
        },
      };

      jest.spyOn(enhancedNetworkService, 'executeEnhancedScan').mockResolvedValue(mockResult);
      
      const result = await networkDetector['executeEnhancedScan']('192.168.1.0/24');
      
      expect(result).toEqual(mockResult);
      expect(enhancedNetworkService.executeEnhancedScan).toHaveBeenCalledWith(
        expect.objectContaining({
          target: '192.168.1.0/24',
          scanMethod: 'auto',
          deepScan: true,
          stealth: false,
          threads: 100,
          osDetection: true,
          serviceDetection: true,
          timing: 4,
        }),
        'system-auto-scan'
      );
    });

    it('should handle device changes correctly', async () => {
      const mockDevices = [
        {
          ipAddress: '192.168.1.1',
          hostname: 'test-device',
          os: 'Windows',
          deviceType: 'Desktop',
          macAddress: '00:11:22:33:44:55',
          stats: {
            status: 'active',
            services: [],
            cpu: 0,
            memory: 0,
            uptime: '',
          },
          lastSeen: new Date(),
          firstDiscovered: new Date(),
        },
      ];

      await networkDetector['processDeviceChanges'](mockDevices);
      
      const devices = networkDetector.getDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0].ipAddress).toBe('192.168.1.1');
    });

    it('should detect device changes correctly', () => {
      const oldDevice = {
        ipAddress: '192.168.1.1',
        hostname: 'old-device',
        os: 'Windows',
        deviceType: 'Desktop',
        macAddress: '00:11:22:33:44:55',
        stats: {
          status: 'active',
          services: [],
          cpu: 0,
          memory: 0,
          uptime: '',
        },
        lastSeen: new Date(),
        firstDiscovered: new Date(),
      };

      const newDevice = {
        ...oldDevice,
        hostname: 'new-device',
        os: 'Linux',
      };

      const hasChanged = networkDetector['hasDeviceChanged'](oldDevice, newDevice);
      expect(hasChanged).toBe(true);
    });

    it('should provide scan status correctly', () => {
      const status = networkDetector.getScanStatus();
      
      expect(status).toHaveProperty('isScanning');
      expect(status).toHaveProperty('lastMethod');
      expect(status).toHaveProperty('devicesCount');
      expect(status).toHaveProperty('lastUpdate');
      expect(typeof status.isScanning).toBe('boolean');
      expect(typeof status.lastMethod).toBe('string');
      expect(typeof status.devicesCount).toBe('number');
    });
  });

  describe('EnhancedNetworkService', () => {
    it('should determine best scan method correctly', async () => {
      const config = {
        target: '192.168.1.0/24',
        scanMethod: 'auto' as const,
        deepScan: true,
        threads: 100,
      };

      const method = await enhancedNetworkService['determineBestScanMethod'](config);
      
      // Vérifier que la méthode retournée est valide
      expect(['hybrid', 'powershell', 'python', 'nmap']).toContain(method);
    });

    it('should merge device results correctly', () => {
      const psDevices = [
        {
          ipAddress: '192.168.1.1',
          hostname: 'ps-device',
          os: 'Windows',
          deviceType: 'Desktop',
          macAddress: '00:11:22:33:44:55',
          stats: {
            status: 'active',
            services: [{ port: 80, name: 'HTTP' }],
            cpu: 0,
            memory: 0,
            uptime: '',
          },
          lastSeen: new Date(),
          firstDiscovered: new Date(),
        },
      ];

      const pyDevices = [
        {
          ipAddress: '192.168.1.1',
          hostname: 'py-device',
          os: 'Unknown',
          deviceType: 'Unknown',
          macAddress: '00:11:22:33:44:55',
          stats: {
            status: 'active',
            services: [{ port: 443, name: 'HTTPS' }],
            cpu: 0,
            memory: 0,
            uptime: '',
          },
          lastSeen: new Date(),
          firstDiscovered: new Date(),
        },
        {
          ipAddress: '192.168.1.2',
          hostname: 'py-only-device',
          os: 'Linux',
          deviceType: 'Server',
          macAddress: '00:11:22:33:44:66',
          stats: {
            status: 'active',
            services: [],
            cpu: 0,
            memory: 0,
            uptime: '',
          },
          lastSeen: new Date(),
          firstDiscovered: new Date(),
        },
      ];

      const merged = enhancedNetworkService['mergeDeviceResults'](psDevices, pyDevices);
      
      expect(merged).toHaveLength(2);
      
      // Vérifier la fusion des services
      const mergedDevice = merged.find(d => d.ipAddress === '192.168.1.1');
      expect(mergedDevice).toBeDefined();
      expect(mergedDevice?.stats.services).toHaveLength(2);
      expect(mergedDevice?.hostname).toBe('ps-device'); // PowerShell prioritaire
      expect(mergedDevice?.os).toBe('Windows'); // PowerShell prioritaire
    });

    it('should select best hostname correctly', () => {
      const bestHostname = enhancedNetworkService['selectBestHostname']('router-01', '192.168.1.1');
      expect(bestHostname).toBe('router-01'); // Plus informatif
      
      const bestHostname2 = enhancedNetworkService['selectBestHostname']('unknown', 'server-web-01');
      expect(bestHostname2).toBe('server-web-01'); // Plus informatif
    });

    it('should calculate hostname score correctly', () => {
      const score1 = enhancedNetworkService['calculateHostnameScore']('router-01');
      const score2 = enhancedNetworkService['calculateHostnameScore']('192.168.1.1');
      const score3 = enhancedNetworkService['calculateHostnameScore']('unknown');
      
      expect(score1).toBeGreaterThan(score2); // router-01 plus informatif
      expect(score2).toBeGreaterThan(score3); // IP plus informatif que unknown
    });

    it('should merge services correctly', () => {
      const psServices = [
        { port: 80, name: 'HTTP', status: 'open' },
        { port: 22, name: 'SSH', status: 'open' },
      ];

      const pyServices = [
        { port: 80, name: 'HTTP', version: '1.1', status: 'open' },
        { port: 443, name: 'HTTPS', status: 'open' },
      ];

      const merged = enhancedNetworkService['mergeServices'](psServices, pyServices);
      
      expect(merged).toHaveLength(3); // 80, 22, 443
      
      const httpService = merged.find(s => s.port === 80);
      expect(httpService).toBeDefined();
      expect(httpService?.name).toBe('HTTP');
      expect(httpService?.version).toBe('1.1'); // Version de Python
    });
  });

  describe('Error Handling', () => {
    it('should handle network detection errors gracefully', async () => {
      // Simuler une erreur dans la détection réseau
      jest.spyOn(require('os'), 'networkInterfaces').mockImplementation(() => {
        throw new Error('Network interface error');
      });

      const result = await networkDetector['detectActiveNetwork']();
      expect(result).toBeNull();
    });

    it('should handle enhanced scan errors gracefully', async () => {
      jest.spyOn(enhancedNetworkService, 'executeEnhancedScan').mockRejectedValue(
        new Error('Enhanced scan error')
      );

      const result = await networkDetector['executeEnhancedScan']('192.168.1.0/24');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Enhanced scan error');
      expect(result.scanMethod).toBe('error');
      expect(result.devices).toHaveLength(0);
    });

    it('should handle fallback scan errors gracefully', async () => {
      jest.spyOn(networkDetector['networkService'], 'scanNetwork').mockRejectedValue(
        new Error('Fallback scan error')
      );

      // Ne devrait pas lever d'exception
      await expect(
        networkDetector['executeFallbackScan']('192.168.1.0/24')
      ).resolves.not.toThrow();
    });
  });
}); 