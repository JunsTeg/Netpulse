import React from 'react'
import { CCard, CCardBody, CCardHeader, CForm, CFormLabel, CFormTextarea, CButton } from '@coreui/react'

const Feedback = () => {
  return (
    <CCard className="mb-4">
      <CCardHeader>Feedback alertes</CCardHeader>
      <CCardBody>
        <CForm>
          <div className="mb-3">
            <CFormLabel>Votre retour</CFormLabel>
            <CFormTextarea rows={4} placeholder="Decrivez votre experience ou signalez un probleme..." />
          </div>
          <CButton color="primary">Envoyer</CButton>
        </CForm>
      </CCardBody>
    </CCard>
  )
}

export default Feedback 