import React from 'react'
import { AppContent, AppSidebar, AppHeader } from '../components/index'
import SpaceParticles from '../components/SpaceParticles'

const DefaultLayout = () => {
  return (
    <div>
      <SpaceParticles />
      <AppSidebar />
      <div className="wrapper d-flex flex-column min-vh-100">
        <AppHeader />
        <div className="body flex-grow-1">
          <AppContent />
        </div>
        {/* <AppFooter /> */}
      </div>
    </div>
  )
}

export default DefaultLayout
