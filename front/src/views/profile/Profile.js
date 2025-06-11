import React, { useState, useEffect } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CForm,
  CFormInput,
  CFormLabel,
  CButton,
  CSpinner,
  CAlert,
} from '@coreui/react'
import { cilSave, cilUser } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import authService from '../../services/auth.service'
import { success, error } from '../../services/notification.service'

const Profile = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState({
    username: '',
    email: '',
    createdAt: '',
    lastLoginAt: '',
  })
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [message, setMessage] = useState({ type: '', content: '' })

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const currentUser = authService.getCurrentUser()
      if (!currentUser) {
        throw new Error('Utilisateur non connecte')
      }

      const response = await authService.getProfile()
      setUser(response)
      setFormData({
        ...formData,
        username: response.username,
        email: response.email,
      })
    } catch (err) {
      setMessage({
        type: 'danger',
        content: 'Erreur lors du chargement du profil',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage({ type: '', content: '' })

    try {
      // Validation des mots de passe
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error('Les mots de passe ne correspondent pas')
        }
        if (!formData.currentPassword) {
          throw new Error('Le mot de passe actuel est requis')
        }
      }

      const updateData = {
        username: formData.username,
        email: formData.email,
      }

      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword
        updateData.newPassword = formData.newPassword
      }

      await authService.updateProfile(updateData)
      
      success('Profil mis a jour', 'Vos informations ont ete mises a jour avec succes')
      await fetchUserData()
      
      // Reinitialisation des champs de mot de passe
      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }))
    } catch (err) {
      setMessage({
        type: 'danger',
        content: err.message || 'Erreur lors de la mise a jour du profil',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>Profil Utilisateur</strong>
          </CCardHeader>
          <CCardBody>
            {message.content && (
              <CAlert color={message.type} className="mb-4">
                {message.content}
              </CAlert>
            )}

            <CForm onSubmit={handleSubmit}>
              <div className="mb-4">
                <CFormLabel>Nom d'utilisateur</CFormLabel>
                <CFormInput
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="mb-4">
                <CFormLabel>Email</CFormLabel>
                <CFormInput
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <hr className="my-4" />

              <h5 className="mb-4">Changer le mot de passe</h5>

              <div className="mb-4">
                <CFormLabel>Mot de passe actuel</CFormLabel>
                <CFormInput
                  type="password"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                />
              </div>

              <div className="mb-4">
                <CFormLabel>Nouveau mot de passe</CFormLabel>
                <CFormInput
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                />
              </div>

              <div className="mb-4">
                <CFormLabel>Confirmer le nouveau mot de passe</CFormLabel>
                <CFormInput
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                />
              </div>

              <div className="d-grid gap-2">
                <CButton
                  type="submit"
                  color="primary"
                  disabled={saving}
                  className="d-flex align-items-center justify-content-center gap-2"
                >
                  {saving ? (
                    <CSpinner size="sm" />
                  ) : (
                    <>
                      <CIcon icon={cilSave} />
                      Enregistrer les modifications
                    </>
                  )}
                </CButton>
              </div>
            </CForm>

            <div className="mt-4">
              <h6>Informations du compte</h6>
              <p className="text-muted mb-1">
                Compte cree le: {new Date(user.createdAt).toLocaleDateString()}
              </p>
              {user.lastLoginAt && (
                <p className="text-muted">
                  Derniere connexion: {new Date(user.lastLoginAt).toLocaleString()}
                </p>
              )}
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default Profile 