import React, { useState } from 'react'
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
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilSearch, cilTrash, cilPencil, cilReload } from '@coreui/icons'

const Devices = () => {
  // Etat pour la modal d'ajout/modification
  const [visible, setVisible] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [devices, setDevices] = useState([
    {
      id: 1,
      name: 'Router-Core-01',
      type: 'Router',
      ip: '192.168.1.1',
      status: 'active',
      location: 'Salle serveurs',
      lastSeen: '2024-03-20 14:30:00',
    },
    {
      id: 2,
      name: 'Switch-Acces-01',
      type: 'Switch',
      ip: '192.168.1.2',
      status: 'warning',
      location: 'Etage 1',
      lastSeen: '2024-03-20 14:25:00',
    },
    {
      id: 3,
      name: 'AP-Wifi-01',
      type: 'Access Point',
      ip: '192.168.1.3',
      status: 'inactive',
      location: 'Rez-de-chaussée',
      lastSeen: '2024-03-20 13:45:00',
    },
  ])

  // Fonction pour filtrer les appareils
  const filteredDevices = devices.filter((device) =>
    Object.values(device).some((value) =>
      value.toString().toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  )

  // Fonction pour obtenir la couleur du badge selon le statut
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
              <h4 className="mb-0">Gestion des Appareils</h4>
            </CCol>
            <CCol xs="auto" className="ms-auto">
              <CButton color="primary" onClick={() => setVisible(true)}>
                <CIcon icon={cilPlus} className="me-2" />
                Ajouter un appareil
              </CButton>
            </CCol>
          </CRow>
        </CCardHeader>
        <CCardBody>
          <CInputGroup className="mb-3">
            <CInputGroupText>
              <CIcon icon={cilSearch} />
            </CInputGroupText>
            <CFormInput
              placeholder="Rechercher un appareil..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <CButton color="primary" variant="ghost" className="px-2">
              <CIcon icon={cilReload} />
            </CButton>
          </CInputGroup>

          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Nom</CTableHeaderCell>
                <CTableHeaderCell>Type</CTableHeaderCell>
                <CTableHeaderCell>Adresse IP</CTableHeaderCell>
                <CTableHeaderCell>Statut</CTableHeaderCell>
                <CTableHeaderCell>Emplacement</CTableHeaderCell>
                <CTableHeaderCell>Dernière vue</CTableHeaderCell>
                <CTableHeaderCell>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredDevices.map((device) => (
                <CTableRow key={device.id}>
                  <CTableDataCell>{device.name}</CTableDataCell>
                  <CTableDataCell>{device.type}</CTableDataCell>
                  <CTableDataCell>{device.ip}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={getStatusColor(device.status)}>{device.status}</CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{device.location}</CTableDataCell>
                  <CTableDataCell>{device.lastSeen}</CTableDataCell>
                  <CTableDataCell>
                    <CButton color="primary" variant="ghost" size="sm" className="me-2">
                      <CIcon icon={cilPencil} />
                    </CButton>
                    <CButton color="danger" variant="ghost" size="sm">
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      {/* Modal d'ajout/modification d'appareil */}
      <CModal visible={visible} onClose={() => setVisible(false)}>
        <CModalHeader>
          <CModalTitle>Ajouter un appareil</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <div className="mb-3">
              <CFormLabel>Nom de l'appareil</CFormLabel>
              <CFormInput type="text" placeholder="Entrez le nom" />
            </div>
            <div className="mb-3">
              <CFormLabel>Type d'appareil</CFormLabel>
              <CFormSelect>
                <option value="">Sélectionnez un type</option>
                <option value="router">Router</option>
                <option value="switch">Switch</option>
                <option value="ap">Access Point</option>
                <option value="firewall">Firewall</option>
                <option value="server">Serveur</option>
              </CFormSelect>
            </div>
            <div className="mb-3">
              <CFormLabel>Adresse IP</CFormLabel>
              <CFormInput type="text" placeholder="ex: 192.168.1.1" />
            </div>
            <div className="mb-3">
              <CFormLabel>Emplacement</CFormLabel>
              <CFormInput type="text" placeholder="ex: Salle serveurs" />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setVisible(false)}>
            Annuler
          </CButton>
          <CButton color="primary">Enregistrer</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Devices 