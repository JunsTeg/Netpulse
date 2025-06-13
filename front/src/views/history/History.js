import React from 'react'
import { CCard, CCardBody, CCardHeader, CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell } from '@coreui/react'

const History = () => {
  // Donnees de test
  const history = [
    { id: 1, date: '2024-03-19', event: 'Ajout d\'un nouvel appareil' },
    { id: 2, date: '2024-03-20', event: 'Alerte resolue' },
    { id: 3, date: '2024-03-20', event: 'Modification des parametres' },
  ]
  return (
    <CCard className="mb-4">
      <CCardHeader>Historique</CCardHeader>
      <CCardBody>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Date</CTableHeaderCell>
              <CTableHeaderCell>Evenement</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {history.map((item) => (
              <CTableRow key={item.id}>
                <CTableDataCell>{item.date}</CTableDataCell>
                <CTableDataCell>{item.event}</CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
  )
}

export default History 