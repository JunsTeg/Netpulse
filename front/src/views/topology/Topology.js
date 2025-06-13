import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CButtonGroup,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CFormInput,
  CProgress,
  CTooltip,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilZoomIn,
  cilZoomOut,
  cilReload,
  cilFilter,
  cilFullscreen,
  cilDevices,
  cilRouter,
  cilChartPie,
} from '@coreui/icons'

const Topology = () => {
  const [zoom, setZoom] = useState(100)
  const [selectedView, setSelectedView] = useState('physical')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  // Simuler le chargement des donnees
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Donnees de test pour la topologie
  const networkData = {
    nodes: [
      { id: 1, type: 'router', name: 'Router-Core', x: 50, y: 50, status: 'active' },
      { id: 2, type: 'switch', name: 'Switch-Acces-01', x: 150, y: 100, status: 'active' },
      { id: 3, type: 'switch', name: 'Switch-Acces-02', x: 150, y: 200, status: 'warning' },
      { id: 4, type: 'ap', name: 'AP-Wifi-01', x: 250, y: 150, status: 'active' },
      { id: 5, type: 'server', name: 'Server-01', x: 50, y: 150, status: 'active' },
    ],
    links: [
      { source: 1, target: 2, type: 'gigabit' },
      { source: 1, target: 3, type: 'gigabit' },
      { source: 2, target: 4, type: 'wifi' },
      { source: 1, target: 5, type: 'gigabit' },
    ],
  }

  // Fonction pour obtenir l'icone selon le type d'appareil
  const getDeviceIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'server':
        return cilDevices
      case 'router':
        return cilDevices
      case 'switch':
        return cilChartPie
      case 'ap':
        return cilChartPie
      default:
        return cilDevices
    }
  }

  // Fonction pour obtenir la couleur selon le statut
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'warning':
        return 'warning'
      case 'inactive':
        return 'danger'
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
              <h4 className="mb-0">Topologie du Reseau</h4>
            </CCol>
            <CCol xs="auto" className="ms-auto">
              <CButtonGroup>
                <CButton color="primary" variant="outline" onClick={() => setZoom(Math.min(zoom + 10, 200))}>
                  <CIcon icon={cilZoomIn} />
                </CButton>
                <CButton color="primary" variant="outline" onClick={() => setZoom(Math.max(zoom - 10, 50))}>
                  <CIcon icon={cilZoomOut} />
                </CButton>
                <CButton color="primary" variant="outline">
                  <CIcon icon={cilReload} />
                </CButton>
                <CButton color="primary" variant="outline">
                  <CIcon icon={cilFullscreen} />
                </CButton>
              </CButtonGroup>
            </CCol>
          </CRow>
        </CCardHeader>
        <CCardBody>
          <CRow className="mb-3">
            <CCol md={4}>
              <CFormSelect
                value={selectedView}
                onChange={(e) => setSelectedView(e.target.value)}
                options={[
                  { label: 'Vue Physique', value: 'physical' },
                  { label: 'Vue Logique', value: 'logical' },
                  { label: 'Vue par VLAN', value: 'vlan' },
                ]}
              />
            </CCol>
            <CCol md={8}>
              <CInputGroup>
                <CInputGroupText>
                  <CIcon icon={cilFilter} />
                </CInputGroupText>
                <CFormInput
                  placeholder="Rechercher un appareil..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </CInputGroup>
            </CCol>
          </CRow>

          {loading ? (
            <div className="text-center py-5">
              <CProgress animated value={100} className="mb-3" />
              <p>Chargement de la topologie...</p>
            </div>
          ) : (
            <div
              style={{
                height: '600px',
                border: '1px solid #d8dbe0',
                borderRadius: '4px',
                position: 'relative',
                overflow: 'hidden',
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
              }}
            >
              {/* Simulation de la visualisation du reseau */}
              <svg width="100%" height="100%">
                {/* Lignes de connexion */}
                {networkData.links.map((link, index) => (
                  <line
                    key={index}
                    x1={networkData.nodes[link.source - 1].x}
                    y1={networkData.nodes[link.source - 1].y}
                    x2={networkData.nodes[link.target - 1].x}
                    y2={networkData.nodes[link.target - 1].y}
                    stroke="#6c757d"
                    strokeWidth="2"
                  />
                ))}
                {/* Noeuds */}
                {networkData.nodes.map((node) => (
                  <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                    <circle
                      r="20"
                      fill={getStatusColor(node.status)}
                      stroke="#fff"
                      strokeWidth="2"
                    />
                    <CTooltip content={`${node.name} (${node.status})`}>
                      <CIcon
                        icon={getDeviceIcon(node.type)}
                        size="xl"
                        className="text-white"
                        style={{ position: 'absolute', top: '-10px', left: '-10px' }}
                      />
                    </CTooltip>
                  </g>
                ))}
              </svg>
            </div>
          )}

          {/* Legende */}
          <div className="mt-3">
            <h6>Legende :</h6>
            <CRow>
              <CCol xs="auto" className="me-3">
                <CIcon icon={cilRouter} className="me-1" /> Router
              </CCol>
              <CCol xs="auto" className="me-3">
                <CIcon icon={cilChartPie} className="me-1" /> Switch
              </CCol>
              <CCol xs="auto" className="me-3">
                <CIcon icon={cilDevices} className="me-1" /> Serveur
              </CCol>
              <CCol xs="auto" className="me-3">
                <span className="badge bg-success me-1">●</span> Actif
              </CCol>
              <CCol xs="auto" className="me-3">
                <span className="badge bg-warning me-1">●</span> Avertissement
              </CCol>
              <CCol xs="auto">
                <span className="badge bg-danger me-1">●</span> Inactif
              </CCol>
            </CRow>
          </div>
        </CCardBody>
      </CCard>
    </>
  )
}

export default Topology 