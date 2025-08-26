import { useEffect, useRef, useState } from "react";
import SensorsList from './SensorsList.jsx';
import StreamSettingsPanel from './StreamSettingsPanel.jsx';
import IMUVisualizer3D from './IMUVisualizer3D.jsx';
import DragSelect from './DragSelect.jsx';
import FocusMaskCanvas from './FocusMaskCanvas.jsx';
import { FiPaperclip, FiCheckCircle, FiPlay } from "react-icons/fi";
import { compareTwoShots } from "../utils/twoShotDiff";
import { downloadDiffReportPNG } from "../utils/downloadDiffReportPNG";
import '../styles/DeviceList.css';
import { FiCamera } from 'react-icons/fi';

function pickImuResolutionFor(kind, sensorRefs) {
  const profiles = sensorRefs?.motion?.supported_stream_profiles || [];
  const p = profiles.find(p =>
    String(p.stream_type || "").toLowerCase() === kind &&
    Array.isArray(p.resolutions) && p.resolutions.length
  );
  if (p) {
    const [w, h] = p.resolutions[0];
    return { width: Number(w), height: Number(h) };
  }
  
  return { width: 0, height: 0 };
}

const VIDEO_STREAM_KEYS = new Set(['rgb', 'ir1', 'ir2', 'depth']);
const toBackendType = (k) =>
  k === 'rgb' ? 'color'
  : k === 'ir1' ? 'infrared-1'
  : k === 'ir2' ? 'infrared-2'
  : k;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function DeviceList({ deviceId, videoRefs, setVideoBoxes ,metadata }) {

  const getMetadataForType = (type, metadata) => {
    const map = {
      'color': ['color', 'rgb'],
      'infrared-1': ['infrared-1', 'ir1'],
      'infrared-2': ['infrared-2', 'ir2'],
      'depth': ['depth'],
      'gyro': ['gyro'],
      'accel': ['accel'],
    };
    const keys = map[type] || [type];
    for (const k of keys) if (metadata?.[k]) return metadata[k];
    return null;
  };

  const renderOverlayMetadata = (type) => {
    const md = getMetadataForType(type, metadata);
    if (!md) return <div className="overlay-empty">No metadata</div>;
    return (
      <>
        <h4 className="overlay-title">{type.toUpperCase()} — Metadata</h4>
        <pre className="overlay-pre">{JSON.stringify(md, null, 2)}</pre>
      </>
    );
  };

  const [shotA, setShotA] = useState(null);
  const [shotB, setShotB] = useState(null);
  const handleAttachA = (e) => { const f = e.target.files?.[0]; if (f) setShotA(f); };
  const handleAttachB = (e) => { const f = e.target.files?.[0]; if (f) setShotB(f); };
  const metadataRef = useRef({});
  useEffect(() => { metadataRef.current = metadata || {}; }, [metadata]);

  const waitForReadyStreams = async (backendTypes, timeoutMs = 5000, pollMs = 80) => {
    const observedCounts = Object.fromEntries(backendTypes.map(t => [t, 0]));
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const md = metadataRef.current || {};
      let allReady = true;
      for (const t of backendTypes) {
        const m = getMetadataForType(t, md);
        if (m) {
          // try to detect motion in metadata
          const stamp = m?.frame_index ?? m?.frame_counter ?? m?.timestamp ?? m?.time ?? JSON.stringify(m);
          const key = `__last_${t}`;
          if (!waitForReadyStreams[key]) waitForReadyStreams[key] = { stamp, seen: 1 };
          else {
            if (waitForReadyStreams[key].stamp !== stamp) {
              waitForReadyStreams[key] = { stamp, seen: 2 };
            } else {
              waitForReadyStreams[key].seen = Math.min(2, waitForReadyStreams[key].seen + 1);
            }
          }
          observedCounts[t] = waitForReadyStreams[key].seen;
        } else {
          allReady = false;
        }
      }
      allReady = allReady && backendTypes.every(t => observedCounts[t] >= 2);
      if (allReady) return true;
      await sleep(pollMs);
    }
    return false;
  };

  const handleStartCompare = async () => {
    if (!shotA || !shotB) return;

    const { summary, overlayCanvas } = await compareTwoShots(shotA, shotB, {
      threshold: 25,
      blurRadius: 3,
      minRegionPx: 600
    });
    downloadDiffReportPNG({
      summary,
      filename: `rgb-diff-summary-${Date.now()}.png`
    });
  };

  const [focusRect, setFocusRect] = useState(null);
  // useEffect(() => {
  //   console.log('[METADATA ACCEL]', metadata.accel);
  // }, [metadata.accel]);
  // useEffect(() => {
  //   console.log('[METADATA GYRO]', metadata.gyro);
  // }, [metadata.gyro]);

  const [focusModeActive, setFocusModeActive] = useState(false);
  const handleFocusModeToggle = () => {
    if (!focusModeActive && !activeStreams.includes('rgb')) {
      return;
    }
    setFocusModeActive(prev => !prev);
  };
  const [recorders, setRecorders] = useState({});
  const recordingChunksRef = useRef(new Map());
  const mediaRecordersRef = useRef({});
  const [boxOverlays, setBoxOverlays] = useState({});
  const toggleBoxOverlay = (type) =>
    setBoxOverlays(prev => ({ ...prev, [type]: !prev[type] }));
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleInfoId, setVisibleInfoId] = useState(null);
  const [stereoExpanded, setStereoExpanded] = useState(false);
  const [rgbConfigVisible, setRgbConfigVisible] = useState(false);
  const [imuConfigVisible, setImuConfigVisible] = useState(false);
  const [streamSelections, setStreamSelections] = useState({
    rgb: false,
    gyro: false, accel: false,
    ir1: false,
    ir2: false,
    depth: false
  });
  const [toggleLock, setToggleLock] = useState(false);
  const peerConnections = useRef({});
  const [stereoResolution, setStereoResolution] = useState('1280x720');
  const [stereoFps, setStereoFps] = useState(30);
  const [stereoAvailableFormats, setStereoAvailableFormats] = useState({});
  const [stereoAvailableResolutions, setStereoAvailableResolutions] = useState([]);
  const [stereoAvailableFramerates, setStereoAvailableFramerates] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState({
    ir1: 'y8', ir2: 'y8', depth: 'z16', rgb: 'rgb8', gyro: 'motion_xyz32f', accel: 'motion_xyz32f'
  });
  const [sensorRefs, setSensorRefs] = useState({});
  const [selectedFps, setSelectedFps] = useState({
    gyro: 200,
    accel: 63
  });
  const [imuAvailableFramerates, setImuAvailableFramerates] = useState({
    gyro: [],
    accel: []
  });
  const [activeStreams, setActiveStreams] = useState([]);
  const [rgbPendingConfig, setRgbPendingConfig] = useState(null);
  const imuKeys = ['gyro', 'accel'];
  const stereoKeys = ['ir1', 'ir2', 'depth'];
  const [imuAvailableFormats, setImuAvailableFormats] = useState({ gyro: [], accel: [] });
  const rgbSupportCacheRef = useRef({});
  const [rgbChecking, setRgbChecking] = useState(false);
  const [rgbSupported, setRgbSupported] = useState(false);
  const canonStreamType = (s) => String(s || '').toLowerCase();
  const rgbKeyParts = (cfg) => {
    const fmt = String(cfg?.format || '').toLowerCase();
    const fps = Number(cfg?.framerate || 0);
    const resStr = `${Number(cfg?.resolution?.width)}x${Number(cfg?.resolution?.height)}`;
    return { fmt, fps, resStr };
  };
  const cacheHas = ({ fmt, fps, resStr }) => {
    const byFps = rgbSupportCacheRef.current[fmt];
    const set = byFps?.[fps];
    return !!set && set.has(resStr);
  };
  const cacheSet = ({ fmt, fps, resStr }, ok) => {
    if (!ok) return;
    if (!rgbSupportCacheRef.current[fmt]) rgbSupportCacheRef.current[fmt] = {};
    if (!rgbSupportCacheRef.current[fmt][fps]) rgbSupportCacheRef.current[fmt][fps] = new Set();
    rgbSupportCacheRef.current[fmt][fps].add(resStr);
  };
  const rgbOn    = activeStreams.includes('rgb');
  const stereoOn = stereoKeys.some(k => activeStreams.includes(k));
  const imuOn    = imuKeys.some(k => activeStreams.includes(k));
  const sortNumeric = (arr) => [...arr].map(Number).sort((a, b) => a - b);
  const sortResList = (arr) => [...arr].sort((A, B) => {
    const [aw, ah] = Array.isArray(A) ? [Number(A[0]), Number(A[1])] : A.split('x').map(Number);
    const [bw, bh] = Array.isArray(B) ? [Number(B[0]), Number(B[1])] : B.split('x').map(Number);
    return (aw - bw) || (ah - bh);
  });

  useEffect(() => {
    const gList = imuAvailableFramerates?.gyro ?? [];
    const aList = imuAvailableFramerates?.accel ?? [];
    setSelectedFps(prev => {
      const next = { ...prev };
      if (gList.length) {
        const cur = Number(prev.gyro);
        if (!gList.includes(cur)) next.gyro = gList[0];
      }
      if (aList.length) {
        const cur = Number(prev.accel);
        if (!aList.includes(cur)) next.accel = aList[0];
      }
      return next;
    });
  }, [imuAvailableFramerates?.gyro, imuAvailableFramerates?.accel]);

  const [pendingStereoSelections, setPendingStereoSelections] = useState({
    ir1: false,
    ir2: false,
    depth: false
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const stereoPairMapsRef = useRef({});
  const handleFocusButtonClick = () => {
    if (!focusModeActive) {
      setIsSelecting(true);
    } else {
      handleFocusModeToggle();
    }
  };
  const handleRegionSelected = (rect) => {
    setIsSelecting(false);
    setFocusRect(rect);
    if (!focusModeActive) {
      handleFocusModeToggle();
    }
  };
  const isGroupEnabled = (groupKeys) => groupKeys.some(k => activeStreams.includes(k));

  useEffect(() => {
    fetch("http://localhost:8000/api/devices")
      .then(res => res.ok ? res.json() : Promise.reject("Failed to fetch devices"))
      .then(data => {
        setDevices(data);
        setLoading(false);

        if (data.length > 0) {
          const firstId = data[0].device_id;
          fetch(`http://localhost:8000/api/devices/${firstId}/sensors/`)
            .then(res => res.json())
            .then(sensorList => {
              const stereoSubSensors = {};
              const resSet = new Set();
              const fpsSet = new Set();
              const fmtMap = {};
              sensorList.forEach(sensor => {              
                if (sensor.name === "Stereo Module") {
                  const pairMaps = {}; 
                  for (const profile of sensor.supported_stream_profiles) {
                    const type = canonStreamType(profile.stream_type);
                    if (!stereoSubSensors[type]) {
                      stereoSubSensors[type] = { ...sensor, supported_stream_profiles: [] };
                    }
                    const fmts = profile.formats ?? (profile.format != null ? [profile.format] : []);
                    const fpsList = Array.isArray(profile.fps) ? profile.fps : (profile.fps != null ? [profile.fps] : []);
                    const resList = profile.resolutions
                      ?? (profile.resolution ? [[profile.resolution.width, profile.resolution.height]] : []);

                    stereoSubSensors[type].supported_stream_profiles.push(profile);
                    if (!pairMaps[type]) pairMaps[type] = { byFps: {}, byRes: {} };
                    for (const fmt of fmts) {
                      if (!pairMaps[type].byFps[fmt]) pairMaps[type].byFps[fmt] = {};
                      if (!pairMaps[type].byRes[fmt]) pairMaps[type].byRes[fmt] = {};
                      for (const f of fpsList) {
                        if (!pairMaps[type].byFps[fmt][f]) pairMaps[type].byFps[fmt][f] = new Set();
                        for (const [w, h] of resList) {
                          const resStr = `${Number(w)}x${Number(h)}`;
                          pairMaps[type].byFps[fmt][f].add(resStr);

                          if (!pairMaps[type].byRes[fmt][resStr]) pairMaps[type].byRes[fmt][resStr] = new Set();
                          pairMaps[type].byRes[fmt][resStr].add(Number(f));
                        }
                      }
                    }
                  }
                  stereoPairMapsRef.current = pairMaps;
                  for (const typeKey of Object.keys(stereoSubSensors)) {
                    for (const p of stereoSubSensors[typeKey].supported_stream_profiles) {
                      (p.resolutions || []).forEach(([w, h]) => resSet.add(`${w}x${h}`));
                      (p.fps || []).forEach(f => fpsSet.add(f));
                      if (!fmtMap[typeKey]) fmtMap[typeKey] = new Set();
                      (p.formats || (p.format != null ? [p.format] : [])).forEach(fmt => fmtMap[typeKey].add(fmt));
                    }
                  }
                }
                if (sensor.name === "Motion Module") {
                  const imuRates   = { gyro: new Set(),  accel: new Set()  };
                  const imuFormats = { gyro: new Set(),  accel: new Set()  };
                  for (const profile of (sensor.supported_stream_profiles || [])) {
                    const type = String(profile.stream_type || "").toLowerCase();
                    if (type !== "gyro" && type !== "accel") continue;
                    const fmts = profile.formats ?? (profile.format != null ? [profile.format] : []);
                    fmts.forEach(f => imuFormats[type].add(String(f)));
                    const fpsList = Array.isArray(profile.fps) ? profile.fps
                                  : (profile.fps != null ? [profile.fps] : []);
                    fpsList.forEach(f => imuRates[type].add(Number(f)));
                  }
                  const frameratesByType = {
                    gyro:  Array.from(imuRates.gyro).sort((a,b)=>a-b),
                    accel: Array.from(imuRates.accel).sort((a,b)=>a-b),
                  };
                  const formatsByType = {
                    gyro:  Array.from(imuFormats.gyro),
                    accel: Array.from(imuFormats.accel),
                  };
                  setImuAvailableFramerates(frameratesByType);
                  setImuAvailableFormats(formatsByType);
                  const prefer = (prev, list) => {
                    if (list.includes(prev)) return prev;
                    const mx = list.find(v => v.toLowerCase() === "motion_xyz32f");
                    return mx ?? (list[0] ?? prev);
                  };
                  setSelectedFormat(prev => ({
                    ...prev,
                    gyro:  prefer(prev.gyro,  formatsByType.gyro),
                    accel: prefer(prev.accel, formatsByType.accel),
                  }));
                  setSelectedFps(prev => ({
                    ...prev,
                    gyro:  frameratesByType.gyro[0]  ?? prev.gyro,
                    accel: frameratesByType.accel[0] ?? prev.accel,
                  }));                  
                }
              });
              const sensorMap = {
                rgb: sensorList.find(s => s.name === "RGB Camera"),
                motion: sensorList.find(s => s.name === "Motion Module"),
                ...stereoSubSensors
              };
              setSensorRefs(sensorMap);
              console.log(sensorRefs.motion)
              if (sensorMap.rgb && !rgbPendingConfig) {
                const initCfg = buildRgbConfigFromPending(null, sensorMap.rgb);
                if (initCfg) {
                  setRgbPendingConfig({
                    sensor_id: sensorMap.rgb.sensor_id,
                    sensor_type: sensorMap.rgb.type,
                    stream_type: 'color',
                    resolution: { ...initCfg.resolution },
                    framerate: initCfg.framerate,
                    format: initCfg.format,
                    enable: true,
                  });
                }
              }
              setStereoAvailableResolutions(sortResList(Array.from(resSet)));
              setStereoAvailableFramerates(sortNumeric(Array.from(fpsSet)));
              const cleaned = {};
              for (const key in fmtMap) cleaned[key] = Array.from(fmtMap[key]).sort();
              setStereoAvailableFormats(cleaned);
            });
        }
      })
      .catch(err => {
        console.error(err);
        setError("Error loading devices");
        setLoading(false);
      });
  }, []);

  const handleStreamToggle = async (groupKeys, enable) => {
    if (toggleLock) return;
    if (groupKeys.includes('rgb') && !enable) {
      setFocusModeActive(false);
      setFocusRect(null);
      setIsSelecting(false);
    }
    const newSelections = { ...streamSelections };
    groupKeys.forEach(key => newSelections[key] = enable);
    const alreadyCorrect = groupKeys.every(k => streamSelections[k] === newSelections[k]);
    const anyOfGroupActive = groupKeys.some(k => activeStreams.includes(k));
    if (alreadyCorrect && !(enable && !anyOfGroupActive)) return;
    setToggleLock(true);
    try {
      await stopMultiStream(deviceId);
      setStreamSelections(newSelections);

      const anyStreamEnabled = Object.values(newSelections).some(v => v);
      if (anyStreamEnabled) {
        await startMultiStream(deviceId, newSelections);
      }
    } catch (err) {
      console.error(" Stream toggle failed", err);
      alert(" Failed to update stream state.");
    } finally {
      setToggleLock(false);
    }
  };

  const createPeerConnection = async (deviceId, typeKey, delayMs = 0) => {
    if (peerConnections.current[typeKey] && peerConnections.current[typeKey].connectionState !== 'closed') {
      return;
    }
    if (delayMs) await sleep(delayMs);
    const canonical = toBackendType(typeKey);
    const offerKey  = pickOfferKey(canonical);
    const pc = new RTCPeerConnection();
    peerConnections.current[typeKey] = pc;
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      const video = videoRefs.current[canonical];
      if (video) video.srcObject = stream;
    };
    const offerRes = await fetch(`http://localhost:8000/api/webrtc/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, stream_types: [offerKey] })
    });
    const offer = await offerRes.json();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await fetch(`http://localhost:8000/api/webrtc/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: offer.session_id,
        sdp: pc.localDescription.sdp,
        type: pc.localDescription.type
      })
    });
  };

  const startMultiStream = async (deviceId, selections = streamSelections) => {
    const configs = [];
    const [w, h] = stereoResolution.split('x').map(Number);
    try {
      if (selections.rgb && sensorRefs.rgb) {
        const rgbCfg = buildRgbConfigFromPending(rgbPendingConfig, sensorRefs.rgb);
        if (!rgbCfg) {
          throw new Error("RGB configuration is missing or invalid.");
        }
        configs.push(rgbCfg);
      }
      if (selections.ir1 && sensorRefs['infrared-1']) {
        configs.push({
          stream_type: "infrared-1",
          format: selectedFormat.ir1,
          resolution: { width: w, height: h },
          framerate: stereoFps,
          sensor_id: sensorRefs['infrared-1'].sensor_id,
          enable: true
        });
      }
      if (selections.ir2 && sensorRefs['infrared-2']) {
        configs.push({
          stream_type: "infrared-2",
          format: selectedFormat.ir2,
          resolution: { width: w, height: h },
          framerate: stereoFps,
          sensor_id: sensorRefs['infrared-2'].sensor_id,
          enable: true
        });
      }
      if (selections.depth && sensorRefs.depth) {
        configs.push({
          stream_type: "depth",
          format: selectedFormat.depth,
          resolution: { width: w, height: h },
          framerate: stereoFps,
          sensor_id: sensorRefs.depth.sensor_id,
          enable: true
        });
      }
      if (selections.gyro && sensorRefs.motion) {
        const gyroRes = pickImuResolutionFor('gyro',  sensorRefs);
        configs.push({
          stream_type: "gyro",
          format: (selectedFormat.gyro || 'motion_xyz32f'),
          resolution: gyroRes,
          framerate: selectedFps.gyro,
          sensor_id: sensorRefs.motion.sensor_id,
          enable: true
        });
      }
      if (selections.accel && sensorRefs.motion) {
        const accelRes = pickImuResolutionFor('accel', sensorRefs);
        configs.push({
          stream_type: "accel",
          format: (selectedFormat.accel || 'motion_xyz32f'),
          resolution: accelRes,
          framerate: selectedFps.accel,
          sensor_id: sensorRefs.motion.sensor_id,
          enable: true
        });
      }
      if (configs.length === 0) {
        const onlyRgbIntended =
          selections.rgb &&
          !selections.ir1 && !selections.ir2 &&
          !selections.depth && !selections.gyro && !selections.accel;

        if (!onlyRgbIntended) {
          alert("❗ Select at least one stream to start.");
        }
        return;
      }      
      const res = await fetch(`http://localhost:8000/api/devices/${deviceId}/stream/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs, align_to: null, apply_filters: false })
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(" /stream/start failed:", res.status, errText);
        try {
          const errJson = JSON.parse(errText);
          console.error("🔎 Detailed error:", errJson);
        } catch {
          console.warn("⚠️ Response is not JSON");
        }
        throw new Error("Stream start failed");
      }
      const startedStreamTypes = configs.map(cfg => {
        switch (cfg.stream_type) {
          case 'color': return 'rgb';
          case 'infrared-1': return 'ir1';
          case 'infrared-2': return 'ir2';
          default: return cfg.stream_type; // 'depth', 'gyro', 'accel'
        }
      });
      setActiveStreams(startedStreamTypes);
      const startedVideoKeys = startedStreamTypes.filter(k => VIDEO_STREAM_KEYS.has(k));
      const backendTypes = startedVideoKeys.map(toBackendType);
      await waitForReadyStreams(backendTypes, 5000, 80);
      await sleep(500);
      await Promise.all(startedVideoKeys.map((typeKey, i) => createPeerConnection(deviceId, typeKey, i * 150)));
    } catch (err) {
      console.error(err);
      alert(" Failed to start multi stream.");
    }
  };

  const stopMultiStream = async (deviceId) => {
    try {
      Object.entries(recorders).forEach(([type, rec]) => {
        if (rec.mediaRecorder?.state !== 'inactive') {
          rec.mediaRecorder.stop();
        }
      });
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
      Object.values(videoRefs.current).forEach(video => {
        if (video) video.srcObject = null;
      });
      await fetch(`http://localhost:8000/api/devices/${deviceId}/stream/stop`, { method: "POST" });
      setActiveStreams([]);
    } catch (err) {
      console.error(err);
      alert(" Failed to stop streams.");
    }
  };

  const handleScreenshot = (streamType) => {
    const video = document.querySelector(`video[data-stream="${streamType}"]`);
    if (!video) {
      alert('No video stream found');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const link = document.createElement('a');
    link.download = `${streamType}_screenshot.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const toggleRecording = (type) => {
    const video = videoRefs.current[type];
    if (!video || !video.srcObject) {
      alert('No video stream to record.');
      return;
    }
    // Stop case
    if (mediaRecordersRef.current[type]) {
      const recorder = mediaRecordersRef.current[type];
      recorder.stop();
      return;
    }
    // Start case
    const stream = video.srcObject;
    const chunks = [];
    recordingChunksRef.current[type] = chunks;
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecordersRef.current[type] = mediaRecorder;
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_recording_${new Date().toISOString()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      delete recordingChunksRef.current[type];
      delete mediaRecordersRef.current[type];
      setRecorders(prev => {
        const updated = { ...prev };
        delete updated[type];
        return updated;
      });
    };
    mediaRecorder.start();
    setRecorders(prev => ({ ...prev, [type]: mediaRecorder }));
  };

  function hasWH(list, w, h) {
    if (!Array.isArray(list)) return false;
    return list.some(([W, H]) => Number(W) === Number(w) && Number(H) === Number(h));
  }

  function contains(list, val) {
    return Array.isArray(list) && list.includes(val);
  }

  const pickOfferKey = (canonical) => {
    const md = metadataRef.current || {};
    if (canonical === 'color')       return md['color'] ? 'color' : (md['rgb'] ? 'rgb' : 'color');
    if (canonical === 'infrared-1')  return md['infrared-1'] ? 'infrared-1' : (md['ir1'] ? 'ir1' : 'infrared-1');
    if (canonical === 'infrared-2')  return md['infrared-2'] ? 'infrared-2' : (md['ir2'] ? 'ir2' : 'infrared-2');
    return canonical;
  };

  function isProfileComboSupported(sensor, { stream_type, format, resolution, framerate }) {
    if (!sensor?.supported_stream_profiles || !stream_type || !format || !resolution || !framerate) return false;
    const needRes = !(stream_type === 'gyro' || stream_type === 'accel');
    return sensor.supported_stream_profiles.some(p => {
      if (p.stream_type !== stream_type) return false;
      const fmtOk = (p.format != null) ? (p.format === format) : contains(p.formats, format);
      const fpsOk = contains(p.fps, Number(framerate));
      if (!needRes) return fmtOk && fpsOk;
      const resOk = hasWH(p.resolutions, Number(resolution.width), Number(resolution.height));
      return fmtOk && fpsOk && resOk;
    });
  }

  function isStereoSubtypeSupported(subKey, fmt, resStr, fps, sensorRefs) {
    const mapKey = subKey === 'ir1' ? 'infrared-1' : subKey === 'ir2' ? 'infrared-2' : 'depth';
    const sensor = sensorRefs[mapKey];
    if (!sensor || !fmt || !resStr || !fps) return false;
    const [w, h] = resStr.split('x').map(Number);
    return isProfileComboSupported(sensor, {
      stream_type: mapKey,
      format: fmt,
      resolution: { width: w, height: h },
      framerate: Number(fps)
    });
  }

  function isImuSubtypeSupported(kind, fps, sensorRefs, imuAvailableFramerates) {
    if (!sensorRefs?.motion) return false;
    const allowed = (imuAvailableFramerates?.[kind] ?? []);
    if (!allowed.length) return true;
    return allowed.includes(Number(fps));
  }

  function buildRgbConfigFromPending(rgbCfg, rgbSensor) {
    if (rgbCfg && rgbCfg.stream_type === 'color' && rgbCfg.format && rgbCfg.resolution && rgbCfg.framerate) {
      return {
        stream_type: 'color',
        format: rgbCfg.format,
        resolution: { width: rgbCfg.resolution.width, height: rgbCfg.resolution.height },
        framerate: Number(rgbCfg.framerate),
        sensor_id: rgbSensor.sensor_id,
        enable: true
      };
    }
    const p = rgbSensor?.supported_stream_profiles?.find(
      p => canonStreamType(p.stream_type) === 'color'
    );
    if (p && p.formats?.length && p.resolutions?.length && p.fps?.length) {
      const [w, h] = p.resolutions[0];
      return {
        stream_type: 'color',
        format: p.formats[0],
        resolution: { width: Number(w), height: Number(h) },
        framerate: Number(p.fps[0]),
        sensor_id: rgbSensor.sensor_id,
        enable: true
      };
    }
    return null;
  }

  const probeRgbConfig = async (deviceId, cfg) => {
    if (!deviceId || !cfg) return false;
    const { fmt, fps, resStr } = rgbKeyParts(cfg);
    if (!fmt || !fps || !resStr.includes('x')) return false;
    if (cacheHas({ fmt, fps, resStr })) return true;
    setRgbChecking(true);
    try {
      const resStart = await fetch(`http://localhost:8000/api/devices/${deviceId}/stream/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configs: [{
            stream_type: "color",
            format: fmt,
            resolution: {
              width: Number(resStr.split('x')[0]),
              height: Number(resStr.split('x')[1]),
            },
            framerate: Number(fps),
            sensor_id: sensorRefs?.rgb?.sensor_id,
            enable: true
          }],
          align_to: null,
          apply_filters: false
        })
      });
      if (!resStart.ok) {
        return false;
      }
      await fetch(`http://localhost:8000/api/devices/${deviceId}/stream/stop`, { method: "POST" });
      cacheSet({ fmt, fps, resStr }, true);
      return true;
    } catch {
      return false;
    } finally {
      setRgbChecking(false);
    }
  };

  function stereoKeyToMapKey(k) {
    return k === 'ir1' ? 'infrared-1' : k === 'ir2' ? 'infrared-2' : 'depth';
  }

  function stereoPairSupported(subKey, fmt, resStr, fps) {
    const mapKey = stereoKeyToMapKey(subKey);
    const maps = stereoPairMapsRef.current?.[mapKey];
    if (!maps) {
      return isStereoSubtypeSupported(subKey, fmt, resStr, fps, sensorRefs);
    }
    const allowedSet = maps.byFps?.[fmt]?.[Number(fps)];
    return !!allowedSet && allowedSet.has(resStr);
  }

  // RGB
  const rgbDisabled = toggleLock || rgbChecking || !rgbSupported;
  // Stereo
  const stereoSubs  = ['ir1','ir2','depth'];
  const stereoChosen = stereoSubs.filter(k => pendingStereoSelections[k]);
  const stereoPlanned = (!stereoOn ? (stereoChosen.length ? stereoChosen : ['depth']) : []);
  const stereoBlocked = !stereoOn && (stereoPlanned.length > 0) && !stereoPlanned.every(k =>
    stereoPairSupported(k, selectedFormat[k], stereoResolution, stereoFps)
  );
  // IMU
  const haveImuLists =
    (imuAvailableFramerates?.gyro?.length ?? 0) > 0 ||
    (imuAvailableFramerates?.accel?.length ?? 0) > 0;
  const selectedImu = imuKeys.filter(k => streamSelections[k]);
  const imuPlanned = (!imuOn ? (selectedImu.length ? selectedImu : imuKeys) : []);
  const imuBlocked = !imuOn && haveImuLists && !imuPlanned.every(k =>
    isImuSubtypeSupported(k, selectedFps[k], sensorRefs, imuAvailableFramerates)
  );  

  const renderVideoBoxes = () => {
    const boxes = [];
    const renderBox = (type, label = type.toUpperCase()) => {
      const isIMU = type === 'gyro' || type === 'accel';
      return (
        <div key={type} className="video-box">
          <h4>{label}</h4>
          <div className={`video-wrapper ${isIMU ? 'imu-wrapper' : ''}`}>
            {/* Screenshot & Record icons */}
            <div className="stream-icons">
              <button
                type="button"
                className="icon-btn camera-btn"
                title="Take Screenshot"
                onClick={() => handleScreenshot(type)}
              >
                <FiCamera />
              </button>
              <button
                type="button"
                className="icon-btn record-button"
                title={recorders[type] ? "Stop Recording" : "Start Recording"}
                onClick={() => toggleRecording(type)}
              >
                {recorders[type] ? '⏹️' : '🔴'}
              </button>
              <button
                type="button"
                className="icon-btn menu-button"
                title="Toggle overlay"
                onClick={() => toggleBoxOverlay(type)}
              >
                &#9776;
              </button>
            </div>
            {/* COLOR uses DragSelect; others (including IMU) render normally */}
            {type === 'color' ? (
              <DragSelect active={isSelecting} onSelect={handleRegionSelected}>
                <video
                  data-stream={type}
                  ref={el => (videoRefs.current[type] = el)}
                  autoPlay
                  playsInline
                  muted
                  className="stream-video"
                />
                {focusModeActive && focusRect && (
                  <FocusMaskCanvas
                    active={true}
                    rect={focusRect}
                    blurRadius={8}
                    getVideoEl={() => videoRefs.current['color']}
                  />
                )}
              </DragSelect>
            ) : (
              <video
                data-stream={type}
                ref={el => (videoRefs.current[type] = el)}
                autoPlay
                playsInline
                muted
                className={`stream-video ${isIMU ? 'imu-video' : ''}`}
              />
            )}
            {/* 3D IMU visualizer for gyro/accel */}
            {isIMU && (
              <div className="imu-visualizer-container">
                <IMUVisualizer3D label={type.toUpperCase()} vector={metadata[type]} />
              </div>
            )}
            {boxOverlays[type] && (
              <div className="stream-overlay">
                <div className="stream-overlay-content">
                  {renderOverlayMetadata(type)}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    };
    if (activeStreams.includes('rgb')) boxes.push(renderBox('color', 'COLOR'));
    if (activeStreams.includes('ir1')) boxes.push(renderBox('infrared-1', 'IR 1'));
    if (activeStreams.includes('ir2')) boxes.push(renderBox('infrared-2', 'IR 2'));
    if (activeStreams.includes('depth')) boxes.push(renderBox('depth', 'DEPTH'));
    if (activeStreams.includes('gyro')) boxes.push(renderBox('gyro', 'GYRO'));
    if (activeStreams.includes('accel')) boxes.push(renderBox('accel', 'ACCEL'));

    return boxes;
  };

  const rgbProbeTimerRef = useRef(null);
  useEffect(() => {
    if (rgbOn) { setRgbSupported(true); return; }
    if (rgbProbeTimerRef.current) clearTimeout(rgbProbeTimerRef.current);
    rgbProbeTimerRef.current = setTimeout(async () => {
      if (!sensorRefs?.rgb) { setRgbSupported(false); return; }
      const cfg = buildRgbConfigFromPending(rgbPendingConfig, sensorRefs.rgb);
      if (!cfg) { setRgbSupported(false); return; }
      cfg.stream_type = 'color';
      const ok = await probeRgbConfig(deviceId, cfg);
      setRgbSupported(ok);
    }, 700);
    return () => {
      if (rgbProbeTimerRef.current) clearTimeout(rgbProbeTimerRef.current);
    };
  }, [deviceId, sensorRefs?.rgb, rgbOn,
      rgbPendingConfig?.format,
      rgbPendingConfig?.framerate,
      rgbPendingConfig?.resolution?.width,
      rgbPendingConfig?.resolution?.height]);

  useEffect(() => {
    if (setVideoBoxes) {
      setVideoBoxes(renderVideoBoxes());
    }
  }, [activeStreams, focusModeActive, isSelecting, boxOverlays, metadata]);

  useEffect(() => {
    ['ir1', 'ir2', 'depth'].forEach((k) => {
      if (pendingStereoSelections[k] && !selectedFormat[k]) {
        const mapKey = k === 'ir1' ? 'infrared-1' : k === 'ir2' ? 'infrared-2' : 'depth';
        const fmts = stereoAvailableFormats[mapKey];
        if (fmts && fmts.length) {
          setSelectedFormat(prev => ({ ...prev, [k]: fmts[0] }));
        }
      }
    });
  }, [pendingStereoSelections, stereoAvailableFormats, selectedFormat]);

  return (
    <div className="device-container">
      <div className="sidebar">
        <h2>Connected RealSense Devices</h2>
        {loading && <p>Loading...</p>}
        {error && <p>{error}</p>}
          <div className="noDev">
            {devices.length === 0 && !loading && <p>No devices found.</p>}
          </div>
        {devices.map(device => (
          <div key={device.device_id}>
            <div className="device-info-header">
              <div className="device-name-row">
                <h3>{device.name}</h3>
                <button
                  className={`info-button ${visibleInfoId === device.device_id ? 'active' : ''}`}
                  title="Show device details"
                  onClick={() => setVisibleInfoId(prev => prev === device.device_id ? null : device.device_id)}
                >
                  i
                </button>
                <div className="more-button-container">
                  <button
                    className="more-button"
                    title="More options"
                    onClick={() =>
                      setVisibleInfoId((prev) =>
                        prev === `menu-${device.device_id}` ? null : `menu-${device.device_id}`
                      )
                    }
                  >
                    &#9776;
                  </button>
                  <div className="more-button-label">More</div>
                  {visibleInfoId === `menu-${device.device_id}` && (
                    <div
                      className="menu-item"
                      onClick={async () => {
                        try {
                          await fetch(
                            `http://localhost:8000/api/devices/${device.device_id}/hw_reset`,
                            {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Accept: "application/json",
                              },
                            }
                          );
                          Object.keys(videoRefs.current).forEach(key => {
                            const video = videoRefs.current[key];
                            if (video) video.srcObject = null;
                          });
                          Object.values(peerConnections.current).forEach(pc => pc.close());
                          peerConnections.current = {};
                          setVideoBoxes([]);
                          setActiveStreams([]);
                          setStreamSelections({
                            rgb: false,
                            gyro: false, accel: false,
                            ir1: false,
                            ir2: false,
                            depth: false
                          });

                        } catch (error) {
                          console.error("Reset error:", error);
                          alert(" Reset request failed");
                        }
                        setVisibleInfoId(null);
                      }}
                    >
                      Hardware Reset
                    </div>
                  )}
                </div>
              </div>
            </div>
            {visibleInfoId === device.device_id && (
              <div className="device-info">
                <p><strong>ID:</strong> {device.device_id}</p>
                <p><strong>Firmware:</strong> {device.firmware_version}</p>
                <p><strong>Status:</strong> {device.is_streaming ? "Streaming" : "Idle"}</p>
                <p><strong>USB Type:</strong> {device.usb_type}</p>
                <p><strong>Port:</strong> {device.physical_port}</p>
                <p><strong>Product ID:</strong> {device.product_id}</p>
              </div>
            )}
            <div className="button-row">
              {/* RGB */}
              <div className="stream-group">
                <div className="stream-toggle">
                  <div className="stream-toggle-row">
                    <span className="stream-label">RGB</span>
                      <button
                        className={`stream-toggle-btn ${streamSelections.rgb ? 'on' : 'off'} ${rgbDisabled ? 'readonly' : ''}`}
                        disabled={rgbDisabled}
                        title={rgbChecking ? 'Checking support…' : (!rgbSupported ? 'Selected configuration (FPS, Resolution) is not supported' : undefined)}
                        onClick={async () => {
                          const next = !streamSelections.rgb;
                          if (next && !rgbSupported) return;
                          setIsSelecting(false);
                          await handleStreamToggle(['rgb'], next);
                        }}
                      >
                      <span className="icon">{streamSelections.rgb ? '🟢' : '🔴'}</span>
                      {streamSelections.rgb ? 'on' : 'off'}
                      </button>
                    <button className="arrow-button" onClick={() => setRgbConfigVisible(!rgbConfigVisible)}>
                      {rgbConfigVisible ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {rgbConfigVisible && (
                  <div className="stream-content">
                    <StreamSettingsPanel
                      sensor={sensorRefs.rgb}
                      onConfigsChange={(cfg) => setRgbPendingConfig(cfg)}
                      locked={rgbOn}
                    />
                    <div className="focus-mode-container">
                      <span className="focus-mode-label">Focus Mode</span>

                      <button
                        className={`focus-toggle-btn ${focusModeActive ? 'on' : 'off'}`}
                        onClick={handleFocusButtonClick}
                        disabled={toggleLock}
                      >
                        <span className="focus-dot" />{focusModeActive ? 'on' : 'off'}
                      </button>
                    </div>
                    <div className="comparison-mode-row">
                      <span className="comparison-mode-label">Comparison Mode</span>

                      <div className="comparison-attach">
                        <input id="attach-shot-a" type="file" accept="image/*" onChange={handleAttachA} style={{display:"none"}} />
                        <input id="attach-shot-b" type="file" accept="image/*" onChange={handleAttachB} style={{display:"none"}} />

                        <label htmlFor="attach-shot-a" className={`attach-btn ${shotA ? "attached" : ""}`} title="Attach First Screenshot">
                          <FiPaperclip /><span className="badge">1</span>{shotA && <FiCheckCircle className="ok" />}
                        </label>

                        <label htmlFor="attach-shot-b" className={`attach-btn ${shotB ? "attached" : ""}`} title="Attach Second Screenshot">
                          <FiPaperclip /><span className="badge">2</span>{shotB && <FiCheckCircle className="ok" />}
                        </label>

                        <button
                          type="button"
                          className="compare-btn"
                          onClick={handleStartCompare}
                          disabled={!shotA || !shotB}
                          title={!shotA || !shotB ? "Attach screenshots A and B first" : "Run comparison"}
                        >
                          <FiPlay />
                        </button>
                      </div>
                    </div>
                    <div className="sensors-list-container">
                      <SensorsList deviceId={device.device_id} filter="rgb" />
                    </div>
                  </div>
                )}
              </div>

              {/* Stereo */}
              <div className="stream-group">
                <div className="stream-toggle">
                  <div className="stream-toggle-row">
                    <span className="stream-label">Stereo</span>
                    <button
                      className={`stream-toggle-btn ${isGroupEnabled(['ir1','ir2','depth']) ? 'on' : 'off'} ${stereoBlocked ? 'readonly' : ''}`}
                      disabled={toggleLock || stereoBlocked}
                      title={stereoBlocked ? 'Selected configuration (FPS, Resolution) is not supported' : undefined}
                      onClick={async () => {
                        const stereoKeys = ['ir1','ir2','depth'];
                        const isOn = stereoKeys.some(k => activeStreams.includes(k));
                        const nextState = !isOn;
                        if (nextState) {
                          const selectedStereo = stereoKeys.filter(k => pendingStereoSelections[k]);
                          const plan = selectedStereo.length ? selectedStereo : ['depth'];
                          const ok = plan.every(k => stereoPairSupported(k, selectedFormat[k], stereoResolution, stereoFps));
                          if (!ok) return; // hard block
                          const updatedSelections = { ...streamSelections };
                          plan.forEach(k => (updatedSelections[k] = true));
                          setStreamSelections(updatedSelections);
                          await handleStreamToggle(plan, true);
                        } else {
                          await handleStreamToggle(stereoKeys, false);
                        }
                      }}
                    >
                      <span className="icon">{isGroupEnabled(['ir1','ir2','depth']) ? '🟢' : '🔴'}</span>
                      {isGroupEnabled(['ir1','ir2','depth']) ? 'on' : 'off'}
                    </button>
                    <button className="arrow-button" onClick={() => setStereoExpanded(!stereoExpanded)}>
                      {stereoExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>
                {stereoExpanded && (
                  <div className="stream-content">
                    <div className="stereo-options">
                      {['ir1', 'ir2', 'depth'].map(key => (
                        <label key={key}>
                          <input
                            type="checkbox"
                            checked={pendingStereoSelections[key]}
                            onChange={(e) => setPendingStereoSelections(prev => ({ ...prev, [key]: e.target.checked }))}                            
                            disabled={stereoOn}
                          /> {key === 'depth' ? 'Depth' : `Infrared ${key === 'ir1' ? 1 : 2}`}
                          {(pendingStereoSelections[key] || streamSelections[key]) && (
                            <select
                              value={selectedFormat[key]}
                              onChange={e => setSelectedFormat(prev => ({ ...prev, [key]: e.target.value }))}
                              disabled={stereoOn}
                            >
                              {(stereoAvailableFormats[key === 'ir1' ? 'infrared-1' : key === 'ir2' ? 'infrared-2' : 'depth'] || []).map(fmt => (
                                <option key={fmt} value={fmt}>{fmt}</option>
                              ))}
                            </select>
                          )}
                        </label>
                      ))}
                      <label>
                        Resolution:
                        <select value={stereoResolution} onChange={e => setStereoResolution(e.target.value)} disabled={stereoOn}>
                          {stereoAvailableResolutions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </label>
                      <label>
                        FPS:
                        <select value={stereoFps} onChange={e => setStereoFps(Number(e.target.value))} disabled={stereoOn}>
                          {stereoAvailableFramerates.map(f => {
                            const n = Number(f);
                            return <option key={n} value={n}>{n}</option>;
                          })}
                        </select>
                      </label>
                    </div>
                    <div className="sensors-list-container">
                      <SensorsList deviceId={device.device_id} filter="stereo" />
                    </div>
                  </div>
                )}
              </div>

              {/* IMU */}
              <div className="stream-group">
                <div className="stream-toggle">
                  <div className="stream-toggle-row">
                    <span className="stream-label">IMU</span>
                    <button
                      className={`stream-toggle-btn ${imuOn ? 'on' : 'off'} ${imuBlocked ? 'readonly' : ''}`}
                      disabled={toggleLock || imuBlocked}
                      title={imuBlocked ? 'Selected configuration (FPS, Resolution) is not supported' : undefined}
                      onClick={async () => {
                        const isOn = imuKeys.some(k => activeStreams.includes(k));
                        const nextState = !isOn;
                        if (!nextState) {
                          await handleStreamToggle(imuKeys, false);
                          return;
                        }
                        const selected = imuKeys.filter(k => streamSelections[k]);
                        const plan = selected.length ? selected : imuKeys;
                        const ok = plan.every(k => isImuSubtypeSupported(k, selectedFps[k], sensorRefs, imuAvailableFramerates));
                        if (!ok) return; // block
                        await handleStreamToggle(plan, true);
                      }}
                    >
                      <span className="icon">{imuOn ? '🟢' : '🔴'}</span>
                      {imuOn ? 'on' : 'off'}
                    </button>
                    <button className="arrow-button" onClick={() => setImuConfigVisible(!imuConfigVisible)}>
                      {imuConfigVisible ? '▲' : '▼'}
                    </button>
                  </div>
                </div>
                {imuConfigVisible && (
                  <div className="stream-content">
                    {/* Gyroscope checkbox */}
                    <label htmlFor="imu-gyro">
                      <input
                        id="imu-gyro"
                        type="checkbox"
                        checked={streamSelections.gyro}
                        onChange={(e) =>
                          setStreamSelections(s => ({ ...s, gyro: e.target.checked }))
                        }
                        disabled={imuOn}
                      />
                      Gyroscope
                    </label>
                    {streamSelections.gyro && (
                      <>
                        {/* Format */}
                        <label className="field-label" htmlFor="gyro-format">Format</label>
                        <select
                          id="gyro-format"
                          value={selectedFormat.gyro}
                          onChange={(e) =>
                            setSelectedFormat(prev => ({ ...prev, gyro: e.target.value }))
                          }
                          disabled={imuOn}
                        >
                          {(imuAvailableFormats.gyro || ["motion_xyz32f"]).map(f => (
                            <option key={f} value={f}>{String(f).toUpperCase()}</option>
                          ))}
                        </select>

                        {/* FPS */}
                        <label className="field-label" htmlFor="gyro-fps">Frame Rate (FPS)</label>
                        <select
                          id="gyro-fps"
                          value={String(selectedFps.gyro ?? '')}
                          onChange={(e) =>
                            setSelectedFps(prev => ({ ...prev, gyro: Number(e.target.value) }))
                          }
                          disabled={imuOn || !(imuAvailableFramerates?.gyro?.length)}
                        >
                          {(imuAvailableFramerates?.gyro ?? []).map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </>
                    )}
                    {/* Accelerometer checkbox */}
                    <label htmlFor="imu-accel">
                      <input
                        id="imu-accel"
                        type="checkbox"
                        checked={streamSelections.accel}
                        onChange={(e) =>
                          setStreamSelections(s => ({ ...s, accel: e.target.checked }))
                        }
                        disabled={imuOn}
                      />
                      Accelerometer
                    </label>
                    {streamSelections.accel && (
                      <>
                        {/* Format */}
                        <label className="field-label" htmlFor="accel-format">Format</label>
                        <select
                          id="accel-format"
                          value={selectedFormat.accel}
                          onChange={(e) =>
                            setSelectedFormat(prev => ({ ...prev, accel: e.target.value }))
                          }
                          disabled={imuOn}
                        >
                          {(imuAvailableFormats.accel || ["motion_xyz32f"]).map(f => (
                            <option key={f} value={f}>{String(f).toUpperCase()}</option>
                          ))}
                        </select>
                        {/* FPS */}
                        <label className="field-label" htmlFor="accel-fps">Frame Rate (FPS)</label>
                        <select
                          id="accel-fps"
                          value={String(selectedFps.accel ?? '')}
                          onChange={(e) =>
                            setSelectedFps(prev => ({ ...prev, accel: Number(e.target.value) }))
                          }
                          disabled={imuOn || !(imuAvailableFramerates?.accel?.length)}
                        >
                          {(imuAvailableFramerates?.accel ?? []).map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </>
                    )}
                    <div className="sensors-list-container">
                      <SensorsList deviceId={deviceId} filter="imu" />
                    </div>
                  </div>
                )}
              </div>                  
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DeviceList;