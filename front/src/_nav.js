import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilHome,
  cilDevices,
  cilChartPie,
  cilBarChart,
  cilWarning,
  cilBell,
  cilList,
  cilHistory,
  cilUser,
  cilSettings,
  cilSpeedometer,
  cilBellExclamation,
  cilCommentSquare,
  cilFile,
} from '@coreui/icons'
import { CNavGroup, CNavItem, CNavTitle } from '@coreui/react'

const _nav = [
  {
    component: CNavTitle,
    name: 'Tableau de bord',
  },
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/dashboard',
    icon: <CIcon icon={cilHome} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Reseau',
  },
  {
    component: CNavGroup,
    name: 'Reseau',
    icon: <CIcon icon={cilChartPie} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Appareils',
        to: '/devices',
        icon: <CIcon icon={cilDevices} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Topologie',
        to: '/topology',
        icon: <CIcon icon={cilChartPie} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Statistiques',
        to: '/network-stats',
        icon: <CIcon icon={cilBarChart} customClassName="nav-icon" />,
      },
    ],
  },
  {
    component: CNavTitle,
    name: 'Surveillance',
  },
  {
    component: CNavGroup,
    name: 'Surveillance',
    icon: <CIcon icon={cilWarning} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Anomalies',
        to: '/anomalies',
        icon: <CIcon icon={cilWarning} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Alertes',
        to: '/alerts',
        icon: <CIcon icon={cilBell} customClassName="nav-icon" />,
      },
    ],
  },
  {
    component: CNavTitle,
    name: 'Logs',
  },
  {
    component: CNavGroup,
    name: 'Logs',
    icon: <CIcon icon={cilList} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Logs reseau',
        to: '/logs',
        icon: <CIcon icon={cilList} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Historique',
        to: '/history',
        icon: <CIcon icon={cilHistory} customClassName="nav-icon" />,
      },
    ],
  },
  {
    component: CNavTitle,
    name: 'Administration',
  },
  {
    component: CNavGroup,
    name: 'Administration',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Utilisateurs',
        to: '/users',
        icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Parametres',
        to: '/settings',
        icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Seuils dalerte',
        to: '/thresholds',
        icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
      },
    ],
  },
  {
    component: CNavTitle,
    name: 'Audit & Feedback',
  },
  {
    component: CNavGroup,
    name: 'Audit & Feedback',
    icon: <CIcon icon={cilBellExclamation} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Notifications',
        to: '/notifications',
        icon: <CIcon icon={cilBellExclamation} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Feedback alertes',
        to: '/feedback',
        icon: <CIcon icon={cilCommentSquare} customClassName="nav-icon" />,
      },
      {
        component: CNavItem,
        name: 'Rapports',
        to: '/reports',
        icon: <CIcon icon={cilFile} customClassName="nav-icon" />,
      },
    ],
  },
]

export default _nav
