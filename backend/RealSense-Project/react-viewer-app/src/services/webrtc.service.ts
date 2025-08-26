class WebRTCService {
  private baseUrl: string;
  private headers: HeadersInit;
  private peerConnection: RTCPeerConnection | null;
  private sessionId: string | null;
  private iceCandidates: RTCIceCandidate[];
  private streamHandlers: Record<string, MediaStream>;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };
    this.peerConnection = null;
    this.sessionId = null;
    this.iceCandidates = [];
    this.streamHandlers = {};
  }

  async connect(
    deviceId: string,
    streamTypes: string[],
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void,
    onTrack?: (event: RTCTrackEvent) => void,
    onDataChannel?: (event: RTCDataChannelEvent) => void,
  ): Promise<string> {
    try {
      await this.disconnect();

      const offerResponse = await fetch(`${this.baseUrl}/webrtc/offer`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          device_id: deviceId,
          stream_types: streamTypes,
        }),
      });

      if (!offerResponse.ok) {
        throw new Error(`Failed to create offer: ${offerResponse.statusText}`);
      }

      const offerData = await offerResponse.json();
      const { session_id, sdp, type } = offerData;
      this.sessionId = session_id;

      this.peerConnection = new RTCPeerConnection();

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.iceCandidates.push(event.candidate);
          this._sendIceCandidate(event.candidate);
        }
      };

      if (onConnectionStateChange) {
        this.peerConnection.onconnectionstatechange = () => {
          onConnectionStateChange(this.peerConnection!.connectionState);
        };
      }

      if (onTrack) {
        this.peerConnection.ontrack = onTrack;
      }

      if (onDataChannel) {
        this.peerConnection.ondatachannel = onDataChannel;
      }

      await this.peerConnection.setRemoteDescription({ type, sdp });
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      const answerResponse = await fetch(`${this.baseUrl}/webrtc/answer`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          session_id,
          sdp: answer.sdp,
          type: answer.type,
        }),
      });

      if (!answerResponse.ok) {
        throw new Error(`Failed to send answer: ${answerResponse.statusText}`);
      }

      return session_id;
    } catch (error) {
      console.error('WebRTC connection error:', error);
      throw error;
    }
  }

  async startStream(deviceId: string, streamConfig: any[], alignTo: string | null) {
    if (!deviceId || streamConfig.length === 0) {
      console.error('Please select a device and at least one stream configuration');
      return;
    }

    try {
      const payload = {
        configs: streamConfig,
        align_to: alignTo || null,
      };

      const response = await fetch(`${this.baseUrl}/devices/${deviceId}/stream/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error starting stream: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error starting stream:', err);
    }
  }

  async stopStream(deviceId: string) {
    if (!deviceId) return;

    try {
      const response = await fetch(`${this.baseUrl}/devices/${deviceId}/stream/stop`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error stopping stream: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error stopping stream:', err);
    }
  }

  private async _sendIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.sessionId) return;

    try {
      const response = await fetch(`${this.baseUrl}/webrtc/ice-candidates`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          session_id: this.sessionId,
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        }),
      });

      if (!response.ok) {
        console.error('Failed to send ICE candidate:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to send ICE candidate:', error);
    }
  }

  async getSessionInfo(): Promise<unknown> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    try {
      const response = await fetch(`${this.baseUrl}/webrtc/sessions/${this.sessionId}`, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get session info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get session info:', error);
      throw error;
    }
  }

  async disconnect(): Promise<boolean> {
    if (!this.sessionId) {
      return true;
    }

    try {
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      const response = await fetch(`${this.baseUrl}/webrtc/sessions/${this.sessionId}`, {
        method: 'DELETE',
        headers: this.headers,
      });

      this.sessionId = null;
      this.iceCandidates = [];
      return response.ok;
    } catch (error) {
      console.error('Error disconnecting WebRTC session:', error);
      return false;
    }
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getIceCandidates(): RTCIceCandidate[] {
    return this.iceCandidates;
  }

  async activatePointCloud(deviceId: string) {
    if (!deviceId) {
      console.error('Please select a device');
      return;
    }

    try {

      const response = await fetch(`${this.baseUrl}/devices/${deviceId}/point_cloud/activate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error activating point cloud: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error activating point cloud:', err);
    }
  }

  async deactivatePointCloud(deviceId: string) {
    if (!deviceId) return;

    try {
      const response = await fetch(`${this.baseUrl}/devices/${deviceId}/point_cloud/deactivate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error deactivating point cloud: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error deactivating point cloud:', err);
    }
  }
}

export default WebRTCService;
