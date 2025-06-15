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
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilCloudDownload,
  cilCloudUpload,
  cilChart,
  cilReload,
  cilFilter,
  cilSpeedometer,
} from '@coreui/icons'
import { API_CONFIG } from '../../config/api.config'

// Configuration de l'URL de base de l'API
axios.defaults.baseURL = API_CONFIG.BASE_URL

const NetworkStats = () => {
  const [timeRange, setTimeRange] = useState('24h')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({
    bandwidth: {
      download: 0,
      upload: 0,
      latency: 0,
      packetLoss: 0
    },
    traffic: [],
    devices: []
  })

  // Fonction pour charger les statistiques
  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = authService.getToken()
      
      if (!token) {
        window.location.href = '/login'
        return
      }

      // Configuration du header d'authentification
      authService.setAuthHeader(token)

      // Recuperation des statistiques
      const response = await axios.get(`${API_CONFIG.ROUTES.NETWORK.STATS}?timeRange=${timeRange}`)
      console.log('[FRONTEND] Statistiques recuperees:', response.data)
      
      setStats(response.data)
    } catch (err) {
      console.error('[FRONTEND] Erreur recuperation stats:', err)
      setError('Erreur lors du chargement des statistiques: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  // Charger les statistiques au montage et lors du changement de periode
  useEffect(() => {
    fetchStats()
  }, [timeRange])

  const handleRefresh = () => {
    fetchStats()
  }

  // Fonction pour formater les valeurs de bande passante
  const formatBandwidth = (value) => {
    return `${value.toFixed(1)} Mbps`
  }

  // Fonction pour formater le trafic
  const formatTraffic = (bytes) => {
    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let unitIndex = 0
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024
      unitIndex++
    }
    
    return `${value.toFixed(1)} ${units[unitIndex]}`
  }

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader>
          <CRow className="align-items-center">
            <CCol xs="auto">
              <h4 className="mb-0">Statistiques Reseau</h4>
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
                color="primary" 
                variant="outline" 
                onClick={handleRefresh}
                disabled={loading}
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
          ) : (
            <>
              <CRow>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Download</div>
                          <div className="fs-4 fw-semibold">{formatBandwidth(stats.bandwidth.download)}</div>
                        </div>
                        <CIcon icon={cilCloudDownload} size="xl" className="text-primary" />
                      </div>
                      <CProgress 
                        className="mt-3" 
                        height={4} 
                        value={(stats.bandwidth.download / 100) * 100} 
                        color={stats.bandwidth.download > 80 ? 'danger' : stats.bandwidth.download > 60 ? 'warning' : 'success'}
                      />
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Upload</div>
                          <div className="fs-4 fw-semibold">{formatBandwidth(stats.bandwidth.upload)}</div>
                        </div>
                        <CIcon icon={cilCloudUpload} size="xl" className="text-success" />
                      </div>
                      <CProgress 
                        className="mt-3" 
                        height={4} 
                        value={(stats.bandwidth.upload / 100) * 100}
                        color={stats.bandwidth.upload > 80 ? 'danger' : stats.bandwidth.upload > 60 ? 'warning' : 'success'}
                      />
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Latence</div>
                          <div className="fs-4 fw-semibold">{stats.bandwidth.latency} ms</div>
                        </div>
                        <CIcon icon={cilSpeedometer} size="xl" className="text-warning" />
                      </div>
                      <CProgress 
                        className="mt-3" 
                        height={4} 
                        value={stats.bandwidth.latency}
                        color={stats.bandwidth.latency > 100 ? 'danger' : stats.bandwidth.latency > 50 ? 'warning' : 'success'}
                      />
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Perte de paquets</div>
                          <div className="fs-4 fw-semibold">{stats.bandwidth.packetLoss}%</div>
                        </div>
                        <CIcon icon={cilChart} size="xl" className="text-danger" />
                      </div>
                      <CProgress 
                        className="mt-3" 
                        height={4} 
                        value={stats.bandwidth.packetLoss}
                        color={stats.bandwidth.packetLoss > 5 ? 'danger' : stats.bandwidth.packetLoss > 1 ? 'warning' : 'success'}
                      />
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>

              <CRow>
                <CCol md={6}>
                  <CCard className="mb-4">
                    <CCardHeader>
                      <h5 className="mb-0">Trafic par Protocole</h5>
                    </CCardHeader>
                    <CCardBody>
                      <CTable hover>
                        <CTableHead>
                          <CTableRow>
                            <CTableHeaderCell>Protocole</CTableHeaderCell>
                            <CTableHeaderCell>Port</CTableHeaderCell>
                            <CTableHeaderCell>Trafic</CTableHeaderCell>
                            <CTableHeaderCell>%</CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          {stats.traffic.map((item, index) => (
                            <CTableRow key={index}>
                              <CTableDataCell>{item.protocol}</CTableDataCell>
                              <CTableDataCell>{item.port}</CTableDataCell>
                              <CTableDataCell>{formatTraffic(item.bytes)}</CTableDataCell>
                              <CTableDataCell>
                                <CProgress
                                  thin
                                  color={item.percentage > 50 ? 'primary' : item.percentage > 25 ? 'success' : 'info'}
                                  value={item.percentage}
                                />
                              </CTableDataCell>
                            </CTableRow>
                          ))}
                        </CTableBody>
                      </CTable>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol md={6}>
                  <CCard className="mb-4">
                    <CCardHeader>
                      <h5 className="mb-0">Statistiques par Appareil</h5>
                    </CCardHeader>
                    <CCardBody>
                      <CTable hover>
                        <CTableHead>
                          <CTableRow>
                            <CTableHeaderCell>Appareil</CTableHeaderCell>
                            <CTableHeaderCell>Trafic</CTableHeaderCell>
                            <CTableHeaderCell>Connexions</CTableHeaderCell>
                            <CTableHeaderCell>Statut</CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          {stats.devices.map((device, index) => (
                            <CTableRow key={index}>
                              <CTableDataCell>{device.hostname}</CTableDataCell>
                              <CTableDataCell>{formatTraffic(device.traffic)}</CTableDataCell>
                              <CTableDataCell>{device.connections}</CTableDataCell>
                              <CTableDataCell>
                                <span
                                  className={`badge bg-${
                                    device.status === 'active'
                                      ? 'success'
                                      : device.status === 'warning'
                                      ? 'warning'
                                      : 'danger'
                                  }`}
                                >
                                  {device.status}
                                </span>
                              </CTableDataCell>
                            </CTableRow>
                          ))}
                        </CTableBody>
                      </CTable>
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>
            </>
          )}
        </CCardBody>
      </CCard>
    </>
  )
}

export default NetworkStats 