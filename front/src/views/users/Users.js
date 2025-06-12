import React, { useState, useEffect } from 'react'
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
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormInput,
  CFormLabel,
  CSpinner,
  CAlert,
} from '@coreui/react'
import { cilPencil, cilTrash, cilPlus } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import userService from '../../services/user.service'
import { success, error } from '../../services/notification.service'

const Users = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' ou 'edit'
  const [selectedUser, setSelectedUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  })
  const [alertMessage, setAlertMessage] = useState({ type: '', content: '' })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await userService.getAllUsers()
      setUsers(data)
    } catch (err) {
      setAlertMessage({
        type: 'danger',
        content: 'Erreur lors du chargement des utilisateurs',
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

  const openCreateModal = () => {
    setModalMode('create')
    setFormData({
      username: '',
      email: '',
      password: '',
    })
    setModalVisible(true)
  }

  const openEditModal = (user) => {
    setModalMode('edit')
    setSelectedUser(user)
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
    })
    setModalVisible(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAlertMessage({ type: '', content: '' })

    try {
      if (modalMode === 'create') {
        await userService.createUser(formData)
        success('Utilisateur cree', 'L\'utilisateur a ete cree avec succes')
      } else {
        await userService.updateUser(selectedUser.id, formData)
        success('Utilisateur modifie', 'L\'utilisateur a ete modifie avec succes')
      }
      setModalVisible(false)
      loadUsers()
    } catch (err) {
      setAlertMessage({
        type: 'danger',
        content: err.message || 'Une erreur est survenue',
      })
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Etes-vous sur de vouloir supprimer cet utilisateur ?')) {
      try {
        await userService.deleteUser(id)
        success('Utilisateur supprime', 'L\'utilisateur a ete supprime avec succes')
        loadUsers()
      } catch (err) {
        error('Erreur', err.message || 'Erreur lors de la suppression')
      }
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
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <strong>Gestion des Utilisateurs</strong>
            <CButton color="primary" onClick={openCreateModal}>
              <CIcon icon={cilPlus} className="me-2" />
              Nouvel Utilisateur
            </CButton>
          </CCardHeader>
          <CCardBody>
            {alertMessage.content && (
              <CAlert color={alertMessage.type} className="mb-3">
                {alertMessage.content}
              </CAlert>
            )}

            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>ID</CTableHeaderCell>
                  <CTableHeaderCell>Nom d'utilisateur</CTableHeaderCell>
                  <CTableHeaderCell>Email</CTableHeaderCell>
                  <CTableHeaderCell>Date de creation</CTableHeaderCell>
                  <CTableHeaderCell>Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {users.map((user) => (
                  <CTableRow key={user.id}>
                    <CTableDataCell>{user.id}</CTableDataCell>
                    <CTableDataCell>{user.username}</CTableDataCell>
                    <CTableDataCell>{user.email}</CTableDataCell>
                    <CTableDataCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButton
                        color="primary"
                        variant="ghost"
                        className="me-2"
                        onClick={() => openEditModal(user)}
                      >
                        <CIcon icon={cilPencil} />
                      </CButton>
                      <CButton
                        color="danger"
                        variant="ghost"
                        onClick={() => handleDelete(user.id)}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>

      <CModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <CModalHeader>
          <CModalTitle>
            {modalMode === 'create' ? 'Nouvel Utilisateur' : 'Modifier Utilisateur'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm onSubmit={handleSubmit}>
            <div className="mb-3">
              <CFormLabel>Nom d'utilisateur</CFormLabel>
              <CFormInput
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="mb-3">
              <CFormLabel>Email</CFormLabel>
              <CFormInput
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="mb-3">
              <CFormLabel>
                {modalMode === 'create' ? 'Mot de passe' : 'Nouveau mot de passe (optionnel)'}
              </CFormLabel>
              <CFormInput
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required={modalMode === 'create'}
              />
            </div>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setModalVisible(false)}>
            Annuler
          </CButton>
          <CButton color="primary" onClick={handleSubmit}>
            {modalMode === 'create' ? 'Creer' : 'Modifier'}
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}

export default Users 