// Configuration centralisée des timeouts et retries pour les opérations réseau

export const NETWORK_TIMEOUTS = {
  nmap: {
    rapide: { hostTimeout: 5000, maxRetries: 1, timing: 4 }, // ms, essais
    complet: { hostTimeout: 30000, maxRetries: 2, timing: 4 },
  },
  snmp: {
    rapide: { timeout: 2000, retries: 1 }, // ms, essais
    complet: { timeout: 3000, retries: 2 },
  },
  traceroute: {
    rapide: { perHop: 500, maxHops: 10 }, // ms, sauts
    complet: { perHop: 2000, maxHops: 20 },
  },
  arp: {
    timeout: 1000, // ms (Linux/Mac)
  },
  dns: {
    timeout: 2000, // ms (à utiliser pour Promise.race)
  },
}

export type NetworkTimeoutsType = typeof NETWORK_TIMEOUTS; 