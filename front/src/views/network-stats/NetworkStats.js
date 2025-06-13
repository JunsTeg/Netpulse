import React, { useState } from 'react'
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

const NetworkStats = () => {
  const [timeRange, setTimeRange] = useState('24h')
  const [loading, setLoading] = useState(false)

  // Donnees de test pour les statistiques
  const bandwidthStats = {
    download: 75,
    upload: 45,
    latency: 25,
    packetLoss: 0.5,
  }

  const trafficData = [
    { protocol: 'HTTP', port: 80, traffic: '1.2 GB', percentage: 35 },
    { protocol: 'HTTPS', port: 443, traffic: '2.1 GB', percentage: 60 },
    { protocol: 'DNS', port: 53, traffic: '0.1 GB', percentage: 5 },
    { protocol: 'SSH', port: 22, traffic: '0.05 GB', percentage: 2 },
  ]

  const deviceStats = [
    { name: 'Router-Core', traffic: '1.5 GB', connections: 156, status: 'active' },
    { name: 'Switch-Acces-01', traffic: '0.8 GB', connections: 89, status: 'active' },
    { name: 'AP-Wifi-01', traffic: '0.3 GB', connections: 45, status: 'warning' },
    { name: 'Server-01', traffic: '0.9 GB', connections: 67, status: 'active' },
  ]

  const handleRefresh = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 1000)
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
              <CButton color="primary" variant="outline" onClick={handleRefresh}>
                <CIcon icon={cilReload} />
              </CButton>
            </CCol>
          </CRow>
        </CCardHeader>
        <CCardBody>
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
                          <div className="fs-4 fw-semibold">{bandwidthStats.download} Mbps</div>
                        </div>
                        <CIcon icon={cilCloudDownload} size="xl" className="text-primary" />
                      </div>
                      <CProgress className="mt-3" height={4} value={bandwidthStats.download} />
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Upload</div>
                          <div className="fs-4 fw-semibold">{bandwidthStats.upload} Mbps</div>
                        </div>
                        <CIcon icon={cilCloudUpload} size="xl" className="text-success" />
                      </div>
                      <CProgress className="mt-3" height={4} value={bandwidthStats.upload} />
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Latence</div>
                          <div className="fs-4 fw-semibold">{bandwidthStats.latency} ms</div>
                        </div>
                        <CIcon icon={cilSpeedometer} size="xl" className="text-warning" />
                      </div>
                      <CProgress className="mt-3" height={4} value={bandwidthStats.latency} color="warning" />
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol sm={6} lg={3}>
                  <CCard className="mb-4">
                    <CCardBody>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fs-6 fw-semibold text-body-secondary">Perte de paquets</div>
                          <div className="fs-4 fw-semibold">{bandwidthStats.packetLoss}%</div>
                        </div>
                        <CIcon icon={cilChart} size="xl" className="text-danger" />
                      </div>
                      <CProgress className="mt-3" height={4} value={bandwidthStats.packetLoss} color="danger" />
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
                          {trafficData.map((item, index) => (
                            <CTableRow key={index}>
                              <CTableDataCell>{item.protocol}</CTableDataCell>
                              <CTableDataCell>{item.port}</CTableDataCell>
                              <CTableDataCell>{item.traffic}</CTableDataCell>
                              <CTableDataCell>
                                <CProgress
                                  thin
                                  color={index === 0 ? 'primary' : index === 1 ? 'success' : 'info'}
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
                          {deviceStats.map((device, index) => (
                            <CTableRow key={index}>
                              <CTableDataCell>{device.name}</CTableDataCell>
                              <CTableDataCell>{device.traffic}</CTableDataCell>
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