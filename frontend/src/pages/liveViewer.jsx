import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import DeviceList from '../components/DeviceList.jsx';
import PointCloudViewer from '../components/PointCloudViewer.jsx';
import socket from '../utils/socket.js';
import '../styles/LiveViewer.css';

function LiveViewer() {
  const [deviceId, setDeviceId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [infrared1On, setInfrared1On] = useState(false);
  const [infrared2On, setInfrared2On] = useState(false);
  const [depthOn, setDepthOn] = useState(false);
  const [isIMUStreaming, setIsIMUStreaming] = useState(false);
  const [metadata, setMetadata] = useState({});
  const [videoBoxes, setVideoBoxes] = useState([]);
  const [showPointCloud, setShowPointCloud] = useState(false);

const totalBoxes =
  videoBoxes.length +
  (isStreaming ? 1 : 0) +
  (infrared1On ? 1 : 0) +
  (infrared2On ? 1 : 0) +
  (depthOn ? 1 : 0) +
  (isIMUStreaming ? 2 : 0); 

const gridClass = totalBoxes <= 1 ? 'one' : totalBoxes === 2 ? 'two' : 'multi';


  const videoRefs = useRef({});

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

  useEffect(() => {
    const handleMetadata = (data) => {
      setMetadata(data.metadata_streams || {});
    };
    socket.on('metadata_update', handleMetadata);
    return () => socket.off('metadata_update', handleMetadata);
  }, []);


  const togglePointCloud = async () => {
    if (!deviceId) return;
    const url = showPointCloud ? 'deactivate' : 'activate';
    try {
      const res = await fetch(
         `http://localhost:8000/api/devices/${deviceId}/point_cloud/${url}`,
         { method: 'POST' }
      );
      if (!res.ok) throw new Error(`Point cloud ${url} failed`);

      
      socket.emit('toggle_3d', {
        device_id: deviceId,
        enabled: !showPointCloud
      });
      setShowPointCloud(prev => !prev);
    } catch (err) {
       console.error(err);
       alert('Failed to toggle 3D Viewer.');
    }
  };

  return (
    <>
      <div className="page-viewer">
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

        <section className="viewer-layout">
          <aside className="sidebar">
            <DeviceList
              deviceId={deviceId}
              onDeviceSelect={(id) => setDeviceId(id)}
              videoRefs={videoRefs}
              onStreamStart={() => setIsStreaming(true)}
              onStreamStop={() => setIsStreaming(false)}
              onStereoStart={(status) => {
                setInfrared1On(!!status['infrared-1']);
                setInfrared2On(!!status['infrared-2']);
                setDepthOn(!!status['depth']);
              }}
              onStereoStop={() => {
                setInfrared1On(false);
                setInfrared2On(false);
                setDepthOn(false);
              }}
              onIMUStart={() => setIsIMUStreaming(true)}
              onIMUStop={() => setIsIMUStreaming(false)}
              setVideoBoxes={setVideoBoxes}
              metadata={metadata}
            />
           
          </aside>

          <main className="stream-area">
            <div className="stream-area-wrapper">
    <div className="pointcloud-toggle-button">

          <button className="stream-toggle-btn" onClick={togglePointCloud}>
              {showPointCloud ? '🟢 3D ' : '🔴 3D '}
            </button>
  </div>
            <div className={`streams-grid ${gridClass}`}>
              {videoBoxes}
            </div>

            {deviceId && showPointCloud && <PointCloudViewer deviceId={deviceId} />}
            {deviceId && videoBoxes.length === 0 && !showPointCloud && (
              <div className="stream-placeholder">
                Nothing is streaming! <span className="hint">Toggle ▶ to start</span>
              </div>
            )}
            
</div>
          </main>
        </section>
      </div>

      <footer className="footer">
        RealSense Viewer © 2025 | Powered by RealSense™ SDK
      </footer>
        <footer className="contact-footer">
        Contact: your.email@example.com
      </footer>
    </>
  );
}

export default LiveViewer;
