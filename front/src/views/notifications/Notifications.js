import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CCardHeader, CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CButton } from '@coreui/react'
import axios from 'axios'
import authService from '../../services/auth.service'

const Notifications = () => {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const token = authService.getToken()
      authService.setAuthHeader(token)
      const response = await axios.get('/api/network/notifications', { headers: { Authorization: `Bearer ${token}` } })
      setNotifications(response.data.notifications || [])
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement des notifications: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNotifications() }, [])

  const markAsRead = async (id) => {
    try {
      const token = authService.getToken()
      authService.setAuthHeader(token)
      await axios.post(`/api/network/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } })
      fetchNotifications()
    } catch (err) {
      alert('Erreur lors du marquage comme lu : ' + (err.response?.data?.message || err.message))
    }
  }

  return (
    <CCard className="mb-4">
      <CCardHeader>Notifications</CCardHeader>
      <CCardBody>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Date</CTableHeaderCell>
              <CTableHeaderCell>Message</CTableHeaderCell>
              <CTableHeaderCell>Action</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow><CTableDataCell colSpan={3}>Chargement...</CTableDataCell></CTableRow>
            ) : error ? (
              <CTableRow><CTableDataCell colSpan={3}>{error}</CTableDataCell></CTableRow>
            ) : notifications.map((notif) => (
              <CTableRow key={notif.id} style={{ background: notif.isRead ? getComputedStyle(document.body).getPropertyValue('--color-bg-secondary-light').trim() || "#f1f5f9" : getComputedStyle(document.body).getPropertyValue('--color-info').trim() || "#06b6d4" + "20" }}>
                <CTableDataCell>{notif.createdAt ? new Date(notif.createdAt).toLocaleString() : ''}</CTableDataCell>
                <CTableDataCell>
                  {notif.link ? <a href={notif.link}>{notif.message}</a> : notif.message}
                </CTableDataCell>
                <CTableDataCell>
                  {!notif.isRead && <CButton size="sm" color="success" onClick={() => markAsRead(notif.id)}>Marquer comme lu</CButton>}
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
  )
}

export default Notifications 