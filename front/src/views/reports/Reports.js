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
  CFormDate,
  CFormCheck,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilFile,
  cilFilter,
  cilReload,
  cilDownload,
  cilTrash,
  cilPlus,
  cilChart,
  cilCalendar,
} from '@coreui/icons'

const Reports = () => {
  const [selectedType, setSelectedType] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [generateModalVisible, setGenerateModalVisible] = useState(false)

  // Donnees de test pour les rapports
  const reports = [
    {
      id: 1,
      name: 'Rapport Performance Hebdo',
      type: 'performance',
      period: '2024-03-13 au 2024-03-20',
      status: 'completed',
      generatedAt: '2024-03-20 15:00:00',
      description: 'Rapport hebdomadaire des performances reseau',
      format: 'PDF',
      size: '2.5 MB',
      metrics: ['latence', 'bande_passante', 'paquets_perdus'],
    },
    {
      id: 2,
      name: 'Rapport Securite Mensuel',
      type: 'security',
      period: '2024-02-20 au 2024-03-20',
      status: 'completed',
      generatedAt: '2024-03-20 14:30:00',
      description: 'Rapport mensuel de securite reseau',
      format: 'PDF',
      size: '3.1 MB',
      metrics: ['tentatives_intrusion', 'alertes_securite', 'vulnerabilites'],
    },
    {
      id: 3,
      name: 'Rapport Systeme Journalier',
      type: 'system',
      period: '2024-03-20',
      status: 'generating',
      generatedAt: '2024-03-20 16:00:00',
      description: 'Rapport journalier du systeme',
      format: 'PDF',
      size: '1.8 MB',
      metrics: ['utilisation_cpu', 'utilisation_memoire', 'utilisation_disque'],
    },
  ]

  // Fonction pour filtrer les rapports
  const filteredReports = reports.filter((report) => {
    const matchesType = selectedType === 'all' || report.type === selectedType
    const matchesSearch = Object.values(report).some((value) =>
      value.toString().toLowerCase().includes(searchTerm.toLowerCase()),
    )
    return matchesType && matchesSearch
  })

  // Fonction pour obtenir la couleur du badge selon le type
  const getTypeColor = (type) => {
    switch (type) {
      case 'performance':
        return 'info'
      case 'system':
        return 'warning'
      case 'security':
        return 'danger'
      default:
        return 'secondary'
    }
  }

  // Fonction pour obtenir la couleur du badge selon le statut
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'generating':
        return 'warning'
      case 'failed':
        return 'danger'
      default:
        return 'secondary'
    }
  }

  const handleReportClick = (report) => {
    setSelectedReport(report)
    setModalVisible(true)
  }

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader>
          <CRow className="align-items-center">
            <CCol xs="auto">
              <h4 className="mb-0">Rapports Reseau</h4>
            </CCol>
            <CCol xs="auto" className="ms-auto">
              <CButtonGroup>
                <CButton
                  color="primary"
                  variant="outline"
                  className="me-2"
                  onClick={() => setGenerateModalVisible(true)}
                >
                  <CIcon icon={cilPlus} className="me-2" />
                  Nouveau Rapport
                </CButton>
                <CButton color="primary" variant="outline">
                  <CIcon icon={cilReload} className="me-2" />
                  Actualiser
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
                  placeholder="Rechercher un rapport..."
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
                <CTableHeaderCell>Periode</CTableHeaderCell>
                <CTableHeaderCell>Statut</CTableHeaderCell>
                <CTableHeaderCell>Genere le</CTableHeaderCell>
                <CTableHeaderCell>Format</CTableHeaderCell>
                <CTableHeaderCell>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredReports.map((report) => (
                <CTableRow
                  key={report.id}
                  className="cursor-pointer"
                  onClick={() => handleReportClick(report)}
                >
                  <CTableDataCell>
                    <CIcon icon={cilFile} className="me-2" />
                    {report.name}
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={getTypeColor(report.type)}>
                      {report.type === 'performance'
                        ? 'Performance'
                        : report.type === 'system'
                        ? 'Systeme'
                        : 'Securite'}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{report.period}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={getStatusColor(report.status)}>
                      {report.status === 'completed'
                        ? 'Complete'
                        : report.status === 'generating'
                        ? 'En cours'
                        : 'Echoue'}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{report.generatedAt}</CTableDataCell>
                  <CTableDataCell>{report.format}</CTableDataCell>
                  <CTableDataCell>
                    <CButtonGroup>
                      <CButton
                        color="primary"
                        variant="ghost"
                        size="sm"
                        className="me-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Logique pour telecharger
                        }}
                      >
                        <CIcon icon={cilDownload} />
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

      {/* Modal de details du rapport */}
      <CModal visible={modalVisible} onClose={() => setModalVisible(false)} size="lg">
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilFile} className="me-2" />
            Details du Rapport
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedReport && (
            <CForm>
              <CRow>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Nom du rapport</CFormLabel>
                    <div className="form-control-plaintext">{selectedReport.name}</div>
                  </div>
                </CCol>
                <CCol md={6}>
                  <div className="mb-3">
                    <CFormLabel>Type</CFormLabel>
                    <div>
                      <CBadge color={getTypeColor(selectedReport.type)}>
                        {selectedReport.type === 'performance'
                          ? 'Performance'
                          : selectedReport.type === 'system'
                          ? 'Systeme'
                          : 'Securite'}
                      </CBadge>
                    </div>
                  </div>
                </CCol>
              </CRow>
              <div className="mb-3">
                <CFormLabel>Description</CFormLabel>
                <div className="form-control-plaintext">{selectedReport.description}</div>
              </div>
              <div className="mb-3">
                <CFormLabel>Periode</CFormLabel>
                <div className="form-control-plaintext">{selectedReport.period}</div>
              </div>
              <div className="mb-3">
                <CFormLabel>Metriques incluses</CFormLabel>
                <div>
                  {selectedReport.metrics.map((metric, index) => (
                    <CBadge color="info" className="me-2" key={index}>
                      {metric.replace('_', ' ')}
                    </CBadge>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <CFormLabel>Informations techniques</CFormLabel>
                <div className="form-control-plaintext">
                  Format: {selectedReport.format} | Taille: {selectedReport.size}
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
            <CIcon icon={cilDownload} className="me-2" />
            Telecharger
          </CButton>
          <CButton color="danger">
            <CIcon icon={cilTrash} className="me-2" />
            Supprimer
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal de generation de rapport */}
      <CModal visible={generateModalVisible} onClose={() => setGenerateModalVisible(false)}>
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilPlus} className="me-2" />
            Nouveau Rapport
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel>Type de rapport</CFormLabel>
              <CFormSelect
                options={[
                  { label: 'Performance', value: 'performance' },
                  { label: 'Systeme', value: 'system' },
                  { label: 'Securite', value: 'security' },
                ]}
              />
            </div>
            <div className="mb-3">
              <CFormLabel>Periode</CFormLabel>
              <CRow>
                <CCol md={6}>
                  <CFormDate label="Date de debut" />
                </CCol>
                <CCol md={6}>
                  <CFormDate label="Date de fin" />
                </CCol>
              </CRow>
            </div>
            <div className="mb-3">
              <CFormLabel>Metriques a inclure</CFormLabel>
              <div>
                <CFormCheck
                  type="checkbox"
                  id="latence"
                  label="Latence"
                  defaultChecked
                />
                <CFormCheck
                  type="checkbox"
                  id="bande_passante"
                  label="Bande passante"
                  defaultChecked
                />
                <CFormCheck
                  type="checkbox"
                  id="paquets_perdus"
                  label="Paquets perdus"
                  defaultChecked
                />
                <CFormCheck
                  type="checkbox"
                  id="utilisation_cpu"
                  label="Utilisation CPU"
                />
                <CFormCheck
                  type="checkbox"
                  id="utilisation_memoire"
                  label="Utilisation memoire"
                />
                <CFormCheck
                  type="checkbox"
                  id="alertes_securite"
                  label="Alertes securite"
                />
              </div>
            </div>
            <div className="mb-3">
              <CFormLabel>Format</CFormLabel>
              <CFormSelect
                options={[
                  { label: 'PDF', value: 'pdf' },
                  { label: 'Excel', value: 'excel' },
                  { label: 'CSV', value: 'csv' },
                ]}
              />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setGenerateModalVisible(false)}>
            Annuler
          </CButton>
          <CButton color="primary">
            <CIcon icon={cilChart} className="me-2" />
            Generer
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Reports 