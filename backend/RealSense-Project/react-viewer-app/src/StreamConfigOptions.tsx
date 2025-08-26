import React, { useState, useEffect } from 'react';
import { StreamConfig, SensorInfo } from './RSViewer';

interface StreamConfigOptionsProps {
  sensorType: string;
  currentConfig: StreamConfig;
  sensorForType: SensorInfo | undefined;
  streamConfigs: StreamConfig[];
  handleStreamConfigChange: (sensorType: string, streamType: string, key: string, value: any) => void;
}

const StreamConfigOptions: React.FC<StreamConfigOptionsProps> = ({ sensorType, currentConfig, sensorForType, streamConfigs, handleStreamConfigChange }) => {
  // Initialize local state with the current config from props
  const [localStreamConfig, setLocalStreamConfig] = useState<StreamConfig>(() => {
    const configFromProps = streamConfigs.find((c) => c.sensor_type === sensorType && c.stream_type === currentConfig.stream_type);
    return configFromProps || currentConfig;
  });

  // Track if this is the initial render
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize local state on first render only
  useEffect(() => {
    if (!isInitialized) {
      const configFromProps = streamConfigs.find((c) => c.sensor_type === sensorType && c.stream_type === currentConfig.stream_type);
      if (configFromProps) {
        setLocalStreamConfig(configFromProps);
      }
      setIsInitialized(true);
    }
  }, [currentConfig, sensorType, streamConfigs, isInitialized]);

  // Find the current profile based on selected stream type
  const currentProfile = localStreamConfig?.stream_type ? sensorForType?.supported_stream_profiles.find((prof) => prof.stream_type === localStreamConfig.stream_type) : null;

  // Handle stream type change
  const handleStreamTypeChange = (streamType: string) => {
    // Find the stream config for the new type but keep our local modifications
    const baseConfig = streamConfigs.find((c) => c.sensor_type === sensorType && c.stream_type === streamType);

    if (baseConfig) {
      setLocalStreamConfig({
        ...baseConfig,
        // Preserve the enabled status from our local state
        //enabled: localStreamConfig.enabled,
      });
    }
  };

  // Handle local property changes
  const handleLocalChange = (key: string, value: any) => {
    setLocalStreamConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Only the Enable checkbox will trigger the parent's handleStreamConfigChange
  const handleEnableChange = (checked: boolean) => {
    // Update local state
    setLocalStreamConfig((prev) => ({
      ...prev,
      enabled: checked,
    }));

    handleStreamConfigChange(sensorType, localStreamConfig.stream_type, 'framerate', localStreamConfig.framerate);
    handleStreamConfigChange(sensorType, localStreamConfig.stream_type, 'format', localStreamConfig.format);
    handleStreamConfigChange(sensorType, localStreamConfig.stream_type, 'resolution', localStreamConfig.resolution);
    handleStreamConfigChange(sensorType, localStreamConfig.stream_type, 'enabled', checked);
  };

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {/* Stream Type selector */}
      <label>
        Stream Type:
        <select value={localStreamConfig?.stream_type || ''} onChange={(e) => handleStreamTypeChange(e.target.value)}>
          {sensorForType?.supported_stream_profiles.map((profile) => (
            <option key={profile.stream_type} value={profile.stream_type}>
              {profile.stream_type}
            </option>
          ))}
        </select>
      </label>

      {/* Only render these options if we have a stream type selected and a matching profile */}
      {localStreamConfig?.stream_type && currentProfile && (
        <>
          <label>
            Resolution:
            <select
              value={`${localStreamConfig.resolution?.width}x${localStreamConfig.resolution?.height}`}
              onChange={(e) => {
                const [width, height] = e.target.value.split('x').map(Number);
                handleLocalChange('resolution', { width, height });
              }}
            >
              {currentProfile.resolutions.map((res) => (
                <option key={`${res[0]}x${res[1]}`} value={`${res[0]}x${res[1]}`}>
                  {`${res[0]}x${res[1]}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            FPS:
            <select value={localStreamConfig.framerate} onChange={(e) => handleLocalChange('framerate', e.target.value)}>
              {currentProfile.fps.map((fps) => (
                <option key={fps} value={fps}>
                  {fps}
                </option>
              ))}
            </select>
          </label>

          <label>
            Format:
            <select value={localStreamConfig.format} onChange={(e) => handleLocalChange('format', e.target.value)}>
              {currentProfile.formats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </label>

          <label>
            Enable:
            <input type="checkbox" checked={localStreamConfig.enabled} onChange={(e) => handleEnableChange(e.target.checked)} />
          </label>
        </>
      )}
    </div>
  );
};

export default StreamConfigOptions;
