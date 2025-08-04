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
  cilWarning,
  cilFilter,
  cilReload,
  cilCheckCircle,
  cilXCircle,
  cilInfo,
  cilTrash,
} from '@coreui/icons'
import apiService from '../../services/api.service'

const Anomalies = () => {
  const [selectedSeverity, setSelectedSeverity] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAnomaly, setSelectedAnomaly] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [anomalies, setAnomalies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Fonction pour charger les anomalies depuis l'API
  const loadAnomalies = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await apiService.get('/api/mvp-stats/anomalies?limit=500')
      
      if (response.status === 'success' && response.data) {
        setAnomalies(response.data)
      } else {
        throw new Error(response.message || 'Erreur lors de la récupération des anomalies')
      }
    } catch (err) {
      console.error('Erreur chargement anomalies:', err)
      setError('Erreur lors du chargement des anomalies: ' + err.message)
      setAnomalies([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Charger les anomalies au montage du composant
  useEffect(() => {
    loadAnomalies()
  }, [])

  // Fonction pour filtrer les anomalies
  const filteredAnomalies = anomalies.filter((anomaly) => {
    const matchesSeverity = selectedSeverity === 'all' || anomaly.severity === selectedSeverity
    const matchesSearch = 
      anomaly.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      anomaly.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      anomaly.hostname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      anomaly.ipAddress?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSeverity && matchesSearch
  })

  // Fonction pour obtenir la couleur du badge selon la severite
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'danger'
      case 'warning':
        return 'warning'
      case 'info':
        return 'info'
      default:
        return 'secondary'
    }
  }

  // Fonction pour obtenir le texte de la severite
  const getSeverityText = (severity) => {
    switch (severity) {
      case 'critical':
        return 'Critique'
      case 'warning':
        return 'Avertissement'
      case 'info':
        return 'Information'
      default:
        return severity
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

  const handleAnomalyClick = (anomaly) => {
    setSelectedAnomaly(anomaly)
    setModalVisible(true)
  }

  const handleRefresh = () => {
    loadAnomalies(true)
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
              <h4 className="mb-0">Anomalies MVP</h4>
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
            <CCol md={4}>
              <CFormSelect
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                options={[
                  { label: 'Toutes les sévérités', value: 'all' },
                  { label: 'Critique', value: 'critical' },
                  { label: 'Avertissement', value: 'warning' },
                  { label: 'Information', value: 'info' },
                ]}
              />
            </CCol>
            <CCol md={8}>
              <CInputGroup>
                <CInputGroupText>
                  <CIcon icon={cilFilter} />
                </CInputGroupText>
                <CFormInput
                  placeholder="Rechercher une anomalie..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </CInputGroup>
            </CCol>
          </CRow>

          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Type</CTableHeaderCell>
                <CTableHeaderCell>Appareil</CTableHeaderCell>
                <CTableHeaderCell>Sévérité</CTableHeaderCell>
                <CTableHeaderCell>Valeur</CTableHeaderCell>
                <CTableHeaderCell>Seuil</CTableHeaderCell>
                <CTableHeaderCell>Date/Heure</CTableHeaderCell>
                <CTableHeaderCell>Message</CTableHeaderCell>
                <CTableHeaderCell>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredAnomalies.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={8} className="text-center">
                    {anomalies.length === 0 ? 'Aucune anomalie trouvée' : 'Aucune anomalie ne correspond aux critères de recherche'}
                  </CTableDataCell>
                </CTableRow>
              ) : (
                filteredAnomalies.map((anomaly) => (
                  <CTableRow
                    key={anomaly.id}
                    className="cursor-pointer"
                    onClick={() => handleAnomalyClick(anomaly)}
                  >
                    <CTableDataCell>
                      <CIcon icon={cilWarning} className="me-2" />
                      {anomaly.type}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div>
                        <div className="fw-semibold">{anomaly.hostname || 'N/A'}</div>
                        <small className="text-muted">{anomaly.ipAddress || 'N/A'}</small>
                      </div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getSeverityColor(anomaly.severity)}>
                        {getSeverityText(anomaly.severity)}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <span className="fw-semibold">{anomaly.currentValue}</span>
                    </CTableDataCell>
                    <CTableDataCell>
                      <span className="text-muted">{anomaly.threshold}</span>
                    </CTableDataCell>
                    <CTableDataCell>{formatDate(anomaly.timestamp)}</CTableDataCell>
                    <CTableDataCell>
                      <div className="text-truncate" style={{ maxWidth: '200px' }}>
                        {anomaly.message}
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
                            handleAnomalyClick(anomaly)
                          }}
                        >
                          <CIcon icon={cilInfo} />
                        </CButton>
                        <CButton
                          color="success"
                          variant="ghost"
                          size="sm"
                          className="me-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            // TODO: Implémenter la résolution d'anomalie
                          }}
                        >
                          <CIcon icon={cilCheckCircle} />
                        </CButton>
                        <CButton
                          color="danger"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            // TODO: Implémenter la suppression d'anomalie
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

      {/* Modal de details d'anomalie */}
      <CModal visible={modalVisible} onClose={() => setModalVisible(false)} size="lg">
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilWarning} className="me-2" />
            Détails de l'Anomalie
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedAnomaly && (
            <CForm>
              <CRow>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Type d'anomalie</CFormLabel>
                    <div className="form-control-plaintext">{selectedAnomaly.type}</div>
                  </div>
                </CCol>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Appareil</CFormLabel>
                    <div className="form-control-plaintext">
                      {selectedAnomaly.hostname || 'N/A'} ({selectedAnomaly.ipAddress || 'N/A'})
                    </div>
                  </div>
                </CCol>
              </CRow>
              <CRow>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Sévérité</CFormLabel>
                    <div>
                      <CBadge color={getSeverityColor(selectedAnomaly.severity)}>
                        {getSeverityText(selectedAnomaly.severity)}
                      </CBadge>
                    </div>
                  </div>
                </CCol>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Date de détection</CFormLabel>
                    <div className="form-control-plaintext">{formatDate(selectedAnomaly.timestamp)}</div>
                  </div>
                </CCol>
              </CRow>
              <CRow>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Valeur actuelle</CFormLabel>
                    <div className="form-control-plaintext fw-semibold">{selectedAnomaly.currentValue}</div>
                  </div>
                </CCol>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Seuil déclencheur</CFormLabel>
                    <div className="form-control-plaintext">{selectedAnomaly.threshold}</div>
                  </div>
                </CCol>
              </CRow>
              <div className="mb-3">
                <CFormLabel>Message d'anomalie</CFormLabel>
                <div className="form-control-plaintext">{selectedAnomaly.message}</div>
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
          <CButton color="success" className="me-2">
            <CIcon icon={cilCheckCircle} className="me-2" />
            Marquer comme résolu
          </CButton>
          <CButton color="danger">
            <CIcon icon={cilTrash} className="me-2" />
            Supprimer
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Anomalies 