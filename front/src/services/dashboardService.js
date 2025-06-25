import axios from 'axios'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api'

// Configuration axios avec token d'authentification
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Intercepteur pour ajouter le token d'authentification
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

class DashboardService {
  // Récupérer les données principales du dashboard
  async getDashboardData() {
    try {
      const response = await apiClient.get('/network/dashboard/summary')
      
      if (response.data.success) {
        const backendData = response.data.data
        
        // Adapter les données du backend au format frontend
        return {
          // Données disponibles via le backend
          devicesActive: backendData.devicesActive || 0,
          devicesInactive: backendData.devicesInactive || 0,
          alertsActive: backendData.alertsActive || 0,
          incidentsCritical: backendData.incidentsCritical || 0,
          totalDownload: backendData.totalDownload || 0,
          totalUpload: backendData.totalUpload || 0,
          evolution24h: backendData.evolution24h || [],
          
          // Données manquantes - utiliser des valeurs par défaut pour l'instant
          anomalies: [],
          topDevices: [],
          agentStatus: [],
          activityLog: [],
          latencyData: [100, 120, 90, 140, 80, 200, 130], // Données simulées
          latencyLabels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
        }
      }
      
      throw new Error('Erreur lors de la récupération des données du dashboard')
    } catch (error) {
      console.error('Erreur DashboardService.getDashboardData:', error)
      throw error
    }
  }

  // Récupérer les alertes
  async getAlerts(params = {}) {
    try {
      const response = await apiClient.get('/network/alerts', { params })
      return response.data
    } catch (error) {
      console.error('Erreur DashboardService.getAlerts:', error)
      throw error
    }
  }

  // Récupérer les appareils
  async getDevices() {
    try {
      const response = await apiClient.get('/network/devices')
      
      if (response.data.success) {
        // Transformer les appareils pour extraire les machines à risque
        const devices = response.data.data || []
        const topDevices = devices
          .filter(device => device.stats && (device.stats.cpu > 70 || device.stats.latency > 200))
          .slice(0, 5)
          .map(device => ({
            id: device.id,
            host: device.hostname || device.ipAddress,
            cpu: device.stats?.cpu || 0,
            latency: device.stats?.latency || 0,
          }))
        
        return {
          devices,
          topDevices,
        }
      }
      
      throw new Error('Erreur lors de la récupération des appareils')
    } catch (error) {
      console.error('Erreur DashboardService.getDevices:', error)
      throw error
    }
  }

  // Récupérer les agents (endpoint Express)
  async getAgents() {
    try {
      const response = await apiClient.get('/agents')
      return response.data
    } catch (error) {
      console.error('Erreur DashboardService.getAgents:', error)
      // Retourner des données par défaut si l'endpoint n'existe pas
      return [
        { id: 'a1', name: 'Agent Nmap', status: 'OK', lastRun: '10:10' },
        { id: 'a2', name: 'Agent Stats', status: 'KO', lastRun: '09:48' },
        { id: 'a3', name: 'Agent Ping', status: 'OK', lastRun: '10:05' },
      ]
    }
  }

  // Récupérer les notifications
  async getNotifications() {
    try {
      const response = await apiClient.get('/network/notifications')
      return response.data.notifications || []
    } catch (error) {
      console.error('Erreur DashboardService.getNotifications:', error)
      return []
    }
  }

  // Lancer un scan réseau
  async launchNetworkScan(config = {}) {
    try {
      const response = await apiClient.post('/network/scan', config)
      return response.data
    } catch (error) {
      console.error('Erreur DashboardService.launchNetworkScan:', error)
      throw error
    }
  }

  // Acquitter une alerte
  async acknowledgeAlert(alertId) {
    try {
      const response = await apiClient.post(`/network/alerts/${alertId}/ack`)
      return response.data
    } catch (error) {
      console.error('Erreur DashboardService.acknowledgeAlert:', error)
      throw error
    }
  }

  // Marquer une notification comme lue
  async markNotificationRead(notificationId) {
    try {
      const response = await apiClient.post(`/network/notifications/${notificationId}/read`)
      return response.data
    } catch (error) {
      console.error('Erreur DashboardService.markNotificationRead:', error)
      throw error
    }
  }
}

export default new DashboardService() 