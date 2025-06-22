import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from "@nestjs/websockets"
import { Logger } from "@nestjs/common"
import type { Server, Socket } from "socket.io"
import type { Device } from "./device.model"
import type { NetworkScanProgress } from "./network.types"

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class NetworkGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(NetworkGateway.name)
  private connectedClients = new Set<string>()

  handleConnection(client: Socket) {
    this.connectedClients.add(client.id)
    this.logger.log(`[WS] Client connecté: ${client.id} (${this.connectedClients.size} total)`)
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id)
    this.logger.log(`[WS] Client déconnecté: ${client.id} (${this.connectedClients.size} total)`)
  }

  @SubscribeMessage("join-network-room")
  handleJoinRoom(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    client.join("network-updates")
    this.logger.debug(`[WS] Client ${client.id} rejoint la room network-updates`)
  }

  @SubscribeMessage("leave-network-room")
  handleLeaveRoom(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    client.leave("network-updates")
    this.logger.debug(`[WS] Client ${client.id} quitte la room network-updates`)
  }

  broadcastDeviceChanges(changes: {
    added: Device[]
    updated: Device[]
    removed: Device[]
  }) {
    this.server.to("network-updates").emit("device-changes", {
      type: "device-changes",
      data: changes,
      timestamp: new Date(),
    })

    this.logger.log(
      `[WS] Diffusion changements appareils: +${changes.added.length} ~${changes.updated.length} -${changes.removed.length}`,
    )
  }

  broadcastScanProgress(progress: NetworkScanProgress) {
    this.server.to("network-updates").emit("scan-progress", {
      type: "scan-progress",
      data: progress,
      timestamp: new Date(),
    })
  }

  broadcastScanComplete(devices: Device[]) {
    this.server.to("network-updates").emit("scan-complete", {
      type: "scan-complete",
      data: { devices, count: devices.length },
      timestamp: new Date(),
    })

    this.logger.log(`[WS] Diffusion scan terminé: ${devices.length} appareils`)
  }

  broadcastError(error: string) {
    this.server.to("network-updates").emit("error", {
      type: "error",
      data: { message: error },
      timestamp: new Date(),
    })

    this.logger.error(`[WS] Diffusion erreur: ${error}`)
  }
}
