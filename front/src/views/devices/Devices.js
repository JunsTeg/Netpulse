import React, { useState, useEffect, useRef } from 'react'
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
  CProgress,
  CProgressBar,
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
import { io } from "socket.io-client"

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
  const [scanProgress, setScanProgress] = useState(null)
  const [socket, setSocket] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const confettiRef = useRef(null)

  // Initialisation du token d'authentification
  useEffect(() => {
    const token = authService.getToken()
    console.log('Token d\'authentification:', token ? 'Présent' : 'Manquant')
    if (token) {
      authService.setAuthHeader(token)
      console.log('Headers axios configurés:', axios.defaults.headers.common)
    } else {
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
        throw new Error('Non authentifie')
      }
      const headers = {
        'Authorization': `Bearer ${token}`
      }
      if (selectedDevice) {
        await axios.put(`/api/network/devices/${selectedDevice.id}`, formData, { headers })
      } else {
        await axios.post('/api/network/devices', formData, { headers })
      }
      await fetchDevices()
      setVisible(false)
      setSelectedDevice(null)
      setFormData({
        hostname: '',
        ipAddress: '',
        macAddress: '',
        os: '',
        deviceType: '',
      })
      // Feedback visuel ajout/modif
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2000)
    } catch (err) {
      setError('Erreur lors de l\'enregistrement: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour supprimer un appareil
  const handleDelete = async (deviceId) => {
    if (window.confirm('Etes-vous sur de vouloir supprimer cet appareil ?')) {
      try {
        setLoading(true)
        const token = authService.getToken()
        if (!token) {
          throw new Error('Non authentifie')
        }
        await axios.delete(`/api/network/devices/${deviceId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        await fetchDevices()
        // Feedback visuel suppression
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 1200)
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

  useEffect(() => {
    // Initialisation du socket pour la progression du scan
    const s = io("http://localhost:3000")
    setSocket(s)
    s.emit("join-network-room")
    s.on("scan-progress", (msg) => {
      setScanProgress(msg.data)
    })
    s.on("scan-complete", () => {
      setScanProgress(null)
      setShowConfetti(true)
      fetchDevices()
      setTimeout(() => setShowConfetti(false), 3500)
    })
    s.on("error", (msg) => {
      setScanProgress(null)
      setError(msg.data?.message || "Erreur lors du scan reseau")
    })
    return () => {
      s.emit("leave-network-room")
      s.disconnect()
    }
  }, [])

  const scanButtonDisabled = loading || !!scanProgress

  return (
    <>
      {/* Confettis animés */}
      {showConfetti && (
        <div ref={confettiRef} style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          pointerEvents: 'none',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          {[...Array(60)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${Math.random()*100}%`,
              top: `${Math.random()*100}%`,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: `hsl(${Math.random()*360},90%,60%)`,
              opacity: 0.7,
              transform: `scale(${0.7+Math.random()*1.2})`,
              animation: `confetti-fall 1.2s ${Math.random()*2}s cubic-bezier(.2,.7,.4,1) forwards`,
            }} />
          ))}
        </div>
      )}
      <CCard className="mb-4">
        <CCardHeader>
          <CRow className="align-items-center">
            <CCol xs="auto">
              <h4 className="mb-0">Gestion des Appareils</h4>
            </CCol>
            <CCol xs="auto" className="ms-auto">
              <CTooltip content="Ajouter un nouvel appareil sur le reseau">
                <CButton 
                  color="primary" 
                  onClick={() => {
                    setSelectedDevice(null)
                    setVisible(true)
                  }}
                  className="me-2"
                  style={{ borderRadius: "30px", fontWeight: "bold", boxShadow: "0 0 8px #007bff55" }}
                >
                  <CIcon icon={cilPlus} className="me-2" />
                  Ajouter
                </CButton>
              </CTooltip>
              <CTooltip content="Scanner tout le reseau (fun garanti)">
                <CButton 
                  color="success" 
                  onClick={handleScan}
                  disabled={scanButtonDisabled}
                  className="me-2 scan-radar-btn"
                  style={{ borderRadius: "50%", width: 56, height: 56, boxShadow: scanButtonDisabled ? "none" : "0 0 16px #4be04b99", position: 'relative', overflow: 'hidden' }}
                >
                  <span className="ripple" />
                  <span className="radar-icon">
                    <CIcon icon={cilSearch} className={scanButtonDisabled ? "spin" : "radar-anim"} style={{ fontSize: 28 }} />
                  </span>
                </CButton>
              </CTooltip>
              <CTooltip content="Rafraichir la liste des appareils">
                <CButton 
                  color="secondary" 
                  onClick={handleRefresh}
                  disabled={loading}
                  style={{ borderRadius: "30px" }}
                >
                  {loading ? (
                    <CSpinner size="sm" className="me-2" />
                  ) : (
                    <CIcon icon={cilReload} className="me-2" />
                  )}
                  Rafraichir
                </CButton>
              </CTooltip>
            </CCol>
          </CRow>
          {/* Barre de progression du scan avec effet degrade */}
          {scanProgress && (
            <CProgress className="mt-3 progress-fun" style={{ height: "22px", background: "#e0e0e0" }} animated>
              <CProgressBar value={scanProgress.progress * 100} style={{ background: "linear-gradient(90deg,#4be04b,#00cfff 80%,#ffb300)", color: '#222', fontWeight: 'bold', fontSize: 18 }}>
                {Math.round(scanProgress.progress * 100)}% - {scanProgress.currentStep}
              </CProgressBar>
            </CProgress>
          )}
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

          <CTable hover responsive className="fun-table">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Hostname</CTableHeaderCell>
                <CTableHeaderCell>Type</CTableHeaderCell>
                <CTableHeaderCell>Adresse IP</CTableHeaderCell>
                <CTableHeaderCell>MAC</CTableHeaderCell>
                <CTableHeaderCell>Systeme</CTableHeaderCell>
                <CTableHeaderCell>Statut</CTableHeaderCell>
                <CTableHeaderCell>Derniere vue</CTableHeaderCell>
                <CTableHeaderCell>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredDevices.map((device, idx) => {
                const status = getDeviceStatus(device.lastSeen)
                return (
                  <CTableRow key={device.id} style={{ animation: `fadeIn .7s ${0.1*idx}s both` }}>
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
                      <CBadge color={status.color} style={{ fontSize: 15, padding: '6px 12px' }}>
                        <CIcon icon={status.icon} className="me-1" />
                        {status.status}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{new Date(device.lastSeen).toLocaleString()}</CTableDataCell>
                    <CTableDataCell>
                      <CTooltip content="Editer cet appareil">
                        <CButton 
                          color="primary" 
                          variant="ghost" 
                          size="sm" 
                          className="me-2"
                          onClick={() => handleEdit(device)}
                          style={{ borderRadius: 12 }}
                        >
                          <CIcon icon={cilPencil} />
                        </CButton>
                      </CTooltip>
                      <CTooltip content="Supprimer cet appareil (attention)">
                        <CButton 
                          color="danger" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(device.id)}
                          style={{ borderRadius: 12 }}
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CTooltip>
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

      {/* Ajout du style pour l'animation de l'icone scan, confettis, fadeIn, radar, ripple */}
      <style>{`
      .spin {
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        100% { transform: rotate(360deg); }
      }
      .radar-anim {
        animation: radarPulse 1.2s infinite cubic-bezier(.4,0,.2,1);
        filter: drop-shadow(0 0 8px #4be04b);
      }
      @keyframes radarPulse {
        0% { transform: scale(1); opacity: 1; }
        70% { transform: scale(1.18); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
      }
      .scan-radar-btn .ripple {
        position: absolute;
        left: 50%; top: 50%;
        width: 120%; height: 120%;
        background: radial-gradient(circle,#4be04b55 0%,transparent 70%);
        transform: translate(-50%,-50%);
        pointer-events: none;
        animation: rippleAnim 1.2s infinite linear;
        opacity: 0.7;
      }
      @keyframes rippleAnim {
        0% { opacity: 0.7; transform: translate(-50%,-50%) scale(1); }
        80% { opacity: 0.1; transform: translate(-50%,-50%) scale(1.25); }
        100% { opacity: 0; transform: translate(-50%,-50%) scale(1.4); }
      }
      @keyframes confetti-fall {
        0% { opacity: 0; transform: translateY(-40px) scale(0.7); }
        30% { opacity: 1; }
        100% { opacity: 0; transform: translateY(100vh) scale(1.2); }
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: none; }
      }
      .fun-table tbody tr {
        transition: box-shadow 0.2s;
      }
      .fun-table tbody tr:hover {
        box-shadow: 0 2px 16px #00cfff22;
        background: #f8fcff;
      }
      .progress-fun .progress-bar {
        font-weight: bold;
        letter-spacing: 1px;
        text-shadow: 0 1px 2px #fff;
      }
      `}</style>
    </>
  )
}

export default Devices 