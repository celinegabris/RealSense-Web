import { io } from "socket.io-client";

const socket = io("http://localhost:8000", {
  path: "/socket",
  transports: ["websocket"],
  reconnection: true,
  autoConnect: true,
});

export default socket; 
