import React, { useState } from 'react'
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

const Anomalies = () => {
  const [selectedSeverity, setSelectedSeverity] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAnomaly, setSelectedAnomaly] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)

  // Donnees de test pour les anomalies
  const anomalies = [
    {
      id: 1,
      type: 'Latence elevee',
      device: 'Router-Core',
      severity: 'high',
      status: 'active',
      timestamp: '2024-03-20 14:30:00',
      description: 'Latence anormalement elevee detectee sur le routeur principal',
      details: 'La latence moyenne a depasse 100ms pendant plus de 5 minutes',
    },
    {
      id: 2,
      type: 'Perte de paquets',
      device: 'Switch-Acces-01',
      severity: 'medium',
      status: 'active',
      timestamp: '2024-03-20 14:25:00',
      description: 'Taux de perte de paquets anormalement eleve',
      details: 'Taux de perte de paquets de 2.5% detecte sur le switch',
    },
    {
      id: 3,
      type: 'Trafic suspect',
      device: 'AP-Wifi-01',
      severity: 'low',
      status: 'resolved',
      timestamp: '2024-03-20 13:45:00',
      description: 'Activite reseau suspecte detectee',
      details: 'Pic de trafic anormal detecte sur le point d\'acces WiFi',
    },
  ]

  // Fonction pour filtrer les anomalies
  const filteredAnomalies = anomalies.filter((anomaly) => {
    const matchesSeverity = selectedSeverity === 'all' || anomaly.severity === selectedSeverity
    const matchesSearch = Object.values(anomaly).some((value) =>
      value.toString().toLowerCase().includes(searchTerm.toLowerCase()),
    )
    return matchesSeverity && matchesSearch
  })

  // Fonction pour obtenir la couleur du badge selon la severite
  const getSeverityColor = (severity) => {
    switch (severity) {
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
      case 'active':
        return 'danger'
      case 'investigating':
        return 'warning'
      case 'resolved':
        return 'success'
      default:
        return 'secondary'
    }
  }

  const handleAnomalyClick = (anomaly) => {
    setSelectedAnomaly(anomaly)
    setModalVisible(true)
  }

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader>
          <CRow className="align-items-center">
            <CCol xs="auto">
              <h4 className="mb-0">Anomalies Reseau</h4>
            </CCol>
            <CCol xs="auto" className="ms-auto">
              <CButton color="primary" variant="outline">
                <CIcon icon={cilReload} className="me-2" />
                Actualiser
              </CButton>
            </CCol>
          </CRow>
        </CCardHeader>
        <CCardBody>
          <CRow className="mb-3">
            <CCol md={4}>
              <CFormSelect
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                options={[
                  { label: 'Toutes les severites', value: 'all' },
                  { label: 'Haute', value: 'high' },
                  { label: 'Moyenne', value: 'medium' },
                  { label: 'Basse', value: 'low' },
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
                <CTableHeaderCell>Severite</CTableHeaderCell>
                <CTableHeaderCell>Statut</CTableHeaderCell>
                <CTableHeaderCell>Date/Heure</CTableHeaderCell>
                <CTableHeaderCell>Description</CTableHeaderCell>
                <CTableHeaderCell>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredAnomalies.map((anomaly) => (
                <CTableRow
                  key={anomaly.id}
                  className="cursor-pointer"
                  onClick={() => handleAnomalyClick(anomaly)}
                >
                  <CTableDataCell>
                    <CIcon icon={cilWarning} className="me-2" />
                    {anomaly.type}
                  </CTableDataCell>
                  <CTableDataCell>{anomaly.device}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={getSeverityColor(anomaly.severity)}>
                      {anomaly.severity === 'high'
                        ? 'Haute'
                        : anomaly.severity === 'medium'
                        ? 'Moyenne'
                        : 'Basse'}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={getStatusColor(anomaly.status)}>
                      {anomaly.status === 'active'
                        ? 'Active'
                        : anomaly.status === 'investigating'
                        ? 'En cours'
                        : 'Resolue'}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{anomaly.timestamp}</CTableDataCell>
                  <CTableDataCell>{anomaly.description}</CTableDataCell>
                  <CTableDataCell>
                    <CButtonGroup>
                      <CButton
                        color="success"
                        variant="ghost"
                        size="sm"
                        className="me-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Logique pour marquer comme resolu
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
                          // Logique pour supprimer
                        }}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </CButtonGroup>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      {/* Modal de details d'anomalie */}
      <CModal visible={modalVisible} onClose={() => setModalVisible(false)} size="lg">
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilWarning} className="me-2" />
            Details de l'Anomalie
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
                    <div className="form-control-plaintext">{selectedAnomaly.device}</div>
                  </div>
                </CCol>
              </CRow>
              <CRow>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Severite</CFormLabel>
                    <div>
                      <CBadge color={getSeverityColor(selectedAnomaly.severity)}>
                        {selectedAnomaly.severity === 'high'
                          ? 'Haute'
                          : selectedAnomaly.severity === 'medium'
                          ? 'Moyenne'
                          : 'Basse'}
                      </CBadge>
                    </div>
                  </div>
                </CCol>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Statut</CFormLabel>
                    <div>
                      <CBadge color={getStatusColor(selectedAnomaly.status)}>
                        {selectedAnomaly.status === 'active'
                          ? 'Active'
                          : selectedAnomaly.status === 'investigating'
                          ? 'En cours'
                          : 'Resolue'}
                      </CBadge>
                    </div>
                  </div>
                </CCol>
              </CRow>
              <div className="mb-3">
                <CFormLabel>Description</CFormLabel>
                <div className="form-control-plaintext">{selectedAnomaly.description}</div>
              </div>
              <div className="mb-3">
                <CFormLabel>Details</CFormLabel>
                <div className="form-control-plaintext">{selectedAnomaly.details}</div>
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
            Marquer comme resolu
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