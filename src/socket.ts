import { io } from "socket.io-client";

const socket = io("http://10.0.2.2:5001", {
  transports: ["websocket"],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  console.log("🟢 Driver socket connected");
});

socket.on("connect_error", (err) => {
  console.log("🔴 Driver socket error:", err.message);
  Alert.alert("Network Error", "Connection to server failed. Check your internet.");
});

socket.on("disconnect", () => {
  console.log("🔴 Driver socket disconnected. Attempting to reconnect...");
});

socket.on("reconnect_failed", () => {
  console.log("🔴 Driver socket reconnection failed");
  Alert.alert("Network Error", "Unable to reconnect to the server. Restart the app.");
});

export default socket;












// import { io } from "socket.io-client";

// const socket = io("http://10.0.2.2:5001", {
//   transports: ["websocket"],
//   autoConnect: true,   // connects immediately
//   reconnection: true,  // auto-reconnect on network drop
// });

// export default socket;
