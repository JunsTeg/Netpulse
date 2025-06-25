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
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CBadge,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormLabel,
  CFormTextarea,
  CFormCheck,
  CFormRange,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilBell,
  cilFilter,
  cilReload,
  cilCheckCircle,
  cilSettings,
  cilTrash,
  cilPlus,
} from '@coreui/icons'
import axios from 'axios'
import authService from '../../services/auth.service'
import { API_CONFIG, buildApiUrl } from '../../config/api.config'

const Alerts = () => {
  const [selectedType, setSelectedType] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [settingsModalVisible, setSettingsModalVisible] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Charger les alertes depuis l'API
  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const token = authService.getToken()
      authService.setAuthHeader(token)
      const response = await axios.get(buildApiUrl('/api/network/alerts'), {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAlerts(response.data.results || [])
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement des alertes: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  // Fonction pour filtrer les alertes
  const filteredAlerts = alerts.filter((alert) => {
    const matchesType = selectedType === 'all' || alert.anomalyType === selectedType || alert.type === selectedType
    const matchesSearch = Object.values(alert).some((value) =>
      value && value.toString().toLowerCase().includes(searchTerm.toLowerCase()),
    )
    return matchesType && matchesSearch
  })

  // Fonction pour obtenir la couleur du badge selon le type
  const getTypeColor = (type) => {
    switch (type) {
      case 'CPU_HIGH':
      case 'MEMORY_HIGH':
        return 'warning'
      case 'LATENCY_HIGH':
        return 'info'
      case 'SECURITY':
        return 'danger'
      default:
        return 'secondary'
    }
  }

  // Fonction pour obtenir la couleur du badge selon le statut
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'inactive':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const handleAlertClick = (alert) => {
    setSelectedAlert(alert)
    setModalVisible(true)
  }

  // Fonction pour acquitter une alerte
  const handleAcknowledge = async (alertId) => {
    try {
      const token = authService.getToken()
      authService.setAuthHeader(token)
      await axios.post(buildApiUrl(`/api/network/alerts/${alertId}/ack`), {}, { headers: { Authorization: `Bearer ${token}` } })
      fetchAlerts()
    } catch (err) {
      alert('Erreur lors de l\'acquittement : ' + (err.response?.data?.message || err.message))
    }
  }

  // Fonction pour assigner une alerte
  const handleAssign = async (alertId, userId) => {
    try {
      const token = authService.getToken()
      authService.setAuthHeader(token)
      await axios.post(buildApiUrl(`/api/network/alerts/${alertId}/assign`), { userId }, { headers: { Authorization: `Bearer ${token}` } })
      fetchAlerts()
    } catch (err) {
      alert('Erreur lors de l\'assignation : ' + (err.response?.data?.message || err.message))
    }
  }

  // Fonction pour commenter une alerte
  const handleComment = async (alertId, message) => {
    try {
      const token = authService.getToken()
      authService.setAuthHeader(token)
      await axios.post(buildApiUrl(`/api/network/alerts/${alertId}/comment`), { message }, { headers: { Authorization: `Bearer ${token}` } })
      fetchAlerts()
    } catch (err) {
      alert('Erreur lors de l\'ajout du commentaire : ' + (err.response?.data?.message || err.message))
    }
  }

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader>
          <CRow className="align-items-center">
            <CCol xs="auto">
              <h4 className="mb-0">Alertes Reseau</h4>
            </CCol>
            <CCol xs="auto" className="ms-auto">
              <CButtonGroup>
                <CButton color="primary" variant="outline" className="me-2">
                  <CIcon icon={cilPlus} className="me-2" />
                  Nouvelle Alerte
                </CButton>
                <CButton color="primary" variant="outline" onClick={() => setSettingsModalVisible(true)}>
                  <CIcon icon={cilSettings} className="me-2" />
                  Parametres
                </CButton>
              </CButtonGroup>
            </CCol>
          </CRow>
        </CCardHeader>
        <CCardBody>
          <CRow className="mb-3">
            <CCol md={4}>
              <CFormSelect
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                options={[
                  { label: 'Tous les types', value: 'all' },
                  { label: 'Performance', value: 'performance' },
                  { label: 'Systeme', value: 'system' },
                  { label: 'Securite', value: 'security' },
                ]}
              />
            </CCol>
            <CCol md={8}>
              <CInputGroup>
                <CInputGroupText>
                  <CIcon icon={cilFilter} />
                </CInputGroupText>
                <CFormInput
                  placeholder="Rechercher une alerte..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </CInputGroup>
            </CCol>
          </CRow>

          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Nom</CTableHeaderCell>
                <CTableHeaderCell>Type</CTableHeaderCell>
                <CTableHeaderCell>Condition</CTableHeaderCell>
                <CTableHeaderCell>Statut</CTableHeaderCell>
                <CTableHeaderCell>Derniere Activation</CTableHeaderCell>
                <CTableHeaderCell>Description</CTableHeaderCell>
                <CTableHeaderCell>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {loading ? (
                <CTableRow><CTableDataCell colSpan={7}>Chargement...</CTableDataCell></CTableRow>
              ) : error ? (
                <CTableRow><CTableDataCell colSpan={7}>{error}</CTableDataCell></CTableRow>
              ) : filteredAlerts.map((alert) => (
                <CTableRow
                  key={alert.alertId}
                  className="cursor-pointer"
                  onClick={() => handleAlertClick(alert)}
                >
                  <CTableDataCell>
                    <CIcon icon={cilBell} className="me-2" />
                    {alert.anomalyType || alert.type || alert.name}
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={getTypeColor(alert.anomalyType || alert.type)}>
                      {alert.anomalyType || alert.type}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{alert.description || alert.condition}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={getStatusColor(alert.status)}>
                      {alert.status === 'active' ? 'Active' : 'Inactive'}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : ''}</CTableDataCell>
                  <CTableDataCell>{alert.hostname || alert.deviceId || ''}</CTableDataCell>
                  <CTableDataCell>
                    <CButtonGroup>
                      <CButton
                        color={alert.status === 'active' ? 'secondary' : 'success'}
                        variant="ghost"
                        size="sm"
                        className="me-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Logique pour activer/desactiver
                        }}
                      >
                        <CIcon icon={alert.status === 'active' ? cilCheckCircle : cilBell} />
                      </CButton>
                      <CButton
                        color="danger"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Logique pour supprimer
                        }}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                      <CButton color="success" size="sm" onClick={e => { e.stopPropagation(); handleAcknowledge(alert.alertId) }}>Acquitter</CButton>
                    </CButtonGroup>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      {/* Modal de details d'alerte */}
      <CModal visible={modalVisible} onClose={() => setModalVisible(false)} size="lg">
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilBell} className="me-2" />
            Details de l'Alerte
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedAlert && (
            <CForm>
              <CRow>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Nom de l'alerte</CFormLabel>
                    <div className="form-control-plaintext">{selectedAlert.name}</div>
                  </div>
                </CCol>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Type</CFormLabel>
                    <div>
                      <CBadge color={getTypeColor(selectedAlert.type)}>
                        {selectedAlert.type === 'performance'
                          ? 'Performance'
                          : selectedAlert.type === 'system'
                          ? 'Systeme'
                          : 'Securite'}
                      </CBadge>
                    </div>
                  </div>
                </CCol>
              </CRow>
              <div className="mb-3">
                <CFormLabel>Condition</CFormLabel>
                <div className="form-control-plaintext">{selectedAlert.condition}</div>
              </div>
              <div className="mb-3">
                <CFormLabel>Description</CFormLabel>
                <div className="form-control-plaintext">{selectedAlert.description}</div>
              </div>
              <div className="mb-3">
                <CFormLabel>Seuil ({selectedAlert.threshold})</CFormLabel>
                <CFormRange
                  min="0"
                  max="100"
                  value={selectedAlert.threshold}
                  onChange={(e) => {
                    // Logique pour mettre a jour le seuil
                  }}
                />
              </div>
              <div className="mb-3">
                <CFormLabel>Duree (minutes)</CFormLabel>
                <CFormInput
                  type="number"
                  value={selectedAlert.duration}
                  onChange={(e) => {
                    // Logique pour mettre a jour la duree
                  }}
                />
              </div>
              <div className="mb-3">
                <CFormLabel>Notifications</CFormLabel>
                <div>
                  <CFormCheck
                    type="checkbox"
                    id="email"
                    label="Email"
                    checked={selectedAlert.notification.includes('email')}
                    onChange={(e) => {
                      // Logique pour mettre a jour les notifications
                    }}
                  />
                  <CFormCheck
                    type="checkbox"
                    id="sms"
                    label="SMS"
                    checked={selectedAlert.notification.includes('sms')}
                    onChange={(e) => {
                      // Logique pour mettre a jour les notifications
                    }}
                  />
                  <CFormCheck
                    type="checkbox"
                    id="webhook"
                    label="Webhook"
                    checked={selectedAlert.notification.includes('webhook')}
                    onChange={(e) => {
                      // Logique pour mettre a jour les notifications
                    }}
                  />
                </div>
              </div>
            </CForm>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setModalVisible(false)}>
            Fermer
          </CButton>
          <CButton color="primary" className="me-2">
            Enregistrer
          </CButton>
          <CButton color="danger">
            <CIcon icon={cilTrash} className="me-2" />
            Supprimer
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal des parametres */}
      <CModal visible={settingsModalVisible} onClose={() => setSettingsModalVisible(false)}>
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilSettings} className="me-2" />
            Parametres des Alertes
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel>Email de notification</CFormLabel>
              <CFormInput type="email" placeholder="admin@example.com" />
            </div>
            <div className="mb-3">
              <CFormLabel>Numero de telephone SMS</CFormLabel>
              <CFormInput type="tel" placeholder="+33 6 12 34 56 78" />
            </div>
            <div className="mb-3">
              <CFormLabel>URL Webhook</CFormLabel>
              <CFormInput type="url" placeholder="https://api.example.com/webhook" />
            </div>
            <div className="mb-3">
              <CFormLabel>Delai entre notifications (minutes)</CFormLabel>
              <CFormInput type="number" min="1" value="5" />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setSettingsModalVisible(false)}>
            Annuler
          </CButton>
          <CButton color="primary">Enregistrer</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Alerts 