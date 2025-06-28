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
} from '@coreui/react'
import { Line, Bar } from 'react-chartjs-2'
import 'chart.js/auto'
import { cilWarning, cilSpeedometer, cilMemory, cilDevices, cilBell, cilUser, cilSettings } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

// Donnees simulees pour le dashboard
// TODO: Remplacer par les vraies données du backend
const fakeStats = {
  // Données disponibles via /network/dashboard/summary
  devicesActive: 18,
  devicesInactive: 2,
  alertsActive: 3,
  incidentsCritical: 1,
  totalDownload: 1024,
  totalUpload: 512,
  evolution24h: [
    { hour: 0, download: 100, upload: 50 },
    { hour: 1, download: 120, upload: 60 },
    // ... autres heures
  ],

  // Données manquantes dans le backend - à implémenter
  anomalies: [
    { id: '1', type: 'Port Scan', device: '192.168.1.10', time: '10:15' },
    { id: '2', type: 'High Latency', device: '192.168.1.24', time: '10:12' },
  ],
  topDevices: [
    { id: '1', host: 'Switch-01', cpu: 88, latency: 270 },
    { id: '2', host: 'Server-DB', cpu: 91, latency: 180 },
  ],
  agentStatus: [
    { id: 'a1', name: 'Agent Nmap', status: 'OK', lastRun: '10:10' },
    { id: 'a2', name: 'Agent Stats', status: 'KO', lastRun: '09:48' },
    { id: 'a3', name: 'Agent Ping', status: 'OK', lastRun: '10:05' },
  ],
  activityLog: [
    { id: 'log1', user: 'admin', action: 'Modifié seuil de latence', time: '10:01' },
    { id: 'log2', user: 'monitor', action: 'Lancé un scan manuel', time: '09:55' },
  ],
  // Données pour graphique de latence (manquantes)
  latencyData: [100, 120, 90, 140, 80, 200, 130],
  latencyLabels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
}

// Ajout d'un utilitaire pour récupérer les couleurs dynamiques
const getCssVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();

const StatCard = ({ title, value, icon, subtitle }) => (
  <CCard className="h-100">
    <CCardBody className="d-flex flex-column justify-content-center align-items-center text-center p-4">
      <div className="d-flex align-items-center mb-3">
        <CIcon icon={icon} size="xl" style={{ color: getCssVar('--color-primary'), marginRight: '0.75rem' }} />
        <span className="fw-semibold">{title}</span>
      </div>
      <div className="mb-2">
        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: getCssVar('--color-primary') }}>
          {value}
        </div>
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
  const [data, setData] = useState(fakeStats)

  useEffect(() => {
    // Socket.IO ou fetch pour donnees live
  }, [])

  return (
    <div className="p-4">
      {/* Header */}
      <CCard className="mb-4">
        <CCardBody className="text-center py-4">
          <h1 className="display-4 fw-bold text-primary mb-0">
            🚀 CENTRE DE CONTRÔLE NETPULSE
          </h1>
        </CCardBody>
      </CCard>

      {/* Stats Cards */}
      <CRow className="mb-4 g-3">
        <CCol xs={12} sm={6} lg={3}>
          <StatCard 
            title="Alertes Actives" 
            value={data.alertsActive} 
            icon={cilBell}
            subtitle="Surveillance en temps réel"
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <StatCard 
            title="Appareils Connectés" 
            value={`${data.devicesActive}/${data.devicesActive + data.devicesInactive}`} 
            icon={cilDevices}
            subtitle="Réseau opérationnel"
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <StatCard 
            title="Incidents Critiques" 
            value={data.incidentsCritical} 
            icon={cilWarning}
            subtitle="Action requise"
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <StatCard 
            title="Avertissements" 
            value={data.alertsActive - data.incidentsCritical} 
            icon={cilSpeedometer}
            subtitle="Surveillance renforcée"
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
                  labels: data.latencyLabels,
                  datasets: [
                    {
                      label: 'Latence (ms)',
                      data: data.latencyData,
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
              <Bar
                data={{
                  labels: data.topDevices.map((d) => d.host),
                  datasets: [
                    {
                      label: 'Utilisation CPU (%)',
                      data: data.topDevices.map((d) => d.cpu),
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
              <CTable hover responsive align="middle" className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell className="text-primary">Type</CTableHeaderCell>
                    <CTableHeaderCell className="text-primary">Appareil</CTableHeaderCell>
                    <CTableHeaderCell className="text-primary">Heure</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {data.anomalies.map((anomaly) => (
                    <CTableRow key={anomaly.id}>
                      <CTableDataCell>
                        <CBadge color="danger" style={{ background: getCssVar('--color-danger') }}>
                          {anomaly.type}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{anomaly.device}</CTableDataCell>
                      <CTableDataCell>{anomaly.time}</CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xs={12} lg={6}>
          <CCard className="h-100">
            <CCardHeader className="bg-transparent">
              <h5 className="card-title mb-0">⚠️ Machines à Risque Élevé</h5>
            </CCardHeader>
            <CCardBody className="p-0">
              <CTable hover responsive align="middle" className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell className="text-primary">Nom</CTableHeaderCell>
                    <CTableHeaderCell className="text-primary">CPU</CTableHeaderCell>
                    <CTableHeaderCell className="text-primary">Latence</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {data.topDevices.map((device) => (
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
                {data.agentStatus.map((agent, index) => (
                  <CListGroupItem 
                    key={agent.id}
                    className={`border-0 ${index !== data.agentStatus.length - 1 ? 'border-bottom' : ''}`}
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
                {data.activityLog.map((log, index) => (
                  <CListGroupItem 
                    key={log.id}
                    className={`border-0 ${index !== data.activityLog.length - 1 ? 'border-bottom' : ''}`}
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
            <button className="btn btn-primary btn-lg me-3" 
              onClick={() => console.log('Scan réseau lancé')}
            >
              🔍 Lancer Scan Réseau
            </button>
            <button className="btn btn-primary btn-lg" 
              onClick={() => console.log('Rapport généré')}
            >
              📊 Générer Rapport
            </button>
          </div>
        </CCol>
      </CRow>
    </div>
  )
}

export default Dashboard