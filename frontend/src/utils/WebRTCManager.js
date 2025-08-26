let peerConnection = null;
let sessionId = null;

let videoElements = {};

let streamMap = {};

// Ordered list of stream types 
let streamTypes = [];

const WebRTCManager = {

  async connect(deviceId, streams, onConnectionStateChange) {
    streamTypes = streams;
    peerConnection = new RTCPeerConnection();
    videoElements = {};
    streamMap = {};

    peerConnection.ontrack = (event) => {
      const transceiver = peerConnection
        .getTransceivers()
        .find((t) => t.receiver.track.id === event.track.id);

      const mid = transceiver?.mid;
      const index = parseInt(mid, 10);
      const type = streamTypes[index] || streamTypes[0];

      console.log(`🎥 New track: ${event.track.id}, MID: ${mid}, Type: ${type}`);

      const stream = new MediaStream([event.track]);
      streamMap[type] = stream;

      if (videoElements[type]) {
        videoElements[type].srcObject = stream;
      }
    };

    if (onConnectionStateChange) {
      peerConnection.onconnectionstatechange = () => {
        onConnectionStateChange(peerConnection.connectionState);
      };
    }

    const offerResponse = await fetch('http://localhost:8000/api/webrtc/offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, stream_types: streamTypes }),
    });

    if (!offerResponse.ok) throw new Error('Failed to get WebRTC offer');
    const { session_id, sdp, type } = await offerResponse.json();
    sessionId = session_id;

    await peerConnection.setRemoteDescription({ sdp, type });

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    const answerResponse = await fetch('http://localhost:8000/api/webrtc/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id, sdp: answer.sdp, type: answer.type }),
    });

    if (!answerResponse.ok) throw new Error('Failed to send WebRTC answer');

    console.log(`✅ WebRTC connected with session: ${sessionId}`);
  },

  setVideoElement(streamType, videoEl) {
    if (!videoEl) return;
    videoElements[streamType] = videoEl;

    if (streamMap[streamType]) {
      videoEl.srcObject = streamMap[streamType];
    }
  },

  async disconnect() {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    if (sessionId) {
      await fetch(`http://localhost:8000/api/webrtc/sessions/${sessionId}`, {
        method: 'DELETE',
      }).catch(console.error);
    }

    videoElements = {};
    streamMap = {};
    streamTypes = [];
    sessionId = null;

    console.log(' WebRTC session closed');
  },

  getPeerConnection() {
    return peerConnection;
  },

  getActiveStreamTypes() {
    return streamTypes;
  },
};

export default WebRTCManager;
