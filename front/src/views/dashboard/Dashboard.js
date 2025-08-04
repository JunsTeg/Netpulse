import React, { useEffect, useState } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CProgress,
  CBadge,
  CListGroup,
  CListGroupItem,
  CSpinner,
  CAlert,
  CButton,
} from '@coreui/react'
import { Line, Bar } from 'react-chartjs-2'
import 'chart.js/auto'
import { cilWarning, cilSpeedometer, cilMemory, cilDevices, cilBell, cilUser, cilSettings } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import dashboardService from '../../services/dashboardService'

// Ajout d'un utilitaire pour récupérer les couleurs dynamiques
const getCssVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();

const StatCard = ({ title, value, icon, subtitle, loading = false }) => (
  <CCard className="h-100">
    <CCardBody className="d-flex flex-column justify-content-center align-items-center text-center p-4">
      <div className="d-flex align-items-center mb-3">
        <CIcon icon={icon} size="xl" style={{ color: getCssVar('--color-primary'), marginRight: '0.75rem' }} />
        <span className="fw-semibold">{title}</span>
      </div>
      <div className="mb-2">
        {loading ? (
          <CSpinner size="sm" />
        ) : (
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: getCssVar('--color-primary') }}>
            {value}
          </div>
        )}
      </div>
      {subtitle && (
        <div style={{ fontSize: '0.9rem', color: getCssVar('--color-text-secondary-light') }}>
          {subtitle}
        </div>
      )}
    </CCardBody>
  </CCard>
);

