import React from 'react'
import { CCard, CCardBody, CCardHeader, CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell } from '@coreui/react'

const Notifications = () => {
  // Donnees de test
  const notifications = [
    { id: 1, date: '2024-03-20 15:00', message: 'Nouvelle alerte critique.' },
    { id: 2, date: '2024-03-20 15:05', message: 'Rapport hebdomadaire disponible.' },
  ]
  return (
    <CCard className="mb-4">
      <CCardHeader>Notifications</CCardHeader>
      <CCardBody>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Date</CTableHeaderCell>
              <CTableHeaderCell>Message</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {notifications.map((notif) => (
              <CTableRow key={notif.id}>
                <CTableDataCell>{notif.date}</CTableDataCell>
                <CTableDataCell>{notif.message}</CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
  )
}

export default Notifications 