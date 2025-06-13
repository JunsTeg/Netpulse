import React from 'react'
import { CCard, CCardBody, CCardHeader, CForm, CFormLabel, CFormInput, CButton } from '@coreui/react'

const Thresholds = () => {
  return (
    <CCard className="mb-4">
      <CCardHeader>Seuils d'alerte</CCardHeader>
      <CCardBody>
        <CForm>
          <div className="mb-3">
            <CFormLabel>Seuil de latence (ms)</CFormLabel>
            <CFormInput type="number" placeholder="100" />
          </div>
          <div className="mb-3">
            <CFormLabel>Seuil de perte de paquets (%)</CFormLabel>
            <CFormInput type="number" placeholder="2" />
          </div>
          <CButton color="primary">Enregistrer</CButton>
        </CForm>
      </CCardBody>
    </CCard>
  )
}

export default Thresholds 