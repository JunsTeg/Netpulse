import React from 'react'
import { CToast, CToastBody, CToastHeader } from '@coreui/react'
import { addToast } from '../App'

// Fonction pour creer un toast
const createToast = (title, message, color = 'primary') => (
  <CToast color={color} className="text-white">
    <CToastHeader closeButton className="text-white">
      <strong className="me-auto">{title}</strong>
    </CToastHeader>
    <CToastBody>{message}</CToastBody>
  </CToast>
)

// Fonctions d'export
export const success = (title, message) => {
  addToast(title, message, 'success')
}

export const error = (title, message) => {
  addToast(title, message, 'danger')
}

export const info = (title, message) => {
  addToast(title, message, 'info')
}

export const warning = (title, message) => {
  addToast(title, message, 'warning')
}

export default {
  success,
  error,
  info,
  warning
} 