import React, { useState, useEffect, useRef } from 'react';
import WebRTCService from './services/webrtc.service';
import SensorOptions, { OptionInfo } from './controls/Options';
import StreamConfigOptions from './StreamConfigOptions';
import socket from './services/socket-io.service';

// Configuration
const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8000/api`;
const AUTH_TOKEN = 'your_auth_token_here'; // Replace with actual auth token

interface Device {
  device_id: string;
  name: string;
  firmware_version: string;
  usb_type: string;
  serial_number: string;
}

export interface SupportedStreamProfile {
  stream_type: string;
  resolutions: Array<number[]>;
  fps: number[];
  formats: string[];
}

export interface SensorInfo {
  sensor_id: string;
  name: string;
  type: string;
  options: OptionInfo[];
  supported_stream_profiles: SupportedStreamProfile[];
}

export interface StreamConfig {
  sensor_id?: string;
  sensor_type: string;
  stream_type: string;
  resolution?: { width: number; height: number };
  framerate?: number;
  format?: string;
  enabled?: boolean;
}

const RSViewer: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [selectedSensors, setSelectedSensors] = useState<string[]>([]);
  const [availableSensorTypes, setAvailableSensorTypes] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [streamStatus, setStreamStatus] = useState<string>('stopped');
  const [pointcloudStatus, setPointcloudStatus] = useState<string>('inactive');
  const [error, setError] = useState<string | null>(null);

  // Updated state variables for sensors
  const [sensors, setSensors] = useState<SensorInfo[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<string>('');
  const [streamConfigs, setStreamConfigs] = useState<StreamConfig[]>([]);
  const [alignToStream, setAlignToStream] = useState<string | null>(null);

  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const streamMappingRef = useRef<{ [key: string]: MediaStream }>({});

  useEffect(() => {
    webrtcServiceRef.current = new WebRTCService(API_BASE_URL, AUTH_TOKEN);
    socket.connect();

    socket.on('metadata_update', (data: any) => {
      console.log('Received metadata update:', data);
    });

    return () => {
      webrtcServiceRef.current?.disconnect();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/devices`, {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        });
        if (!response.ok) throw new Error(`Failed to fetch devices: ${response.statusText}`);
        const data: Device[] = await response.json();
        setDevices(data);
        if (data.length > 0) setSelectedDevice(data[0].device_id);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    fetchDevices();
  }, []);

  // Fetch sensors with enhanced information when selected device changes
  useEffect(() => {
    const fetchSensors = async () => {
      if (!selectedDevice) return;

      try {
        const response = await fetch(`${API_BASE_URL}/devices/${selectedDevice}/sensors`, {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        });
        if (!response.ok) throw new Error(`Failed to fetch sensors: ${response.statusText}`);
        const data: SensorInfo[] = await response.json();
        setSensors(data);

        if (data.length > 0) {
          setSelectedSensor(data[0].sensor_id);

          // Initialize stream types based on available sensor types
          const availableSensorTypes = [...new Set(data.map((sensor) => sensor.type))];

          setAvailableSensorTypes(availableSensorTypes);

          // Generate stream configs based on the available sensors
          const initialConfigs: StreamConfig[] = data.flatMap((sensor: SensorInfo) => {
            if (!sensor.supported_stream_profiles || Object.keys(sensor.supported_stream_profiles).length === 0) {
              return {
                // some default values for motion sensor
                sensor_id: sensor.sensor_id,
                sensor_type: sensor.type,
                stream_type: sensor.type.split(' ')[0].toLowerCase(),
                resolution: {
                  width: 640,
                  height: 480,
                },
                framerate: 30,
                format: 'combined_motion',
                enabled: false,
              };
            }

            // Create configurations for each stream profile
            return sensor.supported_stream_profiles
              .map((streamProfile) => {
                if (!streamProfile || !streamProfile.resolutions?.[0] || !streamProfile.fps?.[0] || !streamProfile.formats?.[0]) {
                  return null;
                }

                return {
                  sensor_id: sensor.sensor_id,
                  sensor_type: sensor.type,
                  stream_type: streamProfile.stream_type,
                  resolution: {
                    width: streamProfile.resolutions[0][0],
                    height: streamProfile.resolutions[0][1],
                  },
                  framerate: streamProfile.fps[0],
                  format: streamProfile.formats[0],
                  enabled: false,
                };
              })
              .filter((config) => config !== null);
          });

          setStreamConfigs(initialConfigs);
        } else {
          setSelectedSensor('');
          setSelectedSensors([]);
          setStreamConfigs([]);
        }
      } catch (err) {
        setError((err as Error).message);
        setSensors([]);
        setSelectedSensor('');
        setSelectedSensors([]);
        setStreamConfigs([]);
      }
    };

    fetchSensors();
  }, [selectedDevice]);

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDevice(e.target.value);
    // Reset related states
    setSelectedSensor('');
    setSensors([]);
    setStreamConfigs([]);
  };

  const handleSensorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSensor(e.target.value);
  };

  const handleSensorSelection = (type: string) => {
    setSelectedSensors((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const handleStreamConfigChange = (sensorType: string, streamType: string, field: keyof StreamConfig, value: unknown) => {
    setStreamConfigs((prev) => [
      ...prev.map((config) =>
        config.sensor_type === sensorType && config.stream_type === streamType ? { ...config, [field]: field === 'framerate' ? parseInt(value as string, 10) : value } : config
      ),
    ]);
  };

  const handleAlignToChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAlignToStream(e.target.value === 'none' ? null : e.target.value);
  };

  const connectToStream = async () => {
    try {
      setError(null);
      if (!selectedDevice) throw new Error('No device selected');
      if (selectedSensors.length === 0) throw new Error('Please select at least one stream type');

      streamMappingRef.current = {};
      const activeStreams = streamConfigs.filter((config) => selectedSensors.includes(config.sensor_type) && config.enabled).map((config) => config.stream_type);
      await webrtcServiceRef.current!.connect(
        selectedDevice,
        activeStreams,
        (state) => setConnectionStatus(state),
        (event) => {
          // Get the mid value from the transceiver that received this track
          const transceiver = webrtcServiceRef
            .current!.getPeerConnection()
            ?.getTransceivers()
            .find((t) => t.receiver.track.id === event.receiver.track.id);

          // The mid should match the index in the streamTypes array
          const transceiverIndex = transceiver?.mid ? parseInt(transceiver.mid) : 0;
          const streamType = activeStreams[transceiverIndex] || activeStreams[0];

          console.log(`Received track: ${event.receiver.track.kind}, mid: ${transceiver?.mid}, mapping to: ${streamType}`);

          // Store the stream with its corresponding type
          streamMappingRef.current[streamType] = new MediaStream([event.receiver.track]);

          // If there's a video element already for this stream type, attach the stream
          const videoElement = document.querySelector(`video[data-stream-type="${streamType}"]`) as HTMLVideoElement;
          if (videoElement) {
            videoElement.srcObject = streamMappingRef.current[streamType];
          }
        }
      );
    } catch (err) {
      setError((err as Error).message);
      setConnectionStatus('failed');
    }
  };

  const disconnectFromStream = async () => {
    try {
      await webrtcServiceRef.current?.disconnect();
      setConnectionStatus('disconnected');
      streamMappingRef.current = {};
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startStream = async () => {
    if (!selectedDevice || selectedSensors.length === 0) {
      setError('Please select a device and at least one stream type');
      return;
    }

    try {
      setError(null);

      // Filter stream configs based on selected stream types
      const selectedConfigs = streamConfigs.filter((config) => selectedSensors.includes(config.sensor_type) && config.enabled);

      const result = await webrtcServiceRef.current!.startStream(selectedDevice, selectedConfigs, alignToStream);

      if (!result) {
        throw new Error('Failed to start stream');
      }

      setStreamStatus('running');
      updateOptions();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const stopStream = async () => {
    if (!selectedDevice) {
      return;
    }

    try {
      setError(null);

      const result = await webrtcServiceRef.current!.stopStream(selectedDevice);

      if (!result) {
        throw new Error('Failed to stop stream');
      }

      setStreamStatus('stopped');
      updateOptions();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const activatePointCloud = async () => {
    if (!selectedDevice) {
      setError('No device selected');
      return;
    }
    try {
      setError(null);
      const result = await webrtcServiceRef.current?.activatePointCloud(selectedDevice);
      if (!result) {
        throw new Error('Failed to start point cloud');
      }
      setPointcloudStatus('active');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deactivatePointCloud = async () => {
    try {
      setError(null);
      const result = await webrtcServiceRef.current?.deactivatePointCloud(selectedDevice);

      if (!result) {
        throw new Error('Failed to stop point cloud');
      }

      setPointcloudStatus('inactive');
    } catch (err) {
      setError((err as Error).message);
    }
  };


  const setVideoRef = (streamType: string, element: HTMLVideoElement | null) => {
    if (element) {
      // Add a data attribute to identify the video element
      element.setAttribute('data-stream-type', streamType);

      // If we already have a stream for this type, attach it
      if (streamMappingRef.current[streamType]) {
        element.srcObject = streamMappingRef.current[streamType];
      }
    }
  };

  const updateOptions = async () => {
    const response = await fetch(`${API_BASE_URL}/devices/${selectedDevice}/sensors/${selectedSensor}/options/`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const options = await response.json();
    setSensors((prevSensors) =>
      prevSensors.map((sensor) => {
        if (sensor.sensor_id === selectedSensor) {
          return {
            ...sensor,
            options: options,
          };
        }
        return sensor;
      })
    );
  };

  // Helper function to get current sensor info
  const getCurrentSensor = () => {
    return sensors.find((sensor) => sensor.sensor_id === selectedSensor);
  };

  // Filter sensor types to those with valid stream capabilities
  const streamableSensorTypes = React.useCallback(() => {
    return selectedSensors.filter((type) => {
      const sensor = sensors.find((s) => s.type === type);
      return sensor?.type !== 'Motion Module';
    });
  }, [selectedSensors, sensors]);

  const handleOptionChange = async (optionId: string, value: number) => {
    if (!selectedDevice || !selectedSensor) return;

    try {
      setError(null);

      // API call to update the sensor option
      const response = await fetch(`${API_BASE_URL}/devices/${selectedDevice}/sensors/${selectedSensor}/options/${optionId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update option: ${response.statusText}`);
      }

      // Update the option value in the local state
      setSensors((prevSensors) =>
        prevSensors.map((sensor) => {
          if (sensor.sensor_id === selectedSensor) {
            return {
              ...sensor,
              options: sensor.options.map((option) => (option.option_id === optionId ? { ...option, current_value: value } : option)),
            };
          }
          return sensor;
        })
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <h1>RealSense WebRTC Viewer</h1>
      <div className="viewer-area">
        <div className="options-container">
          {error && <p style={{ color: 'red' }}>{error}</p>}

          <div>
            <h2>Device Selection</h2>
            <select value={selectedDevice} onChange={handleDeviceChange}>
              <option value="">Select a device</option>
              {devices.map((device) => (
                <option key={device.device_id} value={device.device_id}>
                  {device.name || device.device_id}
                </option>
              ))}
            </select>
            <h3>Device info</h3>
            <ul className="device-info">
              <li>Device ID: {selectedDevice}</li>
              <li>Device Name: {devices.find((d) => d.device_id === selectedDevice)?.name}</li>
              <li>Firmware Version: {devices.find((d) => d.device_id === selectedDevice)?.firmware_version}</li>
              <li>USB Type: {devices.find((d) => d.device_id === selectedDevice)?.usb_type}</li>
              <li>Serial Number: {devices.find((d) => d.device_id === selectedDevice)?.serial_number}</li>
              <li>Available Sensor Types: {availableSensorTypes.join(', ')}</li>
            </ul>
          </div>
          {selectedDevice && (
            <div>
              <h2>Sensor Selection</h2>
              <select value={selectedSensor} onChange={handleSensorChange}>
                <option value="">Select a sensor</option>
                {sensors.map((sensor) => (
                  <option key={sensor.sensor_id} value={sensor.sensor_id}>
                    {sensor.name || sensor.sensor_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedSensor && (
            <div>
              <h2>Sensor Options</h2>
              <SensorOptions options={getCurrentSensor()?.options || []} onOptionChange={handleOptionChange} />
            </div>
          )}
        </div>
        <div className="stream-container">
          <div>
            <h2>Stream Selection</h2>
            {availableSensorTypes.map((type) => (
              <label key={type} style={{ marginRight: '10px' }}>
                <input type="checkbox" checked={selectedSensors.includes(type)} onChange={() => handleSensorSelection(type)} />
                {type}
              </label>
            ))}
          </div>

          {/* Stream Configuration Section */}
          <div>
            <h2>Stream Configuration</h2>
            <div>
              <label>
                Align To:
                <select value={alignToStream === null ? 'none' : alignToStream} onChange={handleAlignToChange}>
                  <option value="none">None</option>
                  {streamableSensorTypes().map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              &nbsp; &nbsp; &nbsp;
              <button onClick={activatePointCloud} disabled={pointcloudStatus === 'active'} style={{ marginRight: '10px' }}>
                {'Activate Point Cloud'}
              </button>
              <button onClick={deactivatePointCloud} disabled={pointcloudStatus === 'inactive'} style={{ marginRight: '10px' }}>
                {'Deactivate Point Cloud'}
              </button>
            </div>

            {selectedSensors.map((sensorType) => {
              // Find sensor with matching type to display relevant configuration options
              const sensorForType = sensors.find((sensor) => sensor.type === sensorType);
              if (!sensorForType) return null;
              const currentConfig = streamConfigs.find((c) => c.sensor_type === sensorType);

              return (
                currentConfig && (
                  <div key={sensorType} style={{ marginTop: '10px', padding: '10px', border: '1px solid #ccc' }}>
                    <h3>{sensorType.charAt(0).toUpperCase() + sensorType.slice(1)} Stream Settings</h3>

                    {/* Move all configuration options to the child component */}
                    <StreamConfigOptions
                      sensorType={sensorType}
                      currentConfig={currentConfig}
                      sensorForType={sensorForType}
                      streamConfigs={streamConfigs}
                      handleStreamConfigChange={handleStreamConfigChange}
                    />
                  </div>
                )
              );
            })}
          </div>

          <div style={{ marginTop: '20px' }}>
            <h2>Stream Control</h2>
            <button onClick={startStream} disabled={streamStatus === 'running'} style={{ marginRight: '10px' }}>
              {'Start Stream'}
            </button>
            <button onClick={stopStream} disabled={streamStatus === 'stopped'}>
              {'Stop Stream'}
            </button>
            <p>
              Stream Status: <strong>{streamStatus}</strong>
            </p>
          </div>

          <div style={{ marginTop: '20px' }}>
            <h2>WebRTC Connection</h2>
            <button onClick={connectToStream} disabled={!selectedDevice || connectionStatus === 'connected'} style={{ marginRight: '10px' }}>
              {'Connect WebRTC'}
            </button>
            <button onClick={disconnectFromStream} disabled={connectionStatus === 'disconnected'}>
              {'Disconnect WebRTC'}
            </button>
            <p>
              Connection Status: <strong>{connectionStatus}</strong>
            </p>
          </div>
        </div>
        <div className="stream-viewers">
          <h2>Streams</h2>
          {streamConfigs
            .filter((config) => selectedSensors.includes(config.sensor_type) && config !== null)
            .map((type) => (
              <div key={type.stream_type} style={{ marginTop: '10px' }}>
                <h3>{type.stream_type.toUpperCase()} Stream</h3>
                <video ref={(el) => setVideoRef(type.stream_type, el)} autoPlay playsInline muted style={{ border: '1px solid #ccc', maxWidth: '100%' }} />
              </div>
            ))}
        </div>
      </div>
    </>
  );
};

export default RSViewer;
