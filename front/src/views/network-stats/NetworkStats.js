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
  CButtonGroup,
  CFormSelect,
  CProgress,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CAlert,
  CSpinner,
  CBadge,
  CCardGroup,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilCloudDownload,
  cilArrowTop,
  cilChart,
  cilReload,
  cilFilter,
  cilSpeedometer,
  cilWarning,
  cilCheckCircle,
  cilXCircle,
  cilDevices,
} from '@coreui/icons'
import { API_CONFIG, buildApiUrl } from '../../config/api.config'

// Configuration de l'URL de base de l'API
axios.defaults.baseURL = API_CONFIG.BASE_URL

const NetworkStats = () => {
  const [timeRange, setTimeRange] = useState('24h')
  const [loading, setLoading] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState(null)
  const [globalStats, setGlobalStats] = useState(null)
  const [recentStats, setRecentStats] = useState([])
  const [anomalies, setAnomalies] = useState([])

  // Fonction pour déclencher une nouvelle collecte de statistiques
  const triggerCollection = async () => {
    try {
      setCollecting(true)
      setError(null)
      
      console.log('[MVP-STATS] Déclenchement d\'une nouvelle collecte...')
      
      const response = await axios.post('/api/mvp-stats/collect')
      
      if (response.data && response.data.success) {
        console.log('[MVP-STATS] Collecte réussie:', response.data)
        // Recharger les statistiques après la collecte
        await fetchStats()
      } else {
        throw new Error(response.data?.message || 'Échec de la collecte')
      }
    } catch (err) {
      console.error('[MVP-STATS] Erreur lors de la collecte:', err)
      setError('Erreur lors de la collecte: ' + (err.response?.data?.message || err.message))
    } finally {
      setCollecting(false)
    }
  }

  // Fonction pour charger les statistiques
  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Vérification de l'authentification
      const token = authService.getToken()
      if (!token) {
        console.log('Token manquant, redirection vers la page de connexion...')
        window.location.href = '/login'
        return
      }

      // Configuration du header d'authentification
      authService.setAuthHeader(token)

      console.log('[MVP-STATS] Chargement des statistiques...')
      
      // Récupération des statistiques récentes
      const [recentResponse, anomaliesResponse, dashboardResponse] = await Promise.all([
        axios.get('/api/mvp-stats/recent?limit=5'),
        axios.get('/api/mvp-stats/anomalies?limit=10'),
        axios.get('/api/mvp-stats/dashboard')
      ])
      
      console.log('[MVP-STATS] Données récupérées:', {
        recent: recentResponse.data,
        anomalies: anomaliesResponse.data,
        dashboard: dashboardResponse.data
      })
      
      // Traitement des statistiques récentes
      if (recentResponse.data && recentResponse.data.success) {
        setRecentStats(recentResponse.data.data || [])
        
        // Prendre les statistiques les plus récentes comme statistiques globales
        if (recentResponse.data.data && recentResponse.data.data.length > 0) {
          setGlobalStats(recentResponse.data.data[0])
        }
      }
      
      // Traitement des anomalies
      if (anomaliesResponse.data && anomaliesResponse.data.success) {
        setAnomalies(anomaliesResponse.data.data || [])
      }
      
      // Traitement des données du dashboard
      if (dashboardResponse.data && dashboardResponse.data.success) {
        const dashboardData = dashboardResponse.data.data
        if (dashboardData && !globalStats) {
          // Utiliser les données du dashboard si pas de stats récentes
          setGlobalStats({
            timestamp: new Date(),
            totalDevices: dashboardData.overview?.totalDevices || 0,
            activeDevices: dashboardData.overview?.activeDevices || 0,
            failedDevices: dashboardData.overview?.failedDevices || 0,
            summary: dashboardData.metrics || {
              avgCpu: 0,
              avgMemory: 0,
              avgBandwidth: 0,
              avgLatency: 0,
              totalAnomalies: 0
            },
            globalAnomalies: {
              count: dashboardData.alerts?.totalAnomalies || 0,
              anomalies: []
            }
          })
        }
      }
      
    } catch (err) {
      console.error('[MVP-STATS] Erreur récupération stats:', err)
      if (err.response?.status === 401) {
        authService.logout()
        window.location.href = '/login'
      } else {
        setError('Erreur lors du chargement des statistiques: ' + (err.response?.data?.message || err.message))
      }
    } finally {
      setLoading(false)
    }
  }

  // Charger les statistiques au montage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = authService.getToken()
        if (!token) {
          console.log('Pas de token trouvé, redirection vers la page de connexion')
          window.location.href = '/login'
          return
        }
        
        // Configuration du header d'authentification
        authService.setAuthHeader(token)
        
        // Vérification que l'utilisateur est bien authentifié
        const currentUser = authService.getCurrentUser()
        
        if (!currentUser || !currentUser.id) {
          console.log('Utilisateur non valide, redirection vers la page de connexion')
          authService.logout()
          window.location.href = '/login'
          return
        }
        
        // Chargement des statistiques
        await fetchStats()
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

  const handleRefresh = () => {
    fetchStats()
  }

  // Fonction pour formater les valeurs de bande passante
  const formatBandwidth = (value) => {
    if (value === 0 || !value) return '0 Mbps'
    return `${value.toFixed(1)} Mbps`
  }

  // Fonction pour formater la mémoire
  const formatMemory = (value) => {
    if (value === 0 || !value) return '0 MB'
    return `${value.toFixed(0)} MB`
  }

  // Fonction pour formater la latence
  const formatLatency = (value) => {
    if (value === 0 || !value) return '0 ms'
    return `${value.toFixed(0)} ms`
  }

  // Fonction pour obtenir la couleur selon la valeur
  const getColorByValue = (value, thresholds) => {
    if (value >= thresholds.critical) return 'danger'
    if (value >= thresholds.warning) return 'warning'
    return 'success'
  }

  // Fonction pour obtenir le statut d'un appareil
  const getDeviceStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <CBadge color="success">Actif</CBadge>
      case 'partial':
        return <CBadge color="warning">Partiel</CBadge>
      case 'failed':
        return <CBadge color="danger">Échec</CBadge>
      default:
        return <CBadge color="secondary">Inconnu</CBadge>
    }
  }

  // Fonction pour obtenir la couleur de sévérité d'une anomalie
  const getAnomalySeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'danger'
      case 'warning':
        return 'warning'
      case 'info':
        return 'info'
      default:
        return 'secondary'
    }
  }

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader>
          <CRow className="align-items-center">
            <CCol xs="auto">
              <h4 className="mb-0">
                Statistiques Réseau 
              </h4>
            </CCol>
            <CCol xs="auto" className="ms-auto">
              <CButtonGroup className="me-2">
                <CButton
                  color="primary"
                  variant={timeRange === '24h' ? 'solid' : 'outline'}
                  onClick={() => setTimeRange('24h')}
                >
                  24h
                </CButton>
                <CButton
                  color="primary"
                  variant={timeRange === '7d' ? 'solid' : 'outline'}
                  onClick={() => setTimeRange('7d')}
                >
                  7j
                </CButton>
                <CButton
                  color="primary"
                  variant={timeRange === '30d' ? 'solid' : 'outline'}
                  onClick={() => setTimeRange('30d')}
                >
                  30j
                </CButton>
              </CButtonGroup>
              <CButton 
                color="success" 
                variant="outline" 
                onClick={triggerCollection}
                disabled={collecting || loading}
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
                disabled={loading || collecting}
              >
                {loading ? (
                  <CSpinner size="sm" />
                ) : (
                  <CIcon icon={cilReload} />
                )}
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

          {loading ? (
            <div className="text-center py-5">
              <CProgress animated value={100} className="mb-3" />
              <p>Chargement des statistiques...</p>
            </div>
          ) : globalStats ? (
            <>
              {/* Vue d'ensemble */}
              <CRow className="mb-4">
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Appareils Actifs</div>
                          <div className="fs-4 fw-semibold">
                            {globalStats.activeDevices}/{globalStats.totalDevices}
                          </div>
                          <div className="fs-6 text-muted">
                            {globalStats.totalDevices > 0 
                              ? `${((globalStats.activeDevices / globalStats.totalDevices) * 100).toFixed(1)}%`
                              : '0%'
                            }
                          </div>
                        </div>
                        <CIcon icon={cilDevices} size="xl" className="text-primary" />
                      </div>
                      <CProgress 
                        className="mt-3" 
                        height={4} 
                        value={globalStats.totalDevices > 0 
                          ? (globalStats.activeDevices / globalStats.totalDevices) * 100 
                          : 0
                        }
                        color={getColorByValue(
                          globalStats.totalDevices > 0 
                            ? (globalStats.failedDevices / globalStats.totalDevices) * 100 
                            : 0,
                          { warning: 10, critical: 20 }
                        )}
                      />
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">CPU Moyen</div>
                          <div className="fs-4 fw-semibold">{globalStats.summary.avgCpu?.toFixed(1) || 0}%</div>
                        </div>
                        <CIcon icon={cilSpeedometer} size="xl" className="text-warning" />
                      </div>
                      <CProgress 
                        className="mt-3" 
                        height={4} 
                        value={globalStats.summary.avgCpu || 0}
                        color={getColorByValue(globalStats.summary.avgCpu || 0, { warning: 70, critical: 90 })}
                      />
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Mémoire Moyenne</div>
                          <div className="fs-4 fw-semibold">{formatMemory(globalStats.summary.avgMemory)}</div>
                        </div>
                        <CIcon icon={cilChart} size="xl" className="text-info" />
                      </div>
                      <CProgress 
                        className="mt-3" 
                        height={4} 
                        value={globalStats.summary.avgMemory || 0}
                        color={getColorByValue(globalStats.summary.avgMemory || 0, { warning: 2000, critical: 1000 })}
                      />
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Latence Moyenne</div>
                          <div className="fs-4 fw-semibold">{formatLatency(globalStats.summary.avgLatency)}</div>
                        </div>
                        <CIcon icon={cilSpeedometer} size="xl" className="text-success" />
                      </div>
                      <CProgress 
                        className="mt-3" 
                        height={4} 
                        value={globalStats.summary.avgLatency || 0}
                        color={getColorByValue(globalStats.summary.avgLatency || 0, { warning: 100, critical: 200 })}
                      />
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>

              {/* Métriques détaillées */}
              <CRow className="mb-4">
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Bande Passante</div>
                          <div className="fs-4 fw-semibold">{formatBandwidth(globalStats.summary.avgBandwidth)}</div>
                        </div>
                        <CIcon icon={cilCloudDownload} size="xl" className="text-primary" />
                      </div>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Anomalies</div>
                          <div className="fs-4 fw-semibold">{globalStats.globalAnomalies?.count || 0}</div>
                        </div>
                        <CIcon icon={cilWarning} size="xl" className="text-danger" />
                      </div>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Appareils Échoués</div>
                          <div className="fs-4 fw-semibold">{globalStats.failedDevices || 0}</div>
                        </div>
                        <CIcon icon={cilXCircle} size="xl" className="text-danger" />
                      </div>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Dernière Mise à Jour</div>
                          <div className="fs-6 fw-semibold">
                            {globalStats.timestamp 
                              ? new Date(globalStats.timestamp).toLocaleString('fr-FR')
                              : 'N/A'
                            }
                          </div>
                        </div>
                        <CIcon icon={cilReload} size="xl" className="text-info" />
                      </div>
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>

              {/* Anomalies récentes */}
              <CRow>
                <CCol md={6}>
                  <CCard className="mb-4">
                    <CCardHeader>
                      <h5 className="mb-0">
                        <CIcon icon={cilWarning} className="me-2" />
                        Anomalies Récentes
                      </h5>
                    </CCardHeader>
                    <CCardBody>
                      {anomalies && anomalies.length > 0 ? (
                        <CTable hover>
                          <CTableHead>
                            <CTableRow>
                              <CTableHeaderCell>Type</CTableHeaderCell>
                              <CTableHeaderCell>Sévérité</CTableHeaderCell>
                              <CTableHeaderCell>Message</CTableHeaderCell>
                              <CTableHeaderCell>Date</CTableHeaderCell>
                            </CTableRow>
                          </CTableHead>
                          <CTableBody>
                            {anomalies.slice(0, 5).map((anomaly, index) => (
                              <CTableRow key={index}>
                                <CTableDataCell>
                                  <span className="text-capitalize">{anomaly.type?.replace('-', ' ')}</span>
                                </CTableDataCell>
                                <CTableDataCell>
                                  <CBadge color={getAnomalySeverityColor(anomaly.severity)}>
                                    {anomaly.severity}
                                  </CBadge>
                                </CTableDataCell>
                                <CTableDataCell>
                                  <small>{anomaly.message}</small>
                                </CTableDataCell>
                                <CTableDataCell>
                                  <small>
                                    {anomaly.timestamp 
                                      ? new Date(anomaly.timestamp).toLocaleString('fr-FR')
                                      : 'N/A'
                                    }
                                  </small>
                                </CTableDataCell>
                              </CTableRow>
                            ))}
                          </CTableBody>
                        </CTable>
                      ) : (
                        <div className="text-center py-4">
                          <CIcon icon={cilCheckCircle} size="xl" className="text-success mb-3" />
                          <p className="text-muted">Aucune anomalie détectée</p>
                        </div>
                      )}
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol md={6}>
                  <CCard className="mb-4">
                    <CCardHeader>
                      <h5 className="mb-0">
                        <CIcon icon={cilDevices} className="me-2" />
                        Collections Récentes
                      </h5>
                    </CCardHeader>
                    <CCardBody>
                      {recentStats && recentStats.length > 0 ? (
                        <CTable hover>
                          <CTableHead>
                            <CTableRow>
                              <CTableHeaderCell>Date</CTableHeaderCell>
                              <CTableHeaderCell>Appareils</CTableHeaderCell>
                              <CTableHeaderCell>Anomalies</CTableHeaderCell>
                              <CTableHeaderCell>Durée</CTableHeaderCell>
                            </CTableRow>
                          </CTableHead>
                          <CTableBody>
                            {recentStats.slice(0, 5).map((stat, index) => (
                              <CTableRow key={index}>
                                <CTableDataCell>
                                  <small>
                                    {stat.timestamp 
                                      ? new Date(stat.timestamp).toLocaleString('fr-FR')
                                      : 'N/A'
                                    }
                                  </small>
                                </CTableDataCell>
                                <CTableDataCell>
                                  <small>
                                    {stat.activeDevices}/{stat.totalDevices}
                                  </small>
                                </CTableDataCell>
                                <CTableDataCell>
                                  <small>{stat.globalAnomalies?.count || 0}</small>
                                </CTableDataCell>
                                <CTableDataCell>
                                  <small>{stat.collectionDuration || 0}ms</small>
                                </CTableDataCell>
                              </CTableRow>
                            ))}
                          </CTableBody>
                        </CTable>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-muted">Aucune collection récente</p>
                          <CButton 
                            color="primary" 
                            size="sm" 
                            onClick={triggerCollection}
                            disabled={collecting}
                          >
                            <CIcon icon={cilReload} className="me-2" />
                            Lancer une collecte
                          </CButton>
                        </div>
                      )}
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>
            </>
          ) : (
            <div className="text-center py-5">
              <CIcon icon={cilDevices} size="xl" className="text-muted mb-3" />
              <p className="text-muted">Aucune statistique disponible</p>
              <CButton 
                color="primary" 
                onClick={triggerCollection}
                disabled={collecting}
              >
                <CIcon icon={cilReload} className="me-2" />
                Lancer une collecte
              </CButton>
            </div>
          )}
        </CCardBody>
      </CCard>
    </>
  )
}

export default NetworkStats 