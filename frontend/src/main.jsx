import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import './index.css';
import './styles/global.css';
import './styles/variables.css';

// Pages 
import App from './App.jsx';
import LiveViewer from './pages/liveViewer.jsx';
import About from './pages/about.jsx';
import FAQ from './pages/FAQ.jsx';

//Mount & routes
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/live-viewer" element={<LiveViewer />} />
        <Route path="/about" element={<About />} />
        <Route path="/faq" element={<FAQ />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
