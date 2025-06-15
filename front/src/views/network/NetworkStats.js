import React, { useState, useEffect } from 'react'
import axios from 'axios'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [devices, setDevices] = useState([])
  const [interval, setInterval] = useState('1h')

  // Fonction pour charger la liste des appareils
  const fetchDevices = async () => {
    try {
      const response = await axios.get('/api/network/devices')
      setDevices(response.data)
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement des appareils: ' + err.message)
    }
  }

  // Charger la liste des appareils au montage
  useEffect(() => {
    fetchDevices()
  }, [])

  // Fonction pour charger les statistiques
  const fetchStats = async (deviceId) => {
    if (!deviceId) return
    try {
      setLoading(true)
      const response = await axios.get(`/api/network/devices/${deviceId}/stats`, {
        params: { interval }
      })
      setStats(response.data)
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement des statistiques: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Charger les statistiques quand l'appareil ou l'intervalle change
  useEffect(() => {
    if (selectedDevice) {
      fetchStats(selectedDevice)
    }
  }, [selectedDevice, interval])

  // Fonction pour rafraîchir les statistiques
  const handleRefresh = async () => {
    if (selectedDevice) {
      await fetchStats(selectedDevice)
    }
  }

  return (
    <CCard>
      <CCardHeader>
        <CRow className="align-items-center">
          <CCol xs="auto">
            <h4 className="mb-0">Statistiques Réseau</h4>
          </CCol>
          <CCol xs="auto" className="ms-auto">
            <CButton 
              color="primary" 
              variant="outline" 
              onClick={handleRefresh}
              disabled={loading || !selectedDevice}
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
                disabled={loading}
              >
                <option value="">Sélectionnez un appareil</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.hostname} ({device.deviceType})
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
                disabled={loading || !selectedDevice}
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
            <p>Sélectionnez un appareil pour voir ses statistiques</p>
          </div>
        ) : loading ? (
          <div className="text-center py-5">
            <CSpinner />
            <p className="mt-2">Chargement des statistiques...</p>
          </div>
        ) : stats ? (
          <CRow>
            <CCol md={6}>
              <div className="mb-4">
                <h6>Utilisation CPU</h6>
                <CProgress 
                  value={stats.cpuUsage} 
                  color={
                    stats.cpuUsage > 80 ? "danger" :
                    stats.cpuUsage > 60 ? "warning" :
                    "success"
                  }
                />
                <small className="text-muted">{stats.cpuUsage}%</small>
              </div>
            </CCol>
            <CCol md={6}>
              <div className="mb-4">
                <h6>Utilisation Mémoire</h6>
                <CProgress 
                  value={stats.memoryUsage} 
                  color={
                    stats.memoryUsage > 80 ? "danger" :
                    stats.memoryUsage > 60 ? "warning" :
                    "success"
                  }
                />
                <small className="text-muted">{stats.memoryUsage}%</small>
              </div>
            </CCol>
            <CCol md={6}>
              <div className="mb-4">
                <h6>Latence</h6>
                <div className="d-flex align-items-center">
                  <CIcon icon={cilSpeedometer} className="me-2" />
                  <span>{stats.latency} ms</span>
                </div>
              </div>
            </CCol>
            <CCol md={6}>
              <div className="mb-4">
                <h6>Perte de paquets</h6>
                <div className="d-flex align-items-center">
                  <CIcon icon={cilChart} className="me-2" />
                  <span>{stats.packetLoss}%</span>
                </div>
              </div>
            </CCol>
            <CCol md={6}>
              <div className="mb-4">
                <h6>Bande passante</h6>
                <div className="d-flex align-items-center">
                  <CIcon icon={cilCloudDownload} className="me-2" />
                  <span>{stats.bandwidth} Mbps</span>
                </div>
              </div>
            </CCol>
            <CCol md={6}>
              <div className="mb-4">
                <h6>Dernière mise à jour</h6>
                <div className="d-flex align-items-center">
                  <CIcon icon={cilReload} className="me-2" />
                  <span>{new Date(stats.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </CCol>
          </CRow>
        ) : (
          <div className="text-center py-5">
            <p>Aucune statistique disponible</p>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default NetworkStats 