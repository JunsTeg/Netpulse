import React, { Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { CSpinner, useColorModes, CToaster, CToast, CToastBody, CToastHeader } from '@coreui/react'
import './scss/style.scss'

// Containers
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))

// Pages
const Login = React.lazy(() => import('./views/pages/login/Login'))
const Register = React.lazy(() => import('./views/pages/register/Register'))
const Page404 = React.lazy(() => import('./views/pages/page404/Page404'))
const Page500 = React.lazy(() => import('./views/pages/page500/Page500'))

// Components
const ProtectedRoute = React.lazy(() => import('./components/ProtectedRoute'))

// Reference globale pour le toast
export const addToast = (title, message, color = 'primary') => {
  const toast = (
    <CToast color={color} className="text-white">
      <CToastHeader closeButton className="text-white">
        <strong className="me-auto">{title}</strong>
      </CToastHeader>
      <CToastBody>{message}</CToastBody>
    </CToast>
  )
  window.dispatchEvent(new CustomEvent('show-toast', { detail: toast }))
}

// Exposer addToast globalement
window.addToast = addToast;

const App = () => {
  const { isColorModeSet, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const storedTheme = useSelector((state) => state.theme)
  const [toast, setToast] = useState(0)

  useEffect(() => {
    const handleShowToast = (event) => {
      setToast(event.detail)
    }

    window.addEventListener('show-toast', handleShowToast)
    return () => window.removeEventListener('show-toast', handleShowToast)
  }, [])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.href.split('?')[1])
    const theme = urlParams.get('theme') && urlParams.get('theme').match(/^[A-Za-z0-9\s]+/)[0]
    if (theme) {
      setColorMode(theme)
    }

    if (isColorModeSet()) {
      return
    }

    setColorMode(storedTheme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <CToaster 
        push={toast}
        placement="top-end"
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999 }}
      />
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="pt-3 text-center">
              <CSpinner color="primary" variant="grow" />
            </div>
          }
        >
          <Routes>
            <Route exact path="/login" name="Login Page" element={<Login />} />
            <Route exact path="/register" name="Register Page" element={<Register />} />
            <Route exact path="/404" name="Page 404" element={<Page404 />} />
            <Route exact path="/500" name="Page 500" element={<Page500 />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route 
              path="*" 
              name="Home" 
              element={
                <ProtectedRoute>
                  <DefaultLayout />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  )
}

export default App
