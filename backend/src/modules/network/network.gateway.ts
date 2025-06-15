import { WebSocketGateway, WebSocketServer, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { NetworkService } from './network.service';
import { Device } from './device.model';

@WebSocketGateway({
  cors: {
    origin: '*', // En production, spécifier l'origine exacte
  },
})
export class NetworkGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NetworkGateway.name);
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private readonly networkService: NetworkService) {}

  // Connexion d'un client
  handleConnection(client: Socket) {
    this.logger.log(`Client connecte: ${client.id}`);
  }

  // Déconnexion d'un client
  handleDisconnect(client: Socket) {
    this.logger.log(`Client deconnecte: ${client.id}`);
    // Nettoyage des intervalles pour ce client
    this.updateIntervals.forEach((interval, key) => {
      if (key.startsWith(client.id)) {
        clearInterval(interval);
        this.updateIntervals.delete(key);
      }
    });
  }

  // Demande de stats en temps reel pour le reseau
  @SubscribeMessage('subscribeNetworkStats')
  async handleNetworkStatsSubscription(client: Socket) {
    const intervalKey = `${client.id}-network`;
    
    // Nettoyage de l'ancien intervalle si existe
    if (this.updateIntervals.has(intervalKey)) {
      clearInterval(this.updateIntervals.get(intervalKey));
    }

    // Envoi initial
    const stats = await this.networkService.getNetworkStats('24h');
    client.emit('networkStats', stats);

    // Mise à jour toutes les 5 secondes
    const interval = setInterval(async () => {
      try {
        const stats = await this.networkService.getNetworkStats('24h');
        client.emit('networkStats', stats);
      } catch (error) {
        this.logger.error(`Erreur mise a jour stats reseau: ${error.message}`);
      }
    }, 5000);

    this.updateIntervals.set(intervalKey, interval);
  }

  // Demande de stats en temps reel pour un appareil spécifique
  @SubscribeMessage('subscribeDeviceStats')
  async handleDeviceStatsSubscription(client: Socket, deviceId: string) {
    const intervalKey = `${client.id}-device-${deviceId}`;
    
    // Nettoyage de l'ancien intervalle si existe
    if (this.updateIntervals.has(intervalKey)) {
      clearInterval(this.updateIntervals.get(intervalKey));
    }

    // Envoi initial
    const stats = await this.networkService.getDeviceStats(deviceId, '1h');
    client.emit(`deviceStats-${deviceId}`, stats);

    // Mise à jour toutes les 5 secondes
    const interval = setInterval(async () => {
      try {
        const stats = await this.networkService.getDeviceStats(deviceId, '1h');
        client.emit(`deviceStats-${deviceId}`, stats);
      } catch (error) {
        this.logger.error(`Erreur mise a jour stats appareil: ${error.message}`);
      }
    }, 5000);

    this.updateIntervals.set(intervalKey, interval);
  }

  // Désabonnement des stats d'un appareil
  @SubscribeMessage('unsubscribeDeviceStats')
  handleDeviceStatsUnsubscription(client: Socket, deviceId: string) {
    const intervalKey = `${client.id}-device-${deviceId}`;
    if (this.updateIntervals.has(intervalKey)) {
      clearInterval(this.updateIntervals.get(intervalKey));
      this.updateIntervals.delete(intervalKey);
    }
  }

  // Désabonnement des stats du réseau
  @SubscribeMessage('unsubscribeNetworkStats')
  handleNetworkStatsUnsubscription(client: Socket) {
    const intervalKey = `${client.id}-network`;
    if (this.updateIntervals.has(intervalKey)) {
      clearInterval(this.updateIntervals.get(intervalKey));
      this.updateIntervals.delete(intervalKey);
    }
  }
} 