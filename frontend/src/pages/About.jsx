import '../styles/about.css';  
import { Link } from 'react-router-dom';
import symbol from '../../public/images/RS.png';


function About() {
  return (
     <div className="page">
    <div className="page-container">
     
      <header className="navbar">
        <div className="logo">RealSense</div>
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/live-viewer">Live Viewer</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
          </ul>
        </nav>
      </header>

      {/* About Section */}
      <div className="about-container">
        <div className="about-content">
          <h1>About This Web</h1>
            <p className="intro">
              This project is a web-based interface for <strong>RealSense</strong> cameras that lets you
              view, monitor, and configure devices directly in your browser. It provides real-time RGB, Stereo and IMU streams. The aim is
              to make RealSense setup, testing, and analysis fast and accessible from anywhere—without installing
              desktop software.
            </p>
                    
        </div>

       
      </div>
    </div>
    </div>
  );
}

export default About;
