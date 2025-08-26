import { io, Socket } from 'socket.io-client';

const SOCKET_URL =  `${window.location.protocol}//${window.location.hostname}:8000`;

const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket'],
  upgrade: false,
  path: '/socket',
});

export default socket;
