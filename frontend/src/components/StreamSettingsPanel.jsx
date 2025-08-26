import React, { useEffect, useState } from 'react';
import StreamConfigSelector from './StreamConfigSelector';

function StreamSettingsPanel({ sensor, locked = false, onConfigsChange }) {
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    if (!sensor || !sensor.supported_stream_profiles) return;
    setProfiles(sensor.supported_stream_profiles);
  }, [sensor]);

  return (
    <div>
      {profiles.map((profile) => (
        <StreamConfigSelector
          key={profile.stream_type}
          sensorId={sensor.sensor_id}
          sensorType={sensor.type}
          streamProfiles={[profile]}
          onConfigChange={onConfigsChange}
          locked={locked}
        />
      ))}
    </div>
  );
}

export default StreamSettingsPanel;
