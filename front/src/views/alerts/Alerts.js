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
  CSpinner,
  CAlert,
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
  cilInfo,
} from '@coreui/icons'
import apiService from '../../services/api.service'

const Alerts = () => {
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedPriority, setSelectedPriority] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [settingsModalVisible, setSettingsModalVisible] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Fonction pour charger les alertes depuis l'API
  const loadAlerts = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await apiService.get('/api/network/alerts?pageSize=500')
      
      if (response.results) {
        setAlerts(response.results)
      } else if (response.error) {
        // Si c'est une erreur gérée côté serveur, afficher le message
        setAlerts([])
        setError(response.error)
      } else {
        throw new Error('Format de réponse invalide')
      }
    } catch (err) {
      console.error('Erreur chargement alertes:', err)
      setError('Erreur lors du chargement des alertes: ' + err.message)
      setAlerts([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Charger les alertes au montage du composant
  useEffect(() => {
    loadAlerts()
  }, [])

  // Fonction pour filtrer les alertes
  const filteredAlerts = alerts.filter((alert) => {
    const matchesStatus = selectedStatus === 'all' || alert.status === selectedStatus
    const matchesPriority = selectedPriority === 'all' || alert.priority === selectedPriority
    const matchesSearch = 
      alert.anomalyType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.hostname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.ipAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.severity?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesPriority && matchesSearch
  })

  // Fonction pour obtenir la couleur du badge selon la priorité
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'danger'
      case 'medium':
        return 'warning'
      case 'low':
        return 'info'
      default:
        return 'secondary'
    }
  }

  // Fonction pour obtenir la couleur du badge selon le statut
  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'danger'
      case 'resolved':
        return 'success'
      case 'acknowledged':
        return 'warning'
      default:
        return 'secondary'
    }
  }

  // Fonction pour obtenir la couleur du badge selon la sévérité
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'danger'
      case 'high':
        return 'warning'
      case 'medium':
        return 'info'
      case 'low':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  // Fonction pour formater la date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleAlertClick = (alert) => {
    setSelectedAlert(alert)
    setModalVisible(true)
  }

  const handleRefresh = () => {
    loadAlerts(true)
  }

  // Fonction pour acquitter une alerte
  const handleAcknowledge = async (alertId) => {
    try {
      await apiService.post(`/api/network/alerts/${alertId}/ack`, {})
      loadAlerts(true)
    } catch (err) {
      console.error('Erreur acquittement alerte:', err)
      setError('Erreur lors de l\'acquittement: ' + err.message)
    }
  }

  if (loading) {
    return (
      <CCard className="mb-4">
        <CCardBody className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
          <CSpinner size="lg" />
        </CCardBody>
      </CCard>
    )
  }

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader>
          <CRow className="align-items-center">
            <CCol xs="auto">
              <h4 className="mb-0">Alertes Réseau</h4>
            </CCol>
            <CCol xs="auto" className="ms-auto">
              <CButton 
                color="primary" 
                variant="outline" 
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <CSpinner size="sm" className="me-2" />
                ) : (
                  <CIcon icon={cilReload} className="me-2" />
                )}
                Actualiser
              </CButton>
            </CCol>
          </CRow>
        </CCardHeader>
        <CCardBody>
          {error && (
            <CAlert color="danger" className="mb-3">
              {error}
            </CAlert>
          )}

          <CRow className="mb-3">
            <CCol md={3}>
              <CFormSelect
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                options={[
                  { label: 'Tous les statuts', value: 'all' },
                  { label: 'Ouvertes', value: 'open' },
                  { label: 'Résolues', value: 'resolved' },
                  { label: 'Acquittées', value: 'acknowledged' },
                ]}
              />
            </CCol>
            <CCol md={3}>
              <CFormSelect
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                options={[
                  { label: 'Toutes les priorités', value: 'all' },
                  { label: 'Haute', value: 'high' },
                  { label: 'Moyenne', value: 'medium' },
                  { label: 'Basse', value: 'low' },
                ]}
              />
            </CCol>
            <CCol md={6}>
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
                <CTableHeaderCell>Type d'Anomalie</CTableHeaderCell>
                <CTableHeaderCell>Appareil</CTableHeaderCell>
                <CTableHeaderCell>Sévérité</CTableHeaderCell>
                <CTableHeaderCell>Priorité</CTableHeaderCell>
                <CTableHeaderCell>Statut</CTableHeaderCell>
                <CTableHeaderCell>Déclenchée le</CTableHeaderCell>
                <CTableHeaderCell>Description</CTableHeaderCell>
                <CTableHeaderCell>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredAlerts.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={8} className="text-center">
                    {alerts.length === 0 ? 'Aucune alerte trouvée' : 'Aucune alerte ne correspond aux critères de recherche'}
                  </CTableDataCell>
                </CTableRow>
              ) : (
                filteredAlerts.map((alert) => (
                  <CTableRow
                    key={alert.alertId}
                    className="cursor-pointer"
                    onClick={() => handleAlertClick(alert)}
                  >
                    <CTableDataCell>
                      <CIcon icon={cilBell} className="me-2" />
                      {alert.anomalyType || 'N/A'}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div>
                        <div className="fw-semibold">{alert.hostname || 'N/A'}</div>
                        <small className="text-muted">{alert.ipAddress || 'N/A'}</small>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getSeverityColor(alert.severity)}>
                        {alert.severity || 'N/A'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getPriorityColor(alert.priority)}>
                        {alert.priority || 'N/A'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getStatusColor(alert.status)}>
                        {alert.status === 'open' ? 'Ouverte' : 
                         alert.status === 'resolved' ? 'Résolue' : 
                         alert.status === 'acknowledged' ? 'Acquittée' : alert.status}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{formatDate(alert.triggeredAt)}</CTableDataCell>
                    <CTableDataCell>
                      <div className="text-truncate" style={{ maxWidth: '200px' }}>
                        {alert.description || 'N/A'}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButtonGroup>
                        <CButton
                          color="info"
                          variant="ghost"
                          size="sm"
                          className="me-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAlertClick(alert)
                          }}
                        >
                          <CIcon icon={cilInfo} />
                        </CButton>
                        {alert.status === 'open' && (
                          <CButton
                            color="success"
                            variant="ghost"
                            size="sm"
                            className="me-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAcknowledge(alert.alertId)
                            }}
                          >
                            <CIcon icon={cilCheckCircle} />
                          </CButton>
                        )}
                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            // TODO: Implémenter la suppression d'alerte
                          }}
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CButtonGroup>
                    </CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      {/* Modal de details d'alerte */}
      <CModal visible={modalVisible} onClose={() => setModalVisible(false)} size="lg">
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilBell} className="me-2" />
            Détails de l'Alerte
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedAlert && (
            <CForm>
              <CRow>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Type d'anomalie</CFormLabel>
                    <div className="form-control-plaintext">{selectedAlert.anomalyType || 'N/A'}</div>
                  </div>
                </CCol>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Appareil</CFormLabel>
                    <div className="form-control-plaintext">
                      {selectedAlert.hostname || 'N/A'} ({selectedAlert.ipAddress || 'N/A'})
                    </div>
                  </div>
                </CCol>
              </CRow>
              <CRow>
                <CCol md={4}>
                  <div className="mb-3">
                    <CFormLabel>Sévérité</CFormLabel>
                    <div>
                      <CBadge color={getSeverityColor(selectedAlert.severity)}>
                        {selectedAlert.severity || 'N/A'}
                      </CBadge>
                    </div>
                  </div>
                </CCol>
                <CCol md={4}>
                  <div className="mb-3">
                    <CFormLabel>Priorité</CFormLabel>
                    <div>
                      <CBadge color={getPriorityColor(selectedAlert.priority)}>
                        {selectedAlert.priority || 'N/A'}
                      </CBadge>
                    </div>
                  </div>
                </CCol>
                <CCol md={4}>
                  <div className="mb-3">
                    <CFormLabel>Statut</CFormLabel>
                    <div>
                      <CBadge color={getStatusColor(selectedAlert.status)}>
                        {selectedAlert.status === 'open' ? 'Ouverte' : 
                         selectedAlert.status === 'resolved' ? 'Résolue' : 
                         selectedAlert.status === 'acknowledged' ? 'Acquittée' : selectedAlert.status}
                      </CBadge>
                    </div>
                  </div>
                </CCol>
              </CRow>
              <CRow>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Déclenchée le</CFormLabel>
                    <div className="form-control-plaintext">{formatDate(selectedAlert.triggeredAt)}</div>
                  </div>
                </CCol>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Résolue le</CFormLabel>
                    <div className="form-control-plaintext">{formatDate(selectedAlert.resolvedAt) || 'Non résolue'}</div>
                  </div>
                </CCol>
              </CRow>
              <div className="mb-3">
                <CFormLabel>Description</CFormLabel>
                <div className="form-control-plaintext">{selectedAlert.description || 'N/A'}</div>
              </div>
              <div className="mb-3">
                <CFormLabel>Commentaires</CFormLabel>
                <CFormTextarea rows={3} placeholder="Ajouter un commentaire..." />
              </div>
            </CForm>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setModalVisible(false)}>
            Fermer
          </CButton>
          {selectedAlert?.status === 'open' && (
            <CButton 
              color="success" 
              className="me-2"
              onClick={() => {
                handleAcknowledge(selectedAlert.alertId)
                setModalVisible(false)
              }}
            >
              <CIcon icon={cilCheckCircle} className="me-2" />
              Acquitter
            </CButton>
          )}
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
            Paramètres des Alertes
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel>Email de notification</CFormLabel>
              <CFormInput type="email" placeholder="admin@example.com" />
            </div>
            <div className="mb-3">
              <CFormLabel>Numéro de téléphone SMS</CFormLabel>
              <CFormInput type="tel" placeholder="+33 6 12 34 56 78" />
            </div>
            <div className="mb-3">
              <CFormLabel>URL Webhook</CFormLabel>
              <CFormInput type="url" placeholder="https://api.example.com/webhook" />
            </div>
            <div className="mb-3">
              <CFormLabel>Délai entre notifications (minutes)</CFormLabel>
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