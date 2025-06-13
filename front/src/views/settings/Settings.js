import React from 'react'
import { CCard, CCardBody, CCardHeader, CForm, CFormLabel, CFormInput, CButton } from '@coreui/react'

const Settings = () => {
  return (
    <CCard className="mb-4">
      <CCardHeader>Parametres</CCardHeader>
      <CCardBody>
        <CForm>
          <div className="mb-3">
            <CFormLabel>Nom de l\'organisation</CFormLabel>
            <CFormInput type="text" placeholder="Netpulse" />
          </div>
          <div className="mb-3">
            <CFormLabel>Email de contact</CFormLabel>
            <CFormInput type="email" placeholder="contact@netpulse.com" />
          </div>
          <CButton color="primary">Enregistrer</CButton>
        </CForm>
      </CCardBody>
    </CCard>
  )
}

export default Settings 