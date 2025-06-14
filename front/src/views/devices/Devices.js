import React, { useState, useEffect } from 'react'
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
  CButton,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormLabel,
  CFormSelect,
  CBadge,
  CTooltip,
  CSpinner,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { 
  cilPlus, 
  cilSearch, 
  cilTrash, 
  cilPencil, 
  cilReload, 
  cilInfo,
  cilWarning,
  cilCheckCircle,
  cilXCircle,
} from '@coreui/icons'
import { v4 as uuidv4 } from 'uuid'

const Devices = () => {
  // Etats
  const [visible, setVisible] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [formData, setFormData] = useState({
    hostname: '',
    ipAddress: '',
    macAddress: '',
    os: '',
    deviceType: '',
  })

  // Donnees de test (a remplacer par l'API)
  const [devices, setDevices] = useState([
    {
      id: uuidv4(),
      hostname: 'Router-Core-01',
      deviceType: 'Router',
      ipAddress: '192.168.1.1',
      macAddress: '00:1A:2B:3C:4D:5E',
      os: 'Cisco IOS',
      stats: { cpu: 45, memory: 60, uptime: '15d 6h' },
      lastSeen: '2024-03-20 14:30:00',
      firstDiscovered: '2024-01-01 00:00:00',
    },
    {
      id: uuidv4(),
      hostname: 'Switch-Acces-01',
      deviceType: 'Switch',
      ipAddress: '192.168.1.2',
      macAddress: '00:1A:2B:3C:4D:5F',
      os: 'Cisco IOS',
      stats: { cpu: 30, memory: 45, uptime: '10d 3h' },
      lastSeen: '2024-03-20 14:25:00',
      firstDiscovered: '2024-01-01 00:00:00',
    },
    {
      id: uuidv4(),
      hostname: 'AP-Wifi-01',
      deviceType: 'Access Point',
      ipAddress: '192.168.1.3',
      macAddress: '00:1A:2B:3C:4D:60',
      os: 'Linux',
      stats: { cpu: 25, memory: 40, uptime: '5d 12h' },
      lastSeen: '2024-03-20 13:45:00',
      firstDiscovered: '2024-01-01 00:00:00',
    },
  ])

  // Fonction pour filtrer les appareils
  const filteredDevices = devices.filter((device) =>
    Object.values(device).some((value) =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  )

  // Fonction pour obtenir le statut de l'appareil
  const getDeviceStatus = (lastSeen) => {
    const lastSeenDate = new Date(lastSeen)
    const now = new Date()
    const diffMinutes = (now - lastSeenDate) / (1000 * 60)

    if (diffMinutes < 5) return { status: 'actif', icon: cilCheckCircle, color: 'success' }
    if (diffMinutes < 30) return { status: 'attention', icon: cilWarning, color: 'warning' }
    return { status: 'inactif', icon: cilXCircle, color: 'danger' }
  }

  // Gestion du formulaire
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // TODO: Implémenter l'appel API
    const newDevice = {
      id: selectedDevice?.id || uuidv4(),
      ...formData,
      stats: selectedDevice?.stats || {},
      lastSeen: new Date().toISOString(),
      firstDiscovered: selectedDevice?.firstDiscovered || new Date().toISOString(),
    }

    if (selectedDevice) {
      setDevices(prev => prev.map(d => d.id === selectedDevice.id ? newDevice : d))
    } else {
      setDevices(prev => [...prev, newDevice])
    }

    setVisible(false)
    setSelectedDevice(null)
    setFormData({
      hostname: '',
      ipAddress: '',
      macAddress: '',
      os: '',
      deviceType: '',
    })
  }

  const handleDelete = (deviceId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet appareil ?')) {
      setDevices(prev => prev.filter(d => d.id !== deviceId))
    }
  }

  const handleEdit = (device) => {
    setSelectedDevice(device)
    setFormData({
      hostname: device.hostname,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress,
      os: device.os,
      deviceType: device.deviceType,
    })
    setVisible(true)
  }

  const handleRefresh = () => {
    setLoading(true)
    // TODO: Implémenter l'appel API pour rafraîchir les données
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }

  const resetForm = () => {
    setVisible(false)
    setSelectedDevice(null)
    setFormData({
      hostname: '',
      ipAddress: '',
      macAddress: '',
      os: '',
      deviceType: '',
    })
  }

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader>
          <CRow className="align-items-center">
            <CCol xs="auto">
              <h4 className="mb-0">Gestion des Appareils</h4>
            </CCol>
            <CCol xs="auto" className="ms-auto">
              <CButton 
                color="primary" 
                onClick={() => {
                  setSelectedDevice(null)
                  setVisible(true)
                }}
              >
                <CIcon icon={cilPlus} className="me-2" />
                Ajouter un appareil
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

          <CInputGroup className="mb-3">
            <CInputGroupText>
              <CIcon icon={cilSearch} />
            </CInputGroupText>
            <CFormInput
              placeholder="Rechercher un appareil..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <CButton 
              color="primary" 
              variant="ghost" 
              className="px-2"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} />}
            </CButton>
          </CInputGroup>

          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Hostname</CTableHeaderCell>
                <CTableHeaderCell>Type</CTableHeaderCell>
                <CTableHeaderCell>Adresse IP</CTableHeaderCell>
                <CTableHeaderCell>MAC</CTableHeaderCell>
                <CTableHeaderCell>Système</CTableHeaderCell>
                <CTableHeaderCell>Statut</CTableHeaderCell>
                <CTableHeaderCell>Dernière vue</CTableHeaderCell>
                <CTableHeaderCell>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredDevices.map((device) => {
                const status = getDeviceStatus(device.lastSeen)
                return (
                  <CTableRow key={device.id}>
                    <CTableDataCell>
                      <div className="d-flex align-items-center">
                        {device.hostname}
                        {device.stats && (
                          <CTooltip content={`CPU: ${device.stats.cpu}% | RAM: ${device.stats.memory}% | Uptime: ${device.stats.uptime}`}>
                            <CIcon icon={cilInfo} className="ms-2 text-info" />
                          </CTooltip>
                        )}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>{device.deviceType}</CTableDataCell>
                    <CTableDataCell>{device.ipAddress}</CTableDataCell>
                    <CTableDataCell>{device.macAddress}</CTableDataCell>
                    <CTableDataCell>{device.os}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={status.color}>
                        <CIcon icon={status.icon} className="me-1" />
                        {status.status}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{new Date(device.lastSeen).toLocaleString()}</CTableDataCell>
                    <CTableDataCell>
                      <CButton 
                        color="primary" 
                        variant="ghost" 
                        size="sm" 
                        className="me-2"
                        onClick={() => handleEdit(device)}
                      >
                        <CIcon icon={cilPencil} />
                      </CButton>
                      <CButton 
                        color="danger" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(device.id)}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      {/* Modal d'ajout/modification d'appareil */}
      <CModal 
        visible={visible} 
        onClose={resetForm}
        size="lg"
      >
        <CModalHeader>
          <CModalTitle>
            {selectedDevice ? 'Modifier un appareil' : 'Ajouter un appareil'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm onSubmit={handleSubmit}>
            <CRow>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>Hostname</CFormLabel>
                  <CFormInput
                    type="text"
                    name="hostname"
                    value={formData.hostname}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </CCol>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>Type d'appareil</CFormLabel>
                  <CFormSelect
                    name="deviceType"
                    value={formData.deviceType}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Sélectionnez un type</option>
                    <option value="Router">Router</option>
                    <option value="Switch">Switch</option>
                    <option value="Access Point">Access Point</option>
                    <option value="Firewall">Firewall</option>
                    <option value="Serveur">Serveur</option>
                  </CFormSelect>
                </div>
              </CCol>
            </CRow>
            <CRow>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>Adresse IP</CFormLabel>
                  <CFormInput
                    type="text"
                    name="ipAddress"
                    value={formData.ipAddress}
                    onChange={handleInputChange}
                    pattern="^(\d{1,3}\.){3}\d{1,3}$"
                    required
                  />
                </div>
              </CCol>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>Adresse MAC</CFormLabel>
                  <CFormInput
                    type="text"
                    name="macAddress"
                    value={formData.macAddress}
                    onChange={handleInputChange}
                    pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                    required
                  />
                </div>
              </CCol>
            </CRow>
            <div className="mb-3">
              <CFormLabel>Système d'exploitation</CFormLabel>
              <CFormInput
                type="text"
                name="os"
                value={formData.os}
                onChange={handleInputChange}
                required
              />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={resetForm}>
            Annuler
          </CButton>
          <CButton color="primary" onClick={handleSubmit}>
            {selectedDevice ? 'Modifier' : 'Ajouter'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Devices 