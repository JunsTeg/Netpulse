import React, { useState, useEffect } from 'react'
import axios from 'axios'
import authService from '../../services/auth.service'
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
  CFormCheck,
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
import { API_CONFIG } from '../../config/api.config'

// Configuration de l'URL de base de l'API
axios.defaults.baseURL = API_CONFIG.BASE_URL

const Devices = () => {
  // Etats
  const [visible, setVisible] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [devices, setDevices] = useState([])
  const [formData, setFormData] = useState({
    hostname: '',
    ipAddress: '',
    macAddress: '',
    os: '',
    deviceType: '',
  })

  // Initialisation du token d'authentification
  useEffect(() => {
    const token = authService.getToken()
    console.log('Token d\'authentification:', token ? 'Présent' : 'Manquant')
    if (token) {
      authService.setAuthHeader(token)
      console.log('Headers axios configurés:', axios.defaults.headers.common)
    } else {
      console.log('Redirection vers la page de connexion...')
      window.location.href = '/login'
    }
  }, [])

  // Fonction pour filtrer les appareils avec vérification de sécurité
  const filteredDevices = Array.isArray(devices) ? devices.filter((device) =>
    device && Object.values(device).some((value) =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  ) : []

  // Fonction pour obtenir le statut de l'appareil
  const getDeviceStatus = (lastSeen) => {
    const lastSeenDate = new Date(lastSeen)
    const now = new Date()
    const diffMinutes = (now - lastSeenDate) / (1000 * 60)

    if (diffMinutes < 5) return { status: 'actif', icon: cilCheckCircle, color: 'success' }
    if (diffMinutes < 30) return { status: 'attention', icon: cilWarning, color: 'warning' }
    return { status: 'inactif', icon: cilXCircle, color: 'danger' }
  }

  // Fonction pour charger les appareils depuis l'API
  const fetchDevices = async () => {
    try {
      setLoading(true)
      const token = authService.getToken()
      
      // Verification du token
      if (!token) {
        console.log('Token manquant, redirection vers la page de connexion...')
        window.location.href = '/login'
        return
      }

      // Configuration du header d'authentification
      authService.setAuthHeader(token)

      console.log('Environnement:', API_CONFIG.ENV)
      console.log('URL de l\'API:', API_CONFIG.BASE_URL)
      console.log('Tentative de recuperation des appareils avec le token:', token ? 'Present' : 'Manquant')

      const response = await axios.get(API_CONFIG.ROUTES.NETWORK.DEVICES)
      console.log('Reponse du serveur:', response.data)
      
      setDevices(response.data)
      setError(null)
    } catch (err) {
      console.error('Erreur detaillee:', err)
      if (err.response?.status === 401) {
        authService.logout()
        window.location.href = '/login'
      } else {
        setError('Erreur lors du chargement des appareils: ' + (err.response?.data?.message || err.message))
      }
    } finally {
      setLoading(false)
    }
  }

  // Charger les appareils au montage et verifier l'authentification
  useEffect(() => {
    const token = authService.getToken()
    if (!token) {
      console.log('Pas de token trouve, redirection vers la page de connexion')
      window.location.href = '/login'
      return
    }
    
    // Configuration du header d'authentification
    authService.setAuthHeader(token)
    console.log('Token configure, headers:', axios.defaults.headers.common)
    
    // Chargement uniquement de la liste des appareils
    fetchDevices()
  }, [])

  // Gestion du formulaire
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Fonction pour ajouter/modifier un appareil
  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const token = authService.getToken()
      if (!token) {
        throw new Error('Non authentifié')
      }

      const headers = {
        'Authorization': `Bearer ${token}`
      }

      if (selectedDevice) {
        // Modification
        await axios.put(`/api/network/devices/${selectedDevice.id}`, formData, { headers })
      } else {
        // Ajout
        await axios.post('/api/network/devices', formData, { headers })
      }
      await fetchDevices() // Recharger la liste
      setVisible(false)
      setSelectedDevice(null)
      setFormData({
        hostname: '',
        ipAddress: '',
        macAddress: '',
        os: '',
        deviceType: '',
      })
    } catch (err) {
      setError('Erreur lors de l\'enregistrement: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour supprimer un appareil
  const handleDelete = async (deviceId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet appareil ?')) {
      try {
        setLoading(true)
        const token = authService.getToken()
        if (!token) {
          throw new Error('Non authentifié')
        }

        await axios.delete(`/api/network/devices/${deviceId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        await fetchDevices() // Recharger la liste
      } catch (err) {
        setError('Erreur lors de la suppression: ' + (err.response?.data?.message || err.message))
      } finally {
        setLoading(false)
      }
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

  // Fonction pour rafraîchir uniquement la liste des appareils
  const handleRefresh = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = authService.getToken()
      if (!token) {
        window.location.href = '/login'
        return
      }
      
      console.log('Recuperation de la liste des appareils...')
      await fetchDevices()
      console.log('Liste des appareils mise a jour')
    } catch (err) {
      console.error('Erreur lors du rafraichissement:', err)
      setError('Erreur lors du rafraichissement de la liste: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fonction de scan manuel uniquement via le bouton
  const handleScan = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = authService.getToken()
      if (!token) {
        window.location.href = '/login'
        return
      }

      // Detection automatique du reseau
      console.log('[FRONTEND] Demarrage de la detection du reseau...')
      const networkResponse = await axios.get(API_CONFIG.ROUTES.NETWORK.DETECT)
      console.log('[FRONTEND] Reponse detection reseau:', networkResponse.data)
      
      if (!networkResponse.data || !networkResponse.data.network) {
        throw new Error('Impossible de detecter le reseau automatiquement')
      }

      const { startIP, endIP } = networkResponse.data.network
      console.log('[FRONTEND] Reseau detecte:', { startIP, endIP })

      // Lancement du scan
      console.log('[FRONTEND] Demarrage du scan reseau avec la plage:', `${startIP}-${endIP}`)
      const scanResponse = await axios.post(API_CONFIG.ROUTES.NETWORK.SCAN, 
        { 
          target: `${startIP}-${endIP}`,
          quick: true
        },
        { 
          timeout: 300000,
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )
      console.log('[FRONTEND] Reponse du scan:', scanResponse.data)
      
      // Mise a jour de la liste apres le scan
      await fetchDevices()
      console.log('[FRONTEND] Liste des appareils mise a jour avec succes')
    } catch (err) {
      console.error('[FRONTEND] Erreur detaillee du scan:', err)
      if (err.code === 'ECONNABORTED') {
        setError('Le scan a pris trop de temps. Veuillez reessayer.')
      } else if (err.response) {
        console.error('[FRONTEND] Reponse d\'erreur du serveur:', err.response.data)
        setError(`Erreur lors du scan: ${err.response.data?.message || 'Erreur serveur'}`)
      } else if (err.request) {
        console.error('[FRONTEND] Pas de reponse du serveur:', err.request)
        setError('Le serveur ne repond pas. Verifiez que le backend est en cours d\'execution.')
      } else {
        console.error('[FRONTEND] Erreur inconnue:', err.message)
        setError('Erreur lors du scan: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
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
                className="me-2"
              >
                <CIcon icon={cilPlus} className="me-2" />
                Ajouter un appareil
              </CButton>
              <CButton 
                color="info" 
                onClick={handleScan}
                disabled={loading}
                className="me-2"
              >
                {loading ? (
                  <>
                    <CSpinner size="sm" className="me-2" />
                    Scan en cours (peut prendre jusqu'a 5 minutes)...
                  </>
                ) : (
                  <>
                    <CIcon icon={cilSearch} className="me-2" />
                    Scanner le reseau
                  </>
                )}
              </CButton>
              <CButton 
                color="secondary" 
                onClick={handleRefresh}
                disabled={loading}
              >
                {loading ? (
                  <CSpinner size="sm" className="me-2" />
                ) : (
                  <CIcon icon={cilReload} className="me-2" />
                )}
                Rafraichir
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