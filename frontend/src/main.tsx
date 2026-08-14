import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { AppConfigProvider } from './lib/appConfig'
import { AuthProvider } from './lib/auth'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppConfigProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppConfigProvider>
    </BrowserRouter>
  </StrictMode>,
)
