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

const StatCard = ({ title, value, color, icon }) => (
  <CCard className={`mb-4 border-start border-${color} border-4 shadow-sm`}> 
    <CCardBody className="text-center">
      <CIcon icon={icon} size="xxl" className={`text-${color} mb-2`} />
      <h4 className="text-uppercase fw-bold text-muted small mb-1">{title}</h4>
      <div className={`fs-3 fw-bold text-${color}`}>{value}</div>
    </CCardBody>
  </CCard>
)

const Dashboard = () => {
  const [data, setData] = useState(fakeStats)

  useEffect(() => {
    // Socket.IO ou fetch pour donnees live
  }, [])

  return (
    <>
      <CCard className="mb-4 shadow-lg">
        <CCardHeader className="fw-bold fs-5">📡 Vue d'ensemble du réseau</CCardHeader>
        <CCardBody>
          <CRow>
            <CCol xs={12} sm={6} lg={3}>
              <StatCard title="Alertes" value={<><CBadge color="danger">{data.alerts}</CBadge></>} color="danger" icon={cilBell} />
            </CCol>
            <CCol xs={12} sm={6} lg={3}>
              <StatCard title="Appareils actifs" value={`${data.devicesOnline}/${data.devicesTotal}`} color="primary" icon={cilDevices} />
            </CCol>
            <CCol xs={12} sm={6} lg={3}>
              <StatCard title="Critiques" value={data.critical} color="warning" icon={cilWarning} />
            </CCol>
            <CCol xs={12} sm={6} lg={3}>
              <StatCard title="Warnings" value={data.warning} color="info" icon={cilSpeedometer} />
            </CCol>
          </CRow>

          <CRow className="mb-4">
            <CCol xs={12} lg={6}>
              <CCard>
                <CCardHeader>📈 Latence réseau (7 jours)</CCardHeader>
                <CCardBody>
                  <Line
                    data={{
                      labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
                      datasets: [
                        {
                          label: 'Latence (ms)',
                          data: [100, 120, 90, 140, 80, 200, 130],
                          borderColor: 'rgb(75, 192, 192)',
                          backgroundColor: 'rgba(75,192,192,0.1)',
                          fill: true,
                          tension: 0.3,
                        },
                      ],
                    }}
                  />
                </CCardBody>
              </CCard>
            </CCol>

            <CCol xs={12} lg={6}>
              <CCard>
                <CCardHeader>⚙️ CPU des machines les plus sollicitées</CCardHeader>
                <CCardBody>
                  <Bar
                    data={{
                      labels: data.topDevices.map((d) => d.host),
                      datasets: [
                        {
                          label: 'Utilisation CPU (%)',
                          data: data.topDevices.map((d) => d.cpu),
                          backgroundColor: ['#FF6384', '#FF9F40'],
                          borderRadius: 5,
                        },
                      ],
                    }}
                  />
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          <CRow className="mb-4">
            <CCol xs={12} lg={6}>
              <CCard>
                <CCardHeader>🚨 Anomalies récentes</CCardHeader>
                <CCardBody>
                  <CTable hover responsive align="middle">
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Type</CTableHeaderCell>
                        <CTableHeaderCell>Appareil</CTableHeaderCell>
                        <CTableHeaderCell>Heure</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {data.anomalies.map((anomaly) => (
                        <CTableRow key={anomaly.id}>
                          <CTableDataCell>{anomaly.type}</CTableDataCell>
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
              <CCard>
                <CCardHeader>⚠️ Machines à risque</CCardHeader>
                <CCardBody>
                  <CTable hover responsive align="middle">
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Nom</CTableHeaderCell>
                        <CTableHeaderCell>CPU</CTableHeaderCell>
                        <CTableHeaderCell>Latence</CTableHeaderCell>
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
                              />
                              <span className="ms-2 fw-semibold">{device.cpu}%</span>
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

          <CRow className="mb-4">
            <CCol xs={12} lg={6}>
              <CCard>
                <CCardHeader>⚙️ État des agents réseau</CCardHeader>
                <CCardBody>
                  <CListGroup flush>
                    {data.agentStatus.map((agent) => (
                      <CListGroupItem key={agent.id} className="d-flex justify-content-between align-items-center">
                        <span><CIcon icon={cilSettings} className="me-2" />{agent.name}</span>
                        <span>
                          <CBadge color={agent.status === 'OK' ? 'success' : 'danger'}>{agent.status}</CBadge>{' '}
                          <small className="text-muted">à {agent.lastRun}</small>
                        </span>
                      </CListGroupItem>
                    ))}
                  </CListGroup>
                </CCardBody>
              </CCard>
            </CCol>

            <CCol xs={12} lg={6}>
              <CCard>
                <CCardHeader>🕒 Dernières actions</CCardHeader>
                <CCardBody>
                  <CListGroup flush>
                    {data.activityLog.map((log) => (
                      <CListGroupItem key={log.id} className="d-flex justify-content-between align-items-center">
                        <span><CIcon icon={cilUser} className="me-2" />{log.user} : {log.action}</span>
                        <small className="text-muted">{log.time}</small>
                      </CListGroupItem>
                    ))}
                  </CListGroup>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

        </CCardBody>
      </CCard>
    </>
  )
}

export default Dashboard;
