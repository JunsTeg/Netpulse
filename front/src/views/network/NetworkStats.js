import React, { useState, useEffect } from 'react'
import axios from 'axios'
import authService from '../../services/auth.service'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CProgress,
  CSpinner,
  CAlert,
  CFormSelect,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilCloudDownload,
  cilArrowTop,
  cilChart,
  cilReload,
  cilFilter,
  cilSpeedometer,
  cilDevices,
  cilWarning,
  cilCheckCircle,
} from '@coreui/icons'
import { API_CONFIG, buildApiUrl } from '../../config/api.config'

// Configuration de l'URL de base de l'API
axios.defaults.baseURL = API_CONFIG.BASE_URL

const NetworkStats = () => {
  const [loading, setLoading] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState(null)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [devices, setDevices] = useState([])
  const [deviceStats, setDeviceStats] = useState(null)
  const [interval, setInterval] = useState('1h')

  // Fonction pour charger la liste des appareils
  const fetchDevices = async () => {
    try {
      const response = await axios.get('/api/network/devices')
      if (response.data && response.data.success) {
        setDevices(response.data.data || [])
      } else {
        setDevices([])
      }
      setError(null)
    } catch (err) {
      console.error('[MVP-STATS] Erreur chargement appareils:', err)
      setError('Erreur lors du chargement des appareils: ' + err.message)
      setDevices([])
    }
  }

  // Fonction pour déclencher une collecte pour un appareil spécifique
  const triggerDeviceCollection = async (deviceId) => {
    if (!deviceId) return
    try {
      setCollecting(true)
      setError(null)
      
      console.log('[MVP-STATS] Collecte pour appareil:', deviceId)
      
      // Déclencher une collecte globale
      const response = await axios.post('/api/mvp-stats/collect')
      
      if (response.data && response.data.success) {
        console.log('[MVP-STATS] Collecte réussie, récupération des stats appareil')
        // Récupérer les statistiques de l'appareil après la collecte
        await fetchDeviceStats(deviceId)
      } else {
        throw new Error(response.data?.message || 'Échec de la collecte')
      }
    } catch (err) {
      console.error('[MVP-STATS] Erreur collecte appareil:', err)
      setError('Erreur lors de la collecte: ' + (err.response?.data?.message || err.message))
    } finally {
      setCollecting(false)
    }
  }

  // Fonction pour charger les statistiques d'un appareil
  const fetchDeviceStats = async (deviceId) => {
    if (!deviceId) return
    try {
      setLoading(true)
      setError(null)
      
      console.log('[MVP-STATS] Récupération stats appareil:', deviceId)
      
      // Récupérer les statistiques récentes et filtrer par appareil
      const [recentResponse, deviceResponse] = await Promise.all([
        axios.get('/api/mvp-stats/recent?limit=10'),
        axios.get(`/api/mvp-stats/device/${deviceId}?limit=5`)
      ])
      
      let stats = null
      
      // Essayer d'abord les statistiques spécifiques à l'appareil
      if (deviceResponse.data && deviceResponse.data.success && deviceResponse.data.data.length > 0) {
        const deviceData = deviceResponse.data.data[0]
        stats = {
          deviceId: deviceId,
          hostname: deviceData.hostname || 'Appareil inconnu',
          ipAddress: deviceData.ip_address || 'N/A',
          deviceType: deviceData.device_type || 'N/A',
          cpuUsage: deviceData.cpu_usage || 0,
          memoryUsage: deviceData.memory_usage || 0,
          bandwidthDownload: deviceData.bandwidth_download || 0,
          bandwidthUpload: deviceData.bandwidth_upload || 0,
          latency: deviceData.latency || 0,
          jitter: deviceData.jitter || 0,
          packetLoss: deviceData.packet_loss || 0,
          collectionStatus: deviceData.collection_status || 'unknown',
          collectionTime: deviceData.collection_time || 0,
          timestamp: deviceData.created_at || new Date(),
          anomalies: deviceData.anomalies_count || 0
        }
      } else if (recentResponse.data && recentResponse.data.success && recentResponse.data.data.length > 0) {
        // Fallback : chercher l'appareil dans les statistiques récentes
        const recentStats = recentResponse.data.data[0]
        if (recentStats.devices && recentStats.devices.length > 0) {
          const device = recentStats.devices.find(d => d.deviceId === deviceId)
          if (device) {
            stats = {
              deviceId: device.deviceId,
              hostname: device.hostname || 'Appareil inconnu',
              ipAddress: device.ipAddress || 'N/A',
              deviceType: device.deviceType || 'N/A',
              cpuUsage: device.system?.cpu || 0,
              memoryUsage: device.system?.memory || 0,
              bandwidthDownload: device.network?.bandwidth?.download || 0,
              bandwidthUpload: device.network?.bandwidth?.upload || 0,
              latency: device.network?.latency || 0,
              jitter: device.network?.jitter || 0,
              packetLoss: device.network?.packetLoss || 0,
              collectionStatus: device.collectionStatus || 'unknown',
              collectionTime: device.collectionTime || 0,
              timestamp: device.system?.timestamp || new Date(),
              anomalies: device.anomalies?.length || 0
            }
          }
        }
      }
      
      if (stats) {
        setDeviceStats(stats)
        console.log('[MVP-STATS] Statistiques appareil:', stats)
      } else {
        setDeviceStats(null)
        setError('Aucune statistique disponible pour cet appareil')
      }
      
    } catch (err) {
      console.error('[MVP-STATS] Erreur récupération stats appareil:', err)
      setError('Erreur lors du chargement des statistiques: ' + (err.response?.data?.message || err.message))
      setDeviceStats(null)
    } finally {
      setLoading(false)
    }
  }

  // Charger la liste des appareils au montage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = authService.getToken()
        if (!token) {
          console.log('Token manquant, redirection vers la page de connexion...')
          window.location.href = '/login'
          return
        }
        
        // Configuration du header d'authentification
        authService.setAuthHeader(token)
        
        await fetchDevices()
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error)
        if (error.message.includes('401') || error.message.includes('non autorisé')) {
          authService.logout()
          window.location.href = '/login'
        }
      }
    }
    
    initializeAuth()
  }, [])

  // Charger les statistiques quand l'appareil change
  useEffect(() => {
    if (selectedDevice) {
      fetchDeviceStats(selectedDevice)
    } else {
      setDeviceStats(null)
    }
  }, [selectedDevice])

  // Fonction pour rafraîchir les statistiques
  const handleRefresh = async () => {
    if (selectedDevice) {
      await fetchDeviceStats(selectedDevice)
    }
  }

  // Fonction pour formater les valeurs
  const formatBandwidth = (value) => {
    if (value === 0 || !value) return '0 Mbps'
    return `${value.toFixed(1)} Mbps`
  }

  const formatMemory = (value) => {
    if (value === 0 || !value) return '0 MB'
    return `${value.toFixed(0)} MB`
  }

  const formatLatency = (value) => {
    if (value === 0 || !value) return '0 ms'
    return `${value.toFixed(0)} ms`
  }

  const formatJitter = (value) => {
    if (value === 0 || !value) return '0 ms'
    return `${value.toFixed(1)} ms`
  }

  const formatPacketLoss = (value) => {
    if (value === 0 || !value) return '0%'
    return `${value.toFixed(2)}%`
  }

  // Fonction pour obtenir la couleur selon la valeur
  const getColorByValue = (value, thresholds) => {
    if (value >= thresholds.critical) return 'danger'
    if (value >= thresholds.warning) return 'warning'
    return 'success'
  }

  // Fonction pour obtenir le statut de collecte
  const getCollectionStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <CBadge color="success">Succès</CBadge>
      case 'partial':
        return <CBadge color="warning">Partiel</CBadge>
      case 'failed':
        return <CBadge color="danger">Échec</CBadge>
      default:
        return <CBadge color="secondary">Inconnu</CBadge>
    }
  }

  return (
    <CCard>
      <CCardHeader>
        <CRow className="align-items-center">
          <CCol xs="auto">
            <h4 className="mb-0">
              <CIcon icon={cilDevices} className="me-2" />
              Statistiques par Appareil
            </h4>
          </CCol>
          <CCol xs="auto" className="ms-auto">
            <CButton 
              color="success" 
              variant="outline" 
              onClick={() => triggerDeviceCollection(selectedDevice)}
              disabled={collecting || loading || !selectedDevice}
              className="me-2"
            >
                              {collecting ? (
                  <CSpinner size="sm" />
                ) : (
                  <CIcon icon={cilReload} />
                )}
              {collecting ? ' Collecte...' : ' Collecter'}
            </CButton>
            <CButton 
              color="primary" 
              variant="outline" 
              onClick={handleRefresh}
              disabled={loading || collecting || !selectedDevice}
            >
              {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} />}
            </CButton>
          </CCol>
        </CRow>
      </CCardHeader>
      <CCardBody>
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}

        <CRow className="mb-4">
          <CCol md={6}>
            <div className="mb-3">
              <label className="form-label">Appareil</label>
              <CFormSelect
                value={selectedDevice || ''}
                onChange={(e) => setSelectedDevice(e.target.value)}
                disabled={loading || collecting}
              >
                <option value="">Sélectionnez un appareil</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.hostname || device.ipAddress} ({device.deviceType || 'N/A'})
                  </option>
                ))}
              </CFormSelect>
            </div>
          </CCol>
          <CCol md={6}>
            <div className="mb-3">
              <label className="form-label">Intervalle</label>
              <CFormSelect
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                disabled={loading || collecting || !selectedDevice}
              >
                <option value="5m">5 minutes</option>
                <option value="15m">15 minutes</option>
                <option value="1h">1 heure</option>
                <option value="6h">6 heures</option>
                <option value="1d">1 jour</option>
                <option value="1w">1 semaine</option>
              </CFormSelect>
            </div>
          </CCol>
        </CRow>

        {!selectedDevice ? (
          <div className="text-center py-5">
            <CIcon icon={cilDevices} size="xl" className="text-muted mb-3" />
            <p>Sélectionnez un appareil pour voir ses statistiques</p>
          </div>
        ) : loading ? (
          <div className="text-center py-5">
            <CSpinner />
            <p className="mt-2">Chargement des statistiques...</p>
          </div>
        ) : deviceStats ? (
          <>
            {/* Informations de l'appareil */}
            <CRow className="mb-4">
              <CCol md={12}>
                <CCard className="mb-4">
                  <CCardBody>
          <CRow>
                      <CCol md={3}>
                        <div className="text-center">
                          <h6>Appareil</h6>
                          <p className="mb-0">{deviceStats.hostname}</p>
                          <small className="text-muted">{deviceStats.ipAddress}</small>
                        </div>
                      </CCol>
                      <CCol md={3}>
                        <div className="text-center">
                          <h6>Type</h6>
                          <p className="mb-0">{deviceStats.deviceType}</p>
                        </div>
                      </CCol>
                      <CCol md={3}>
                        <div className="text-center">
                          <h6>Statut Collecte</h6>
                          <div className="mb-0">
                            {getCollectionStatusBadge(deviceStats.collectionStatus)}
                          </div>
                        </div>
                      </CCol>
                      <CCol md={3}>
                        <div className="text-center">
                          <h6>Anomalies</h6>
                          <p className="mb-0">
                            {deviceStats.anomalies > 0 ? (
                              <CBadge color="danger">{deviceStats.anomalies}</CBadge>
                            ) : (
                              <CBadge color="success">0</CBadge>
                            )}
                          </p>
                        </div>
                      </CCol>
                    </CRow>
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>

            {/* Métriques système */}
            <CRow className="mb-4">
            <CCol md={6}>
              <div className="mb-4">
                <h6>Utilisation CPU</h6>
                <CProgress 
                    value={deviceStats.cpuUsage} 
                    color={getColorByValue(deviceStats.cpuUsage, { warning: 70, critical: 90 })}
                    className="mb-2"
                  />
                  <div className="d-flex justify-content-between">
                    <small className="text-muted">{deviceStats.cpuUsage.toFixed(1)}%</small>
                    <small className="text-muted">
                      {deviceStats.cpuUsage > 90 ? 'Critique' : 
                       deviceStats.cpuUsage > 70 ? 'Élevé' : 'Normal'}
                    </small>
                  </div>
              </div>
            </CCol>
            <CCol md={6}>
              <div className="mb-4">
                <h6>Utilisation Mémoire</h6>
                <CProgress 
                    value={deviceStats.memoryUsage} 
                    color={getColorByValue(deviceStats.memoryUsage, { warning: 2000, critical: 1000 })}
                    className="mb-2"
                  />
                  <div className="d-flex justify-content-between">
                    <small className="text-muted">{formatMemory(deviceStats.memoryUsage)}</small>
                    <small className="text-muted">
                      {deviceStats.memoryUsage < 1000 ? 'Critique' : 
                       deviceStats.memoryUsage < 2000 ? 'Faible' : 'Normal'}
                    </small>
                  </div>
                </div>
              </CCol>
            </CRow>

            {/* Métriques réseau */}
            <CRow className="mb-4">
              <CCol md={6}>
                <div className="mb-4">
                  <h6>Bande Passante Download</h6>
                  <div className="d-flex align-items-center mb-2">
                    <CIcon icon={cilCloudDownload} className="me-2" />
                    <span className="fs-5 fw-semibold">{formatBandwidth(deviceStats.bandwidthDownload)}</span>
                  </div>
              </div>
            </CCol>
            <CCol md={6}>
                <div className="mb-4">
                  <h6>Bande Passante Upload</h6>
                  <div className="d-flex align-items-center mb-2">
                    <CIcon icon={cilArrowTop} className="me-2" />
                    <span className="fs-5 fw-semibold">{formatBandwidth(deviceStats.bandwidthUpload)}</span>
                  </div>
                </div>
              </CCol>
            </CRow>

            <CRow className="mb-4">
              <CCol md={4}>
              <div className="mb-4">
                <h6>Latence</h6>
                  <div className="d-flex align-items-center mb-2">
                  <CIcon icon={cilSpeedometer} className="me-2" />
                    <span className="fs-5 fw-semibold">{formatLatency(deviceStats.latency)}</span>
                  </div>
                  <small className="text-muted">
                    {deviceStats.latency > 200 ? 'Élevée' : 
                     deviceStats.latency > 100 ? 'Modérée' : 'Normale'}
                  </small>
                </div>
              </CCol>
              <CCol md={4}>
                <div className="mb-4">
                  <h6>Jitter</h6>
                  <div className="d-flex align-items-center mb-2">
                    <CIcon icon={cilChart} className="me-2" />
                    <span className="fs-5 fw-semibold">{formatJitter(deviceStats.jitter)}</span>
                </div>
              </div>
            </CCol>
              <CCol md={4}>
              <div className="mb-4">
                  <h6>Perte de Paquets</h6>
                  <div className="d-flex align-items-center mb-2">
                    <CIcon icon={cilWarning} className="me-2" />
                    <span className="fs-5 fw-semibold">{formatPacketLoss(deviceStats.packetLoss)}</span>
                  </div>
                  <small className="text-muted">
                    {deviceStats.packetLoss > 10 ? 'Critique' : 
                     deviceStats.packetLoss > 5 ? 'Élevée' : 'Normale'}
                  </small>
              </div>
            </CCol>
            </CRow>

            {/* Informations de collecte */}
            <CRow>
            <CCol md={6}>
              <div className="mb-4">
                  <h6>Temps de Collecte</h6>
                <div className="d-flex align-items-center">
                    <CIcon icon={cilReload} className="me-2" />
                    <span>{deviceStats.collectionTime} ms</span>
                  </div>
              </div>
            </CCol>
            <CCol md={6}>
              <div className="mb-4">
                  <h6>Dernière Mise à Jour</h6>
                <div className="d-flex align-items-center">
                  <CIcon icon={cilReload} className="me-2" />
                    <span>{new Date(deviceStats.timestamp).toLocaleString('fr-FR')}</span>
                  </div>
              </div>
            </CCol>
          </CRow>
          </>
        ) : (
          <div className="text-center py-5">
            <CIcon icon={cilWarning} size="xl" className="text-muted mb-3" />
            <p>Aucune statistique disponible pour cet appareil</p>
            <CButton 
              color="primary" 
              onClick={() => triggerDeviceCollection(selectedDevice)}
              disabled={collecting}
            >
              <CIcon icon={cilReload} className="me-2" />
              Lancer une collecte
            </CButton>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default NetworkStats 