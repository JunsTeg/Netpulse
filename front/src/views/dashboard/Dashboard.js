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
import { FuturisticCard, FuturisticButton } from '../../components/FuturisticEffects'

// Donnees simulees pour le dashboard
const fakeStats = {
  alerts: 3,
  critical: 1,
  warning: 2,
  devicesOnline: 18,
  devicesTotal: 20,
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
}

const FuturisticStatCard = ({ title, value, color, icon, subtitle }) => (
  <FuturisticCard
    title={
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <CIcon icon={icon} size="xl" style={{ color: '#4a9eff' }} />
        <span>{title}</span>
      </div>
    }
    style={{ height: '100%' }}
  >
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#4a9eff', marginBottom: '0.5rem' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ color: '#a8c7e8', fontSize: '0.9rem' }}>
          {subtitle}
        </div>
      )}
    </div>
  </FuturisticCard>
)

const Dashboard = () => {
  const [data, setData] = useState(fakeStats)

  useEffect(() => {
    // Socket.IO ou fetch pour donnees live
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <FuturisticCard
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <CIcon icon={cilBell} size="xl" style={{ color: '#4a9eff' }} />
            <span>🚀 CENTRE DE CONTRÔLE NETPULSE</span>
          </div>
        }
        style={{ height: '100%' }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#4a9eff', marginBottom: '0.5rem' }}>
            🚀 CENTRE DE CONTRÔLE NETPULSE
          </div>
        </div>
      </FuturisticCard>

      <CRow className="mb-4">
        <CCol xs={12} sm={6} lg={3}>
          <FuturisticStatCard 
            title="Alertes Actives" 
            value={data.alerts} 
            color="danger" 
            icon={cilBell}
            subtitle="Surveillance en temps réel"
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <FuturisticStatCard 
            title="Appareils Connectés" 
            value={`${data.devicesOnline}/${data.devicesTotal}`} 
            color="primary" 
            icon={cilDevices}
            subtitle="Réseau opérationnel"
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <FuturisticStatCard 
            title="Incidents Critiques" 
            value={data.critical} 
            color="warning" 
            icon={cilWarning}
            subtitle="Action requise"
          />
        </CCol>
        <CCol xs={12} sm={6} lg={3}>
          <FuturisticStatCard 
            title="Avertissements" 
            value={data.warning} 
            color="info" 
            icon={cilSpeedometer}
            subtitle="Surveillance renforcée"
          />
        </CCol>
      </CRow>

      <CRow className="mb-4">
        <CCol xs={12} lg={6}>
          <FuturisticCard title="📡 Analyse de Latence - 7 Jours">
            <div style={{ height: '300px' }}>
              <Line
                data={{
                  labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
                  datasets: [
                    {
                      label: 'Latence (ms)',
                      data: [100, 120, 90, 140, 80, 200, 130],
                      borderColor: '#4a9eff',
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
                        color: '#e8f4fd'
                      }
                    }
                  },
                  scales: {
                    y: {
                      ticks: {
                        color: '#a8c7e8'
                      },
                      grid: {
                        color: 'rgba(168, 199, 232, 0.1)'
                      }
                    },
                    x: {
                      ticks: {
                        color: '#a8c7e8'
                      },
                      grid: {
                        color: 'rgba(168, 199, 232, 0.1)'
                      }
                    }
                  }
                }}
              />
            </div>
          </FuturisticCard>
        </CCol>

        <CCol xs={12} lg={6}>
          <FuturisticCard title="⚡ Utilisation CPU - Machines Prioritaires">
            <div style={{ height: '300px' }}>
              <Bar
                data={{
                  labels: data.topDevices.map((d) => d.host),
                  datasets: [
                    {
                      label: 'Utilisation CPU (%)',
                      data: data.topDevices.map((d) => d.cpu),
                      backgroundColor: ['#4a9eff', '#00d4aa', '#ffb74a'],
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: '#4a9eff',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      labels: {
                        color: '#e8f4fd'
                      }
                    }
                  },
                  scales: {
                    y: {
                      ticks: {
                        color: '#a8c7e8'
                      },
                      grid: {
                        color: 'rgba(168, 199, 232, 0.1)'
                      }
                    },
                    x: {
                      ticks: {
                        color: '#a8c7e8'
                      },
                      grid: {
                        color: 'rgba(168, 199, 232, 0.1)'
                      }
                    }
                  }
                }}
              />
            </div>
          </FuturisticCard>
        </CCol>
      </CRow>

      <CRow className="mb-4">
        <CCol xs={12} lg={6}>
          <FuturisticCard title="🚨 Détection d'Anomalies">
            <CTable hover responsive align="middle" style={{ color: '#e8f4fd' }}>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ color: '#4a9eff' }}>Type</CTableHeaderCell>
                  <CTableHeaderCell style={{ color: '#4a9eff' }}>Appareil</CTableHeaderCell>
                  <CTableHeaderCell style={{ color: '#4a9eff' }}>Heure</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {data.anomalies.map((anomaly) => (
                  <CTableRow key={anomaly.id}>
                    <CTableDataCell>
                      <CBadge color="danger" style={{ background: '#ff6b6b' }}>
                        {anomaly.type}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{anomaly.device}</CTableDataCell>
                    <CTableDataCell>{anomaly.time}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </FuturisticCard>
        </CCol>

        <CCol xs={12} lg={6}>
          <FuturisticCard title="⚠️ Machines à Risque Élevé">
            <CTable hover responsive align="middle" style={{ color: '#e8f4fd' }}>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ color: '#4a9eff' }}>Nom</CTableHeaderCell>
                  <CTableHeaderCell style={{ color: '#4a9eff' }}>CPU</CTableHeaderCell>
                  <CTableHeaderCell style={{ color: '#4a9eff' }}>Latence</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {data.topDevices.map((device) => (
                  <CTableRow key={device.id}>
                    <CTableDataCell>{device.host}</CTableDataCell>
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
                        <span className="ms-2 fw-semibold">{device.cpu}%</span>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>{device.latency} ms</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </FuturisticCard>
        </CCol>
      </CRow>

      <CRow className="mb-4">
        <CCol xs={12} lg={6}>
          <FuturisticCard title="🤖 État des Agents de Surveillance">
            <CListGroup flush style={{ background: 'transparent' }}>
              {data.agentStatus.map((agent) => (
                <CListGroupItem 
                  key={agent.id}
                  style={{ 
                    background: 'transparent',
                    border: '1px solid rgba(74, 158, 255, 0.2)',
                    marginBottom: '0.5rem',
                    borderRadius: '8px',
                    color: '#e8f4fd'
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{agent.name}</strong>
                      <div style={{ fontSize: '0.9rem', color: '#a8c7e8' }}>
                        Dernière exécution: {agent.lastRun}
                      </div>
                    </div>
                    <CBadge 
                      color={agent.status === 'OK' ? 'success' : 'danger'}
                      style={{ 
                        background: agent.status === 'OK' ? '#00d4aa' : '#ff6b6b'
                      }}
                    >
                      {agent.status}
                    </CBadge>
                  </div>
                </CListGroupItem>
              ))}
            </CListGroup>
          </FuturisticCard>
        </CCol>

        <CCol xs={12} lg={6}>
          <FuturisticCard title="📋 Journal d'Activité">
            <CListGroup flush style={{ background: 'transparent' }}>
              {data.activityLog.map((log) => (
                <CListGroupItem 
                  key={log.id}
                  style={{ 
                    background: 'transparent',
                    border: '1px solid rgba(74, 158, 255, 0.2)',
                    marginBottom: '0.5rem',
                    borderRadius: '8px',
                    color: '#e8f4fd'
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{log.user}</strong>
                      <div style={{ fontSize: '0.9rem', color: '#a8c7e8' }}>
                        {log.action}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.9rem', color: '#a8c7e8' }}>
                      {log.time}
                    </span>
                  </div>
                </CListGroupItem>
              ))}
            </CListGroup>
          </FuturisticCard>
        </CCol>
      </CRow>

      <CRow>
        <CCol xs={12}>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <FuturisticButton 
              variant="primary"
              onClick={() => console.log('Scan réseau lancé')}
              style={{ marginRight: '1rem' }}
            >
              🔍 Lancer Scan Réseau
            </FuturisticButton>
            <FuturisticButton 
              variant="primary"
              onClick={() => console.log('Rapport généré')}
            >
              📊 Générer Rapport
            </FuturisticButton>
          </div>
        </CCol>
      </CRow>
    </div>
  )
}

export default Dashboard
