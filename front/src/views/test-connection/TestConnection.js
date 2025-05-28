import React, { useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormTextarea,
  CRow,
  CAlert,
} from '@coreui/react'
import apiService from '../../services/api.service'

const TestConnection = () => {
  const [getResponse, setGetResponse] = useState(null)
  const [postResponse, setPostResponse] = useState(null)
  const [error, setError] = useState(null)
  const [testData, setTestData] = useState('')

  // Test de la requete GET
  const testGetConnection = async () => {
    try {
      setError(null)
      const response = await apiService.get('/api/test')
      setGetResponse(response)
    } catch (err) {
      setError(`Erreur GET: ${err.message}`)
    }
  }

  // Test de la requete POST
  const testPostConnection = async (e) => {
    e.preventDefault()
    try {
      setError(null)
      const response = await apiService.post('/api/test', { message: testData })
      setPostResponse(response)
    } catch (err) {
      setError(`Erreur POST: ${err.message}`)
    }
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>Test de Connexion API</strong>
          </CCardHeader>
          <CCardBody>
            {error && (
              <CAlert color="danger" dismissible>
                {error}
              </CAlert>
            )}

            {/* Test GET */}
            <div className="mb-4">
              <h5>Test GET</h5>
              <CButton color="primary" onClick={testGetConnection}>
                Tester la connexion GET
              </CButton>
              {getResponse && (
                <pre className="mt-3 p-3 bg-light">
                  {JSON.stringify(getResponse, null, 2)}
                </pre>
              )}
            </div>

            {/* Test POST */}
            <div>
              <h5>Test POST</h5>
              <CForm onSubmit={testPostConnection}>
                <CFormTextarea
                  label="Message de test"
                  value={testData}
                  onChange={(e) => setTestData(e.target.value)}
                  placeholder="Entrez un message de test..."
                  rows={3}
                  className="mb-3"
                />
                <CButton type="submit" color="primary">
                  Envoyer les donnees
                </CButton>
              </CForm>
              {postResponse && (
                <pre className="mt-3 p-3 bg-light">
                  {JSON.stringify(postResponse, null, 2)}
                </pre>
              )}
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default TestConnection 