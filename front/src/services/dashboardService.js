import apiClient from './api.service'

// Intercepteur pour ajouter le token d'authentification
apiClient.request = (config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

class DashboardService {
  // Récupérer les données principales du dashboard
  async getDashboardData() {
    try {
      // Récupération parallèle de toutes les données
      const [
        networkSummary,
        mvpStats,
        recentAnomalies,
        devices,
        agentStatus,
        activityLog
      ] = await Promise.all([
        this.getNetworkSummary(),
        this.getMvpStats(),
        this.getRecentAnomalies(),
        this.getDevices(),
        this.getAgentStatus(),
        this.getActivityLog(5)
      ])

      // Fusion des données
      return {
        // Données réseau de base
        devicesActive: networkSummary.devicesActive || 0,
        devicesInactive: networkSummary.devicesInactive || 0,
        alertsActive: networkSummary.alertsActive || 0,
        incidentsCritical: networkSummary.incidentsCritical || 0,
        totalDownload: networkSummary.totalDownload || 0,
        totalUpload: networkSummary.totalUpload || 0,
        evolution24h: networkSummary.evolution24h || [],

        // Données MVP Stats
        ...mvpStats,

        // Anomalies récentes
        anomalies: recentAnomalies,

        // Appareils à risque
        topDevices: devices.topDevices || [],

        // État des agents
        agentStatus: agentStatus,

        // Journal d'activité
        activityLog: activityLog,

        // Données de latence (depuis MVP Stats ou simulées)
        latencyData: mvpStats.latencyData || [100, 120, 90, 140, 80, 200, 130],
        latencyLabels: mvpStats.latencyLabels || ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
      }
    } catch (error) {
      console.error('Erreur DashboardService.getDashboardData:', error)
      throw error
    }
  }

  // Récupérer le résumé réseau
  async getNetworkSummary() {
    try {
      const response = await apiClient.get('/network/dashboard/summary')
      
      if (response.success) {
        const data = response.data
        
        // Log pour debug
        console.log('[DashboardService] Données réseau reçues:', {
          devicesActive: data.devicesActive,
          devicesInactive: data.devicesInactive,
          totalDevices: data.devicesActive + data.devicesInactive,
          alertsActive: data.alertsActive,
          incidentsCritical: data.incidentsCritical
        })
        
        return {
          devicesActive: Number(data.devicesActive || 0),
          devicesInactive: Number(data.devicesInactive || 0),
          alertsActive: Number(data.alertsActive || 0),
          incidentsCritical: Number(data.incidentsCritical || 0),
          totalDownload: Number(data.totalDownload || 0),
          totalUpload: Number(data.totalUpload || 0),
          avgCpu: Number(data.avgCpu || 0),
          avgMemory: Number(data.avgMemory || 0),
          avgBandwidth: Number(data.avgBandwidth || 0),
          evolution24h: Array.isArray(data.evolution24h) ? data.evolution24h : []
        }
      }
      
      throw new Error('Erreur lors de la récupération du résumé réseau')
    } catch (error) {
      console.error('Erreur DashboardService.getNetworkSummary:', error)
      return {
        devicesActive: 0,
        devicesInactive: 0,
        alertsActive: 0,
        incidentsCritical: 0,
        totalDownload: 0,
        totalUpload: 0,
        avgCpu: 0,
        avgMemory: 0,
        avgBandwidth: 0,
        evolution24h: []
      }
    }
  }

  // Récupérer les statistiques MVP
  async getMvpStats() {
    try {
      const response = await apiClient.get('/mvp-stats/dashboard')
      
      if (response.status === 'success') {
        const data = response.data
        
        // Transformer les données MVP en format dashboard
        return {
          // Données de performance
          avgCpu: data.metrics?.avgCpu || 0,
          avgMemory: data.metrics?.avgMemory || 0,
          avgBandwidth: data.metrics?.avgBandwidth || 0,
          
          // Données de latence (simulées pour l'instant)
          latencyData: [100, 120, 90, 140, 80, 200, 130],
          latencyLabels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
          
          // Statistiques de collecte
          totalCollections: data.performance?.totalCollections || 0,
          avgCollectionTime: data.performance?.avgCollectionTime || 0,
          lastCollection: data.performance?.lastCollection
        }
      }
      
      throw new Error('Erreur lors de la récupération des statistiques MVP')
    } catch (error) {
      console.error('Erreur DashboardService.getMvpStats:', error)
      return {
        avgCpu: 0,
        avgMemory: 0,
        avgBandwidth: 0,
        latencyData: [100, 120, 90, 140, 80, 200, 130],
        latencyLabels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
        totalCollections: 0,
        avgCollectionTime: 0,
        lastCollection: null
      }
    }
  }

  // Récupérer les anomalies récentes
  async getRecentAnomalies() {
    try {
      // Récupérer spécifiquement les 3 dernières anomalies de la table mvp_anomalies
      const response = await apiClient.get('/mvp-stats/anomalies?limit=3')
      
      if (response.status === 'success') {
        return response.data.map(anomaly => ({
          id: anomaly.id,
          type: anomaly.type || 'Anomalie',
          device: anomaly.hostname || anomaly.ipAddress || 'Inconnu',
          time: new Date(anomaly.timestamp || anomaly.createdAt).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          severity: anomaly.severity,
          description: anomaly.message,
          threshold: anomaly.threshold,
          currentValue: anomaly.currentValue
        }))
      }
      
      throw new Error('Erreur lors de la récupération des anomalies')
    } catch (error) {
      console.error('Erreur DashboardService.getRecentAnomalies:', error)
      return []
    }
  }

  // Récupérer les appareils
  async getDevices() {
    try {
      const response = await apiClient.get('/network/devices')
      
      if (response.success) {
        // Transformer les appareils pour extraire les machines à risque
        const devices = response.data || []
        const topDevices = devices
          .filter(device => {
            const stats = device.stats || {}
            return (stats.cpuUsage > 70 || stats.memoryUsage > 80 || stats.latency > 200)
          })
          .slice(0, 5)
          .map(device => ({
            id: device.id,
            host: device.hostname || device.ipAddress,
            cpu: device.stats?.cpuUsage || 0,
            latency: device.stats?.latency || 0,
            memory: device.stats?.memoryUsage || 0
          }))
        
        return {
          devices,
          topDevices,
        }
      }
      
      throw new Error('Erreur lors de la récupération des appareils')
    } catch (error) {
      console.error('Erreur DashboardService.getDevices:', error)
      return {
        devices: [],
        topDevices: []
      }
    }
  }

  // Récupérer l'état des agents
  async getAgentStatus() {
    try {
      const response = await apiClient.get('/network/agents/status')
      
      if (response.success) {
        return response.data.map(agent => ({
          id: agent.id,
          name: agent.name,
          status: agent.status,
          lastRun: agent.lastRun,
          nextRun: agent.nextRun,
          uptime: agent.uptime,
          type: agent.type
        }))
      }
      
      throw new Error('Erreur lors de la récupération de l\'état des agents')
    } catch (error) {
      console.error('Erreur DashboardService.getAgentStatus:', error)
      // Fallback avec des données simulées
      return [
        { id: 'a1', name: 'Agent Nmap', status: 'OK', lastRun: '10:10' },
        { id: 'a2', name: 'Agent Stats', status: 'KO', lastRun: '09:48' },
        { id: 'a3', name: 'Agent Ping', status: 'OK', lastRun: '10:05' },
      ]
    }
  }

  // Récupérer le journal d'activité
  async getActivityLog(limit = 10) {
    try {
      const response = await apiClient.get(`/network/activity-log?limit=${limit}`)
      
      if (response.success) {
        return response.data.map(log => ({
          id: log.id,
          user: log.user,
          action: log.action,
          time: new Date(log.timestamp).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          type: log.type,
          details: log.details
        }))
      }
      
      throw new Error('Erreur lors de la récupération du journal d\'activité')
    } catch (error) {
      console.error('Erreur DashboardService.getActivityLog:', error)
      return [
        { id: 'log1', user: 'admin', action: 'Modifié seuil de latence', time: '10:01' },
        { id: 'log2', user: 'monitor', action: 'Lancé un scan manuel', time: '09:55' },
      ]
    }
  }

  // Enregistrer une activité
  async logActivity(activityData) {
    try {
      const response = await apiClient.post('/network/activity-log', activityData)
      
      if (response.success) {
        return response.data
      }
      
      throw new Error('Erreur lors de l\'enregistrement de l\'activité')
    } catch (error) {
      console.error('Erreur DashboardService.logActivity:', error)
      throw error
    }
  }

  // Récupérer les alertes
  async getAlerts(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString()
      const response = await apiClient.get(`/network/alerts?${queryString}`)
      
      if (response.success) {
        return response.results || []
      }
      
      throw new Error('Erreur lors de la récupération des alertes')
    } catch (error) {
      console.error('Erreur DashboardService.getAlerts:', error)
      return []
    }
  }

  // Lancer un scan réseau
  async triggerNetworkScan(mode = 'comprehensive') {
    try {
      const response = await apiClient.post('/network/scan', { mode })
      
      if (response.success) {
        return response
      }
      
      throw new Error('Erreur lors du lancement du scan')
    } catch (error) {
      console.error('Erreur DashboardService.triggerNetworkScan:', error)
      throw error
    }
  }

  // Générer un rapport
  async generateReport(type = 'dashboard') {
    try {
      const response = await apiClient.post('/network/reports', { type })
      
      if (response.success) {
        return response
      }
      
      throw new Error('Erreur lors de la génération du rapport')
    } catch (error) {
      console.error('Erreur DashboardService.generateReport:', error)
      throw error
    }
  }

  // Récupérer les statistiques en temps réel
  async getRealTimeStats() {
    try {
      const response = await apiClient.get('/mvp-stats/recent?limit=1')
      
      if (response.status === 'success' && response.data.length > 0) {
        return response.data[0]
      }
      
      throw new Error('Aucune donnée en temps réel disponible')
    } catch (error) {
      console.error('Erreur DashboardService.getRealTimeStats:', error)
      return null
    }
  }
}

export default new DashboardService() 