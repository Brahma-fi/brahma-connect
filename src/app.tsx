import React from 'react'
import { createRoot } from 'react-dom/client'
import 'react-toastify/dist/ReactToastify.css'

import Browser from './browser'
import ProvideProvider from './browser/ProvideProvider'
import { ProvideConsoleHypervisor } from './providers'

const Routes: React.FC = () => {
  return (
    <>
      <Browser />
    </>
  )
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('invariant violation')
rootEl.style.height ='100%'
const root = createRoot(rootEl)

root.render(
  <React.StrictMode>
    <ProvideConsoleHypervisor>
      <ProvideProvider simulate>
        <Routes />
      </ProvideProvider>
    </ProvideConsoleHypervisor>
  </React.StrictMode>
)
