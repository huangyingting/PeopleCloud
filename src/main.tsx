import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppBoundary } from './components/AppBoundary'
import './styles.css'

// The display face is split into ~90 unicode-range subsets whose @font-face rules alone weigh 127 KB.
// Text already falls back while the subsets download (font-display: swap), so keep the rules off the critical path.
void import('@chinese-fonts/zqfs/dist/ZhuqueFangsong-Regular/result.css')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoundary><App /></AppBoundary>
  </StrictMode>,
)
