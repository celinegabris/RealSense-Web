import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';

import './App.css';

function App() {
  // App state
  const [deviceId, setDeviceId] = useState(null);
  
  const [hoveredIndex, setHoveredIndex] = useState(null);

  //Feature cards content
  const features = [
    {
      title: "Live Camera Streaming",
      description: "View real-time RGB,Stereo and IMU.",
      image: "/images/depth.png"
    },
    {
      title: "Camera Controls",
      description: "Control camera settings directly from your browser.",
      image: "/images/sec.png"
    },
    {
      title: "Screenshot",
      description: "Capture snapshots of the live stream instantly.",
      image: "/images/play.png"
    },
    {
      title: "Comparison Mode",
      description: "Detect changes over two timestamps.",
      image: "/images/comparisonmode.png"
    },
    {
      title: "Selective Focus Mode",
      description: "Blur everything except the focused region.",
      image: "/images/focus.png"
    },
    {
      title: "Metadata Overview",
      description: "View live stream metadata at a glance.",
      image: "/images/control.png"
    },
    {
      title: "Streaming in 3D Mode",
      description: "View the live stream in immersive 3D.",
      image: "/images/3DMode.png"
    },
    {
      title: "IMU Axis Data Overview",
      description: "Display real-time X, Y, Z values and their norm for motion tracking.",
      image: "/images/IMUaxis.png"
    }
  ];

  const featuresRef = useRef(null);

  // Fetch first available device on load 
  useEffect(() => {
    fetch('http://localhost:8000/api/devices/')
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          setDeviceId(data[0].device_id);
        }
      })
      .catch(console.error);
  }, []);

  //animation for the features title 
  useEffect(() => {
    const el = featuresRef.current;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          el.classList.add('animate');
          setTimeout(() => {
            el.classList.remove('animate');
          }, 1000);
        }
      });
    }, { threshold: 0.5 });

    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  return (
    <>
      <div className="app-container">
        {/* ---------- Top navigation ---------- */}
        <header className="navbar">
          <div className="logo"> RealSense </div>
          <nav>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/live-viewer">Live Viewer</Link></li>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/faq">FAQ</Link></li>
            </ul>
          </nav>
        </header>

        {/* ---------- Hero ---------- */}
        <section className="hero-section">
          <div className="hero-text">
            <h1>Explore the world in 3D with RealSense Cameras</h1>
            <p>Experience depth and motion tracking capabilities directly within your browser.</p>
            <Link to="/live-viewer" className="start-streaming-btn">start streaming</Link>
          </div>

          <img
            src="/images/realsense-camera.png"
            alt="RealSense Camera"
            className="camera-image"
          />
        </section>

        {/* ---------- Features grid ---------- */}
        <section className="features-section">
          <h1 className="features-title" ref={featuresRef}>
            Discover What This Web Viewer Can Do
          </h1>

          <div className="features-grid-container">
            <div className="features-grid">
              {features.map((feature, i) => (
                <div
                  className="feature-box"
                  key={i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className={`feature-content ${hoveredIndex === i ? 'hovered' : ''}`}>
                    {hoveredIndex === i ? (
                      <div className="feature-hover-box">
                        <p>{feature.description}</p>
                      </div>
                    ) : (
                      <img src={feature.image} alt={feature.title} />
                    )}
                  </div>
                  <p className="each-feature-title">{feature.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Footer ---------- */}
        <footer className="contact-footer">
          Contact: your.email@example.com
        </footer>
      </div>
    </>
  );
}

export default App;
