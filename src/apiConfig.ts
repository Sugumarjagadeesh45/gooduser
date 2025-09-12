// Toggle this flag to switch between environments
const useLocalhost = false; // 👈 Set to true for local, false for production

// For local testing, use appropriate IP for emulators/devices
const LOCAL_API_URL = Platform.select({
  ios: "http://localhost:5001/api",      // iOS simulator
  android: "http://10.0.2.2:5001/api",   // Android emulator
  default: "http://192.168.1.107:5001/api", // Local network IP (adjust as needed)
});

const LOCAL_SOCKET_URL = Platform.select({
  ios: "http://localhost:5001",
  android: "http://10.0.2.2:5001",
  default: "http://192.168.1.107:5001",
});

export const API_BASE = useLocalhost
  ? LOCAL_API_URL
  : "https://raidbackend.onrender.com/api";

export const SOCKET_URL = useLocalhost
  ? LOCAL_SOCKET_URL
  : "https://raidbackend.onrender.com";