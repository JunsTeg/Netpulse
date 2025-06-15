declare module 'net-snmp' {
  export function createSession(target: string, community: string, options?: {
    version?: '1' | '2c';
    timeout?: number;
    retries?: number;
  }): Session;
  
  interface Session {
    get(oids: string[], callback: (error: Error | null, varbinds: any[]) => void): void;
    close(): void;
  }
} 