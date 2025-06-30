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
  CToast,
  CToastBody,
  CToaster,
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
import { API_CONFIG, buildApiUrl } from '../../config/api.config'
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
  const [toast, setToast] = useState({ show: false, message: '', color: 'success' })
  const toasterRef = useRef()

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

      const response = await axios.get('/api/network/devices')
      
      // Correction : accéder à response.data.data au lieu de response.data
      // car le backend retourne { success: true, data: [...], count: ... }
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        setDevices(response.data.data)
        console.log(`[FRONTEND] ${response.data.count} appareils récupérés avec succès`)
      } else {
        console.warn('[FRONTEND] Format de réponse inattendu:', response.data)
        setDevices([])
      }
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
    const initializeAuth = async () => {
      try {
        const token = authService.getToken()
        if (!token) {
          console.log('Pas de token trouve, redirection vers la page de connexion')
          window.location.href = '/login'
          return
        }
        
        // Configuration du header d'authentification
        authService.setAuthHeader(token)
        
        // Vérification que l'utilisateur est bien authentifié
        const currentUser = authService.getCurrentUser()
        
        if (!currentUser || !currentUser.id) {
          console.log('Utilisateur non valide, redirection vers la page de connexion')
          authService.logout()
          window.location.href = '/login'
          return
        }
        
        // Chargement de la liste des appareils
        await fetchDevices()
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error)
        if (error.message.includes('401') || error.message.includes('non autorise')) {
          authService.logout()
          window.location.href = '/login'
        }
      }
    }
    
    initializeAuth()
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
      
      // Configuration du header d'authentification
      authService.setAuthHeader(token)
      
      if (selectedDevice) {
        await axios.put(`/api/network/devices/${selectedDevice.id}`, formData)
      } else {
        await axios.post('/api/network/devices', formData)
      }
      
      await fetchDevices()
      resetForm()
    } catch (err) {
      console.error('Erreur lors de l\'ajout/modification:', err)
      if (err.response?.status === 401) {
        authService.logout()
        window.location.href = '/login'
      } else {
        setError('Erreur lors de l\'ajout/modification: ' + (err.response?.data?.message || err.message))
      }
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour supprimer un appareil
  const handleDelete = async (deviceId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet appareil ?')) {
      return
    }
    
    try {
      setLoading(true)
      const token = authService.getToken()
      if (!token) {
        throw new Error('Non authentifie')
      }
      
      // Configuration du header d'authentification
      authService.setAuthHeader(token)
      
      await axios.delete(`/api/network/devices/${deviceId}`)
      await fetchDevices()
    } catch (err) {
      console.error('Erreur lors de la suppression:', err)
      if (err.response?.status === 401) {
        authService.logout()
        window.location.href = '/login'
      } else {
        setError('Erreur lors de la suppression: ' + (err.response?.data?.message || err.message))
      }
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour éditer un appareil
  const handleEdit = (device) => {
    setSelectedDevice(device)
    setFormData({
      hostname: device.hostname || '',
      ipAddress: device.ipAddress || '',
      macAddress: device.macAddress || '',
      os: device.os || '',
      deviceType: device.deviceType || '',
    })
    setVisible(true)
  }

  // Fonction pour rafraîchir la liste
  const handleRefresh = async () => {
    await fetchDevices()
  }

  // Fonction de test d'authentification
  const testAuth = async () => {
    try {
      const response = await axios.get('/api/network/test-auth')
      if (response.data.success) {
        console.log('[FRONTEND] Authentification valide:', response.data.user)
        return true
      } else {
        console.error('[FRONTEND] Token invalide:', response.data.message)
        setError('Token invalide: ' + response.data.message)
        return false
      }
    } catch (err) {
      console.error('[FRONTEND] Erreur test auth:', err.message)
      setError('Erreur lors du test d\'authentification: ' + err.message)
      return false
    }
  }

  // Fonction de débogage pour diagnostiquer le problème
  const handleDebug = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const token = authService.getToken()
      if (!token) {
        throw new Error('Non authentifié')
      }
      
      authService.setAuthHeader(token)
      
      console.log('[FRONTEND] Test de débogage des appareils...')
      const response = await axios.get('/api/network/devices/debug')
      
      if (response.data && response.data.success) {
        const debugInfo = response.data.data
        console.log('[FRONTEND] Informations de débogage:', debugInfo)
        
        const message = `📊 Diagnostic: ${debugInfo.summary.totalCount} appareils totaux (${debugInfo.summary.activeCount} actifs, ${debugInfo.summary.inactiveCount} inactifs)`
        setToast({ show: true, message, color: 'info' })
        
        // Si il y a des appareils inactifs, les afficher dans la console
        if (debugInfo.inactive && debugInfo.inactive.length > 0) {
          console.log('[FRONTEND] Appareils inactifs:', debugInfo.inactive)
        }
        
        // Si il y a des appareils actifs, les afficher dans la console
        if (debugInfo.active && debugInfo.active.length > 0) {
          console.log('[FRONTEND] Appareils actifs:', debugInfo.active)
        }
      } else {
        throw new Error('Format de réponse inattendu')
      }
    } catch (err) {
      console.error('[FRONTEND] Erreur débogage:', err.message)
      setError('Erreur lors du débogage: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  // Fonction de scan complet intégrée (nmap + routeur + topologie + statistiques)
  const handleScan = async () => {
    try {
      setLoading(true)
      setError(null)
      setToast({ show: false, message: '', color: 'success' })
      
      // Test d'authentification avant le scan
      const authValid = await testAuth()
      if (!authValid) {
        setLoading(false)
        return
      }

      console.log('[FRONTEND] Démarrage du scan complet intégré...')
      
      // 1. Détection automatique du réseau
      console.log('[FRONTEND] Détection du réseau...')
      const networkResponse = await axios.get('/api/network/detect')
      
      if (!networkResponse.data || !networkResponse.data.network) {
        throw new Error('Impossible de détecter le réseau automatiquement')
      }

      const { cidr, localIP, gateway } = networkResponse.data.network
      console.log('[FRONTEND] Réseau détecté:', `${cidr} (IP locale: ${localIP}, Gateway: ${gateway})`)

      // 2. Scan complet (routeur + nmap)
      console.log('[FRONTEND] Démarrage du scan complet...')
      const comprehensiveResponse = await axios.get('/api/network/comprehensive-scan', {
        timeout: 300000
      })
      
      if (!comprehensiveResponse.data.success) {
        throw new Error(comprehensiveResponse.data.message || 'Erreur lors du scan complet')
      }

      console.log('[FRONTEND] Scan complet terminé:', comprehensiveResponse.data.count, 'appareils trouvés')

      // 3. Récupération de la topologie
      console.log('[FRONTEND] Récupération de la topologie...')
      const topologyResponse = await axios.get('/api/network/topology')
      
      if (topologyResponse.data.success) {
        console.log('[FRONTEND] Topologie récupérée avec succès')
      }

      // 4. Mise à jour de la liste des appareils
      await fetchDevices()
      
      // 5. Affichage du toast de succès
      setToast({ show: true, message: `✅ Scan terminé : ${comprehensiveResponse.data.count} appareils détectés !`, color: 'success' })
      
    } catch (err) {
      console.error('[FRONTEND] Erreur scan complet:', err.message)
      if (err.code === 'ECONNABORTED') {
        setError('Le scan a pris trop de temps. Veuillez réessayer.')
      } else if (err.response) {
        if (err.response.status === 401) {
          authService.logout()
          window.location.href = '/login'
        } else {
          setError(`Erreur lors du scan: ${err.response.data?.message || 'Erreur serveur'}`)
        }
      } else if (err.request) {
        setError('Le serveur ne répond pas. Vérifiez que le backend est en cours d\'exécution.')
      } else {
        setError('Erreur lors du scan: ' + err.message)
      }
      setToast({ show: true, message: '❌ ' + (err.response?.data?.message || err.message), color: 'danger' })
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
                  style={{ borderRadius: "30px", fontWeight: "bold", boxShadow: `0 0 8px ${getComputedStyle(document.body).getPropertyValue('--color-primary').trim() || "#3b82f6"}55` }}
                >
                  <CIcon icon={cilPlus} className="me-2" />
                  Ajouter
                </CButton>
              </CTooltip>
              
              <CTooltip content="Scan complet intégré (Routeur + Nmap + Topologie + Statistiques)">
                <CButton 
                  color="success" 
                  onClick={handleScan}
                  disabled={scanButtonDisabled}
                  className="me-2 scan-radar-btn"
                  style={{ borderRadius: "50%", width: 56, height: 56, boxShadow: scanButtonDisabled ? "none" : `0 0 16px ${getComputedStyle(document.body).getPropertyValue('--color-success').trim() || "#10b981"}99`, position: 'relative', overflow: 'hidden' }}
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
              
              <CTooltip content="Diagnostiquer le problème de récupération">
                <CButton 
                  color="info" 
                  onClick={handleDebug}
                  disabled={loading}
                  style={{ borderRadius: "30px" }}
                  className="ms-2"
                >
                  <CIcon icon={cilInfo} className="me-2" />
                  Debug
                </CButton>
              </CTooltip>
            </CCol>
          </CRow>
          
          {/* Barre de progression du scan avec effet degrade */}
          {scanProgress && (
            <CProgress className="mt-3 progress-fun" style={{ height: "22px", background: getComputedStyle(document.body).getPropertyValue('--color-bg-secondary-light').trim() || "#f1f5f9" }} animated>
              <CProgressBar value={scanProgress.progress * 100} style={{ background: `linear-gradient(90deg,${getComputedStyle(document.body).getPropertyValue('--color-success').trim() || "#10b981"},${getComputedStyle(document.body).getPropertyValue('--color-info').trim() || "#06b6d4"} 80%,${getComputedStyle(document.body).getPropertyValue('--color-warning').trim() || "#f59e0b"})`, color: getComputedStyle(document.body).getPropertyValue('--color-text-light').trim() || "#0f172a", fontWeight: 'bold', fontSize: 18 }}>
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
                <CTableHeaderCell>Système</CTableHeaderCell>
                <CTableHeaderCell>Statut</CTableHeaderCell>
                <CTableHeaderCell>Dernière vue</CTableHeaderCell>
                <CTableHeaderCell>Méthode</CTableHeaderCell>
                <CTableHeaderCell>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredDevices.map((device, idx) => {
                const status = getDeviceStatus(device.lastSeen)
                const method = (device.sources && device.sources.length > 0) ? device.sources.join(", ") : "inconnu"
                let methodColor = "secondary"
                if (method.includes("nmap")) methodColor = "info"
                if (method.includes("router")) methodColor = "success"
                if (method.includes("arp")) methodColor = "warning"
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
                      <CBadge color={methodColor} style={{ fontSize: 13, padding: '4px 10px' }}>{method}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CTooltip content="Editer cet appareil">
                        <CButton 
                          color="primary" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(device)}
                          className="me-2"
                        >
                          <CIcon icon={cilPencil} />
                        </CButton>
                      </CTooltip>
                      <CTooltip content="Supprimer cet appareil">
                        <CButton 
                          color="danger" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(device.id)}
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

          {/* Affichage d'un message d'avertissement si une méthode de scan échoue */}
          {error && error.toLowerCase().includes('snmpwalk') && (
            <CAlert color="warning" dismissible onClose={() => setError(null)}>
              ⚠️ SNMP non disponible : certaines méthodes de détection sont incomplètes. Installez snmpwalk pour une détection optimale.
            </CAlert>
          )}
        </CCardBody>
      </CCard>

      {/* Modal pour ajouter/modifier un appareil */}
      <CModal visible={visible} onClose={resetForm} size="lg">
        <CModalHeader>
          <CModalTitle>
            {selectedDevice ? 'Modifier l\'appareil' : 'Ajouter un appareil'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm onSubmit={handleSubmit}>
            <CRow>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>Hostname</CFormLabel>
                  <CFormInput
                    name="hostname"
                    value={formData.hostname}
                    onChange={handleInputChange}
                    placeholder="Nom de l'appareil"
                    required
                  />
                </div>
              </CCol>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>Adresse IP</CFormLabel>
                  <CFormInput
                    name="ipAddress"
                    value={formData.ipAddress}
                    onChange={handleInputChange}
                    placeholder="192.168.1.100"
                    required
                  />
                </div>
              </CCol>
            </CRow>
            <CRow>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>Adresse MAC</CFormLabel>
                  <CFormInput
                    name="macAddress"
                    value={formData.macAddress}
                    onChange={handleInputChange}
                    placeholder="00:11:22:33:44:55"
                  />
                </div>
              </CCol>
              <CCol md={6}>
                <div className="mb-3">
                  <CFormLabel>Système d'exploitation</CFormLabel>
                  <CFormInput
                    name="os"
                    value={formData.os}
                    onChange={handleInputChange}
                    placeholder="Windows 10, Linux, etc."
                  />
                </div>
              </CCol>
            </CRow>
            <div className="mb-3">
              <CFormLabel>Type d'appareil</CFormLabel>
              <CFormSelect
                name="deviceType"
                value={formData.deviceType}
                onChange={handleInputChange}
              >
                <option value="">Sélectionner un type</option>
                <option value="DESKTOP">Ordinateur de bureau</option>
                <option value="LAPTOP">Ordinateur portable</option>
                <option value="MOBILE">Mobile</option>
                <option value="SERVER">Serveur</option>
                <option value="ROUTER">Routeur</option>
                <option value="SWITCH">Switch</option>
                <option value="AP">Point d'accès</option>
                <option value="PRINTER">Imprimante</option>
                <option value="CAMERA">Caméra</option>
                <option value="OTHER">Autre</option>
              </CFormSelect>
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={resetForm}>
            Annuler
          </CButton>
          <CButton color="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <CSpinner size="sm" /> : (selectedDevice ? 'Modifier' : 'Ajouter')}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Styles CSS pour les animations */}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 0.7;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        
        @keyframes radar-anim {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .scan-radar-btn:hover .radar-icon {
          animation: radar-anim 2s linear infinite;
        }
        
        .progress-fun {
          border-radius: 15px;
          overflow: hidden;
        }
        
        .fun-table {
          border-radius: 10px;
          overflow: hidden;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Toast pour les notifications */}
      <CToaster ref={toasterRef} placement="top-end">
        {toast.show && (
          <CToast
            visible={toast.show}
            color={toast.color}
            onClose={() => setToast({ show: false, message: '', color: 'success' })}
            delay={5000}
          >
            <CToastBody>
              {toast.message}
            </CToastBody>
          </CToast>
        )}
      </CToaster>
    </>
  )
}

export default Devices 