const Dashboard = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Fonction pour charger les données du dashboard
  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const dashboardData = await dashboardService.getDashboardData()
      setData(dashboardData)
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Erreur chargement dashboard:', err)
      setError('Erreur lors du chargement des données: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour lancer un scan réseau
  const handleNetworkScan = async () => {
    try {
      setLoading(true)
      
      // Enregistrer l'activité
      await dashboardService.logActivity({
        user: 'admin',
        action: 'Lancé un scan réseau manuel',
        type: 'scan',
        details: 'Scan complet du réseau déclenché manuellement'
      })
      
      await dashboardService.triggerNetworkScan('comprehensive')
      // Recharger les données après le scan
      await loadDashboardData()
    } catch (err) {
      setError('Erreur lors du scan réseau: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour générer un rapport
  const handleGenerateReport = async () => {
    try {
      setLoading(true)
      
      // Enregistrer l'activité
      await dashboardService.logActivity({
        user: 'admin',
        action: 'Généré un rapport dashboard',
        type: 'report',
        details: 'Rapport de synthèse du dashboard généré'
      })
      
      await dashboardService.generateReport('dashboard')
      // Optionnel: afficher un message de succès
    } catch (err) {
      setError('Erreur lors de la génération du rapport: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Chargement initial uniquement
  useEffect(() => {
    loadDashboardData()
  }, [])

  // Affichage du loading initial
  if (loading && !data) {
    return (
      <div className="p-4 d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="text-center">
          <CSpinner size="lg" />
          <div className="mt-3">Chargement du dashboard...</div>
        </div>
      </div>
    )
  }

  // Affichage de l'erreur
  if (error) {
    return (
      <div className="p-4">
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          <strong>Erreur:</strong> {error}
        </CAlert>
        <div className="text-center mt-3">
          <CButton color="primary" onClick={loadDashboardData}>
            Réessayer
          </CButton>
        </div>
      </div>
    )
  }

  // Données par défaut si pas de données
  const dashboardData = data || {
    devicesActive: 0,
    devicesInactive: 0,
    alertsActive: 0,
    incidentsCritical: 0,
    anomalies: [],
    topDevices: [],
    agentStatus: [],
    activityLog: [],
    latencyData: [100, 120, 90, 140, 80, 200, 130],
    latencyLabels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
  }

  return (
    <div className="p-4">
      {/* Header */}
      <CCard className="mb-4">
        <CCardBody className="text-center py-4">
          <div>
            <h1 className="display-4 fw-bold text-primary mb-0">
              🚀 CENTRE DE CONTRÔLE NETPULSE
            </h1>
            {lastUpdate && (
              <small className="text-muted">
                Dernière mise à jour: {lastUpdate.toLocaleTimeString('fr-FR')}
              </small>
            )}
          </div>
        </CCardBody>
      </CCard>

      {/* Stats Cards */}
      <CRow className="mb-4 g-3">
        <CCol xs={12} sm={6} lg={3}>
          <StatCard 
            title="Alertes Actives" 
            value={dashboardData.alertsActive} 
            icon={cilBell}
            subtitle="Surveillance en temps réel"
            loading={loading}
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <StatCard 
            title="Appareils Connectés" 
            value={`${dashboardData.devicesActive}`} 
            icon={cilDevices}
            subtitle="Réseau opérationnel"
            loading={loading}
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <StatCard 
            title="Incidents Critiques" 
            value={dashboardData.incidentsCritical} 
            icon={cilWarning}
            subtitle="Action requise"
            loading={loading}
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <StatCard 
            title="Avertissements" 
            value={dashboardData.alertsActive - dashboardData.incidentsCritical} 
            icon={cilSpeedometer}
            subtitle="Surveillance renforcée"
            loading={loading}
          />
        </CCol>
      </CRow>

      {/* Charts Row */}
      <CRow className="mb-4 g-3">
        <CCol xs={12} lg={6}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent">
              <h5 className="card-title mb-0">📡 Analyse de Latence - 7 Jours</h5>
            </CCardHeader>
            <CCardBody className="d-flex align-items-center justify-content-center" style={{ height: '300px' }}>
              <Line
                data={{
                  labels: dashboardData.latencyLabels,
                  datasets: [
                    {
                      label: 'Latence (ms)',
                      data: dashboardData.latencyData,
                      borderColor: getCssVar('--color-primary'),
                      backgroundColor: 'rgba(74, 158, 255, 0.1)',
                      fill: true,
                      tension: 0.3,
                      borderWidth: 3,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      labels: {
                        color: getCssVar('--color-secondary')
                      }
                    }
                  },
                  scales: {
                    y: {
                      ticks: {
                        color: getCssVar('--color-secondary')
                      },
                      grid: {
                        color: 'rgba(168, 199, 232, 0.1)'
                      }
                    },
                    x: {
                      ticks: {
                        color: getCssVar('--color-secondary')
                      },
                      grid: {
                        color: 'rgba(168, 199, 232, 0.1)'
                      }
                    }
                  }
                }}
              />
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xs={12} lg={6}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent">
              <h5 className="card-title mb-0">⚡ Utilisation CPU - Machines Prioritaires</h5>
            </CCardHeader>
            <CCardBody className="d-flex align-items-center justify-content-center" style={{ height: '300px' }}>
              {dashboardData.topDevices.length > 0 ? (
                <Bar
                  data={{
                    labels: dashboardData.topDevices.map((d) => d.host),
                    datasets: [
                      {
                        label: 'Utilisation CPU (%)',
                        data: dashboardData.topDevices.map((d) => d.cpu),
                        backgroundColor: [getCssVar('--color-primary'), getCssVar('--color-secondary'), getCssVar('--color-tertiary')],
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: getCssVar('--color-primary'),
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        labels: {
                          color: getCssVar('--color-secondary')
                        }
                      }
                    },
                    scales: {
                      y: {
                        ticks: {
                          color: getCssVar('--color-secondary')
                        },
                        grid: {
                          color: 'rgba(168, 199, 232, 0.1)'
                        }
                      },
                      x: {
                        ticks: {
                          color: getCssVar('--color-secondary')
                        },
                        grid: {
                          color: 'rgba(168, 199, 232, 0.1)'
                        }
                      }
                    }
                  }}
                />
              ) : (
                <div className="text-center text-muted">
                  <CIcon icon={cilDevices} size="xl" className="mb-3" />
                  <p>Aucune machine à risque détectée</p>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Tables Row */}
      <CRow className="mb-4 g-3">
        <CCol xs={12} lg={6}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent">
              <h5 className="card-title mb-0">🚨 Détection d'Anomalies</h5>
            </CCardHeader>
            <CCardBody className="p-0">
              {dashboardData.anomalies.length > 0 ? (
                <CTable hover responsive align="middle" className="mb-0">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell className="text-primary">Type</CTableHeaderCell>
                      <CTableHeaderCell className="text-primary">Appareil</CTableHeaderCell>
                      <CTableHeaderCell className="text-primary">Heure</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {dashboardData.anomalies.map((anomaly) => (
                      <CTableRow key={anomaly.id}>
                        <CTableDataCell>
                          <CBadge 
                            color={anomaly.severity === 'critical' ? 'danger' : 'warning'} 
                            style={{ 
                              background: anomaly.severity === 'critical' 
                                ? getCssVar('--color-danger') 
                                : getCssVar('--color-warning') 
                            }}
                          >
                            {anomaly.type}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{anomaly.device}</CTableDataCell>
                        <CTableDataCell>{anomaly.time}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              ) : (
                <div className="text-center py-4 text-muted">
                  <CIcon icon={cilWarning} size="xl" className="mb-3" />
                  <p>Aucune anomalie détectée</p>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xs={12} lg={6}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent">
              <h5 className="card-title mb-0">⚠️ Machines à Risque Élevé</h5>
            </CCardHeader>
            <CCardBody className="p-0">
              {dashboardData.topDevices.length > 0 ? (
                <CTable hover responsive align="middle" className="mb-0">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell className="text-primary">Nom</CTableHeaderCell>
                      <CTableHeaderCell className="text-primary">CPU</CTableHeaderCell>
                      <CTableHeaderCell className="text-primary">Latence</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {dashboardData.topDevices.map((device) => (
                      <CTableRow key={device.id}>
                        <CTableDataCell className="fw-semibold">{device.host}</CTableDataCell>
                        <CTableDataCell>
                          <div className="d-flex align-items-center">
                            <CProgress
                              className="flex-grow-1 me-2"
                              value={device.cpu}
                              color={device.cpu > 70 ? 'danger' : 'warning'}
                              style={{ 
                                background: 'rgba(26, 31, 58, 0.8)',
                                borderRadius: '8px'
                              }}
                            />
                            <span className="fw-semibold">{device.cpu}%</span>
                          </div>
                        </CTableDataCell>
                        <CTableDataCell>{device.latency} ms</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              ) : (
                <div className="text-center py-4 text-muted">
                  <CIcon icon={cilDevices} size="xl" className="mb-3" />
                  <p>Aucune machine à risque détectée</p>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Lists Row */}
      <CRow className="mb-4 g-3">
        <CCol xs={12} lg={6}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent">
              <h5 className="card-title mb-0">🤖 État des Agents de Surveillance</h5>
            </CCardHeader>
            <CCardBody className="p-0">
              <CListGroup flush className="border-0">
                {dashboardData.agentStatus.map((agent, index) => (
                  <CListGroupItem 
                    key={agent.id}
                    className={`border-0 ${index !== dashboardData.agentStatus.length - 1 ? 'border-bottom' : ''}`}
                    style={{ 
                      background: 'transparent',
                      borderColor: 'rgba(74, 158, 255, 0.2) !important',
                      padding: '1rem'
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold">{agent.name}</div>
                        <div className="text-muted small">
                          Dernière exécution: {agent.lastRun}
                        </div>
                      </div>
                      <CBadge 
                        color={agent.status === 'OK' ? 'success' : 'danger'}
                        style={{ 
                          background: agent.status === 'OK' ? getCssVar('--color-success') : getCssVar('--color-danger')
                        }}
                      >
                        {agent.status}
                      </CBadge>
                    </div>
                  </CListGroupItem>
                ))}
              </CListGroup>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xs={12} lg={6}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent">
              <h5 className="card-title mb-0">📋 Journal d'Activité</h5>
            </CCardHeader>
            <CCardBody className="p-0">
              <CListGroup flush className="border-0">
                {dashboardData.activityLog.map((log, index) => (
                  <CListGroupItem 
                    key={log.id}
                    className={`border-0 ${index !== dashboardData.activityLog.length - 1 ? 'border-bottom' : ''}`}
                    style={{ 
                      background: 'transparent',
                      borderColor: 'rgba(74, 158, 255, 0.2) !important',
                      padding: '1rem'
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold">{log.user}</div>
                        <div className="text-muted small">
                          {log.action}
                        </div>
                      </div>
                      <span className="text-muted small">
                        {log.time}
                      </span>
                    </div>
                  </CListGroupItem>
                ))}
              </CListGroup>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Action Buttons */}
      <CRow>
        <CCol xs={12}>
          <div className="text-center">
            <CButton 
              color="primary" 
              size="lg" 
              className="me-3"
              onClick={handleNetworkScan}
              disabled={loading}
            >
              🔍 Lancer Scan Réseau
            </CButton>
            <CButton 
              color="primary" 
              size="lg"
              onClick={handleGenerateReport}
              disabled={loading}
            >
              📊 Générer Rapport
            </CButton>
          </div>
        </CCol>
      </CRow>
    </div>
  )
}

export default Dashboard