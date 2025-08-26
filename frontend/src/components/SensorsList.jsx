import { useEffect, useState } from 'react';
import '../styles/sensorsList.css';
import SensorOptionsPanel from './SensorOptionsPanel.jsx';

function SensorsList({ deviceId, filter }) {
  const [sensors, setSensors] = useState([]);
  const [expandedSensorId, setExpandedSensorId] = useState(null);
  const [sensorOptions, setSensorOptions] = useState({});
  const [loadingOptions, setLoadingOptions] = useState({});
  const [optionsError, setOptionsError] = useState({});
  const [resetSignal, setResetSignal] = useState({});
  const [searchTerm, setSearchTerm] = useState("");  

  const typeMapping = {
    rgb: 'rgb camera',
    stereo: 'stereo module',
    imu: 'motion module',
  };

  useEffect(() => {
    if (!deviceId) return;

    fetch(`http://localhost:8000/api/devices/${deviceId}/sensors/`)
      .then(res => res.json())
      .then(data => setSensors(data))
      .catch(err => console.error(" Failed to fetch sensors:", err));
  }, [deviceId]);

  const handleToggleSensor = async (sensorId) => {
    const isExpanded = expandedSensorId === sensorId;
    setExpandedSensorId(isExpanded ? null : sensorId);

    if (!isExpanded && !sensorOptions[sensorId]) {
      setLoadingOptions(prev => ({ ...prev, [sensorId]: true }));
      try {
        const res = await fetch(`http://localhost:8000/api/devices/${deviceId}/sensors/${sensorId}/options/`);
        const options = await res.json();
        setSensorOptions(prev => ({ ...prev, [sensorId]: options }));
        setOptionsError(prev => ({ ...prev, [sensorId]: null }));
      } catch (err) {
        setOptionsError(prev => ({ ...prev, [sensorId]: "Error loading options" }));
      } finally {
        setLoadingOptions(prev => ({ ...prev, [sensorId]: false }));
      }
    }
  };

  const resetAllOptions = async (sensorId) => {
    const options = sensorOptions[sensorId];
    if (!options) return;

    for (const option of options) {
      if (option.read_only) continue;

      let defaultVal = option.default_value ?? 0;

      if ([
        "Enable Motion Correction", "Global Time Enabled", "Enable Auto Exposure",
        "Enable Auto White Balance", "Auto Exposure Priority", "Backlight Compensation",
        "Emitter Always On", "Hdr Enabled", "Auto Exposure Limit Toggle", "Auto Gain Limit Toggle"
      ].includes(option.name)) {
        defaultVal = 0;
      }

      try {
        await fetch(`http://localhost:8000/api/devices/${deviceId}/sensors/${sensorId}/options/${option.option_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: defaultVal }),
        });
      } catch (err) {
        console.error(` Failed to reset option ${option.name}:`, err);
      }
    }

    try {
      const res = await fetch(`http://localhost:8000/api/devices/${deviceId}/sensors/${sensorId}/options/`);
      const updated = await res.json();
      setSensorOptions(prev => ({ ...prev, [sensorId]: updated }));
      setResetSignal(prev => ({ ...prev, [sensorId]: Date.now() }));
    } catch (err) {
      console.error(" Failed to reload after reset:", err);
    }
  };

  return (
    <div className="sensor-list">
      {sensors.filter(s => s.type.toLowerCase().includes(typeMapping[filter])).map(sensor => (
        <div key={sensor.sensor_id}>
          <div className="sensor-toggle-header" onClick={() => handleToggleSensor(sensor.sensor_id)}>
            <span className={`sensor-toggle-arrow ${expandedSensorId === sensor.sensor_id ? 'expanded' : ''}`}>▶</span>
            <span className="sensor-toggle-label">Controls</span>
          </div>

          {expandedSensorId === sensor.sensor_id && (
            <div className="sensor-dropdown-box">
              <input
                type="text"
                placeholder="Search controls..."
                className="sensor-search-box"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="reset-all" onClick={() => resetAllOptions(sensor.sensor_id)}>Reset All</button>

              {loadingOptions[sensor.sensor_id] ? (
                <p>Loading options...</p>
              ) : optionsError[sensor.sensor_id] ? (
                <p style={{ color: 'red' }}>{optionsError[sensor.sensor_id]}</p>
              ) : (
                <SensorOptionsPanel
                  options={sensorOptions[sensor.sensor_id]?.filter(opt =>
                    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )}
                  deviceId={deviceId}
                  sensorId={sensor.sensor_id}
                  resetSignal={resetSignal[sensor.sensor_id] || 0}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default SensorsList;
