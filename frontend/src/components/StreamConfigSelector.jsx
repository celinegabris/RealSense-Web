import React, { useState, useEffect } from 'react';
import '../styles/DeviceList.css';

function StreamConfigSelector({ sensorId, sensorType, streamProfiles, onConfigChange, locked = false }) {
  const [enabled, setEnabled] = useState(true);
  const [streamType, setStreamType] = useState('');
  const [resolution, setResolution] = useState({ width: 640, height: 480 });
  const [framerate, setFramerate] = useState(30);
  const [format, setFormat] = useState('');

  useEffect(() => {
    if (streamProfiles.length > 0 && streamType === '') {
      const first = streamProfiles[0];
      setStreamType(first.stream_type);
      setResolution({ width: first.resolutions[0][0], height: first.resolutions[0][1] });
      setFramerate(first.fps[0]);
      setFormat(first.formats[0]);
    }
  }, [streamProfiles, streamType]);

  useEffect(() => {
    if (!streamType) return;
    onConfigChange({
      sensor_id: sensorId,
      sensor_type: sensorType,
      stream_type: streamType,
      resolution,
      framerate,
      format,
      enable: enabled,
    });
  }, [enabled, streamType, resolution, framerate, format, sensorId, sensorType]);

  const selectedProfile = streamProfiles.find(p => p.stream_type === streamType);

  // Make sure UI lists are sorted and stable
  const fpsList = (selectedProfile?.fps ?? [])
    .map(Number)
    .sort((a, b) => a - b);

  const resList = (selectedProfile?.resolutions ?? [])
    .slice()
    .sort((a, b) => (Number(a[0]) - Number(b[0])) || (Number(a[1]) - Number(b[1])));

  const fmtList = (selectedProfile?.formats ?? [])
    .slice()
    .sort((a, b) => String(a).localeCompare(String(b)));


  return (
    <div className="stream-config-block">
      <div className="stream-config-dropdowns">
        <label>
          Stream Type:
          <select value={streamType} onChange={(e) => setStreamType(e.target.value)} disabled={locked}>
            {streamProfiles.map((p) => (
              <option key={p.stream_type} value={p.stream_type}>{p.stream_type}</option>
            ))}
          </select>
        </label>

        <label>
          Resolution:
          <select
            value={`${resolution.width}x${resolution.height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number);
              setResolution({ width: w, height: h });
            }}
            disabled={locked}
          >
            {resList.map(([w, h]) => (
              <option key={`${w}x${h}`} value={`${w}x${h}`}>{w}x{h}</option>
            ))}
          </select>
        </label>

        <label>
          Frame Rate (FPS):
          <select value={framerate} onChange={(e) => setFramerate(Number(e.target.value))} disabled={locked}>
            {fpsList.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>

        <label>
          Format:
          <select value={format} onChange={(e) => setFormat(e.target.value)} disabled={locked}>
            {fmtList.map(fmt => (
              <option key={fmt} value={fmt}>{fmt}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export default StreamConfigSelector;