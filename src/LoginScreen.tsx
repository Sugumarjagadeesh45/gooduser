// src/LoginScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Geolocation from "@react-native-community/geolocation";

import api from "../utils/api"; // Axios instance pointing to your backend

interface LoginScreenProps {
  navigation: any;
}

// ---------------- Type for coordinates ----------------
interface Coordinates {
  latitude: number;
  longitude: number;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [driverId, setDriverId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ---------------- Request location permission ----------------
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message: "We need your location to login",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK",
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  // ---------------- Prompt user to enable High Accuracy ----------------
  const promptEnableHighAccuracy = () => {
    Alert.alert(
      "⚠️ Enable High Accuracy",
      "Your GPS is not in High Accuracy mode. Please enable it for proper login.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => Linking.openSettings(), // opens device location settings
        },
      ]
    );
  };

  // ---------------- Get current location with retry ----------------
  const getLocation = async (retries = 2): Promise<Coordinates> => {
    for (let i = 0; i <= retries; i++) {
      try {
        const coords = await new Promise<Coordinates>((resolve, reject) => {
          Geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => {
              if (err.code === 2) promptEnableHighAccuracy();
              reject(err);
            },
            { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 }
          );
        });
        return coords; // success
      } catch (err) {
        if (i === retries) throw err; // last attempt, throw error
      }
    }
    throw new Error("Unable to get location");
  };

  // ---------------- Handle Login ----------------
  const handleLogin = async () => {
    if (!driverId || !password) {
      Alert.alert("⚠️ Input Error", "Please enter driver ID and password");
      return;
    }

    setLoading(true);

    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setLoading(false);
      Alert.alert("⚠️ Permission Denied", "Location is required to login.");
      return;
    }

    try {
      const { latitude, longitude } = await getLocation();

      const res = await api.post("/drivers/login", {
        driverId,
        password,
        latitude,
        longitude,
      });

      if (res.status === 200) {
        const driver = res.data.driver;

        // Store auth info
        await AsyncStorage.multiSet([
          ["isRegistered", "true"],
          ["driverId", driver.driverId],
          ["driverName", driver.name],
          ["authToken", res.data.token],
        ]);

        Alert.alert("✅ Success", `Welcome ${driver.name || driverId}`);
        navigation.replace("Screen1", {
          driverId: driver.driverId,
          latitude,
          longitude,
        });
      } else {
        Alert.alert("❌ Login Failed", res.data.msg || "Invalid credentials");
      }
    } catch (err: any) {
      console.log("Location/Login Error:", err);

      if (err.code === 1) {
        // PERMISSION_DENIED
        Alert.alert("❌ Permission Denied", "Location permission is required.");
      } else if (err.code === 2) {
        // POSITION_UNAVAILABLE
        promptEnableHighAccuracy();
      } else if (err.code === 3) {
        // TIMEOUT
        Alert.alert(
          "❌ GPS Timeout",
          "Could not get location. Make sure GPS is enabled and try again."
        );
      } else {
        Alert.alert(
          "❌ GPS/Login Error",
          "Cannot get location. Please enable GPS High Accuracy and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Driver ID"
        value={driverId}
        onChangeText={setDriverId}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;

// ---------------- Styles ----------------
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    padding: 20, 
    backgroundColor: "#f5f5f5" 
  },
  title: { 
    fontSize: 28, 
    fontWeight: "bold", 
    marginBottom: 30 
  },
  input: { 
    width: "100%", 
    padding: 12, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: "#ccc", 
    borderRadius: 8, 
    backgroundColor: "#fff" 
  },
  button: { 
    width: "100%", 
    padding: 15, 
    backgroundColor: "#28a745", 
    borderRadius: 8, 
    alignItems: "center" 
  },
  buttonText: { 
    color: "#fff", 
    fontWeight: "bold", 
    fontSize: 16 
  },
});



// import React, { useState } from "react";
// import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
// import axios from "axios";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import Geolocation from "@react-native-community/geolocation";

// const API_BASE = "http://10.0.2.2:5000/api"; // backend (Android emulator)

// const LoginScreen = ({ navigation }: any) => {
//   const [driverId, setDriverId] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleLogin = async () => {
//     if (!driverId || !password) {
//       Alert.alert("⚠️ Error", "Please enter Driver ID and Password");
//       return;
//     }

//     setLoading(true);

//     // 👇 Get location before calling API
//     Geolocation.getCurrentPosition(
//       async (pos) => {
//         try {
//           const { latitude, longitude } = pos.coords;

//           const res = await axios.post(`${API_BASE}/drivers/login`, {
//             driverId,
//             password,
//             latitude,
//             longitude,
//           });

//           if (res.status === 200) {
//             const driver = res.data.driver;

//             // Save login state
//             await AsyncStorage.multiSet([
//               ["isRegistered", "true"],
//               ["driverId", driver.driverId],
//               ["driverName", driver.name],
//               ["authToken", res.data.token],
//             ]);

//             Alert.alert("✅ Success", `Welcome ${driver.name || driverId}`);
//             navigation.replace("Screen1", {
//               isNewUser: false,
//               phone: driver.phone,
//             });
//           } else {
//             Alert.alert("❌ Login Failed", res.data.msg || "Invalid credentials");
//           }
//         } catch (err: any) {
//           console.error("Login error", err.response || err.message);
//           Alert.alert("❌ Network Error", err.response?.data?.msg || err.message || "Failed to login");
//         } finally {
//           setLoading(false);
//         }
//       },
//       (error) => {
//         console.log("❌ Location error:", error.message);
//         setLoading(false);
//         Alert.alert("❌ Error", "Please enable GPS for login");
//       },
//       { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
//     );
//   };

//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>Driver Login</Text>

//       <TextInput
//         style={styles.input}
//         placeholder="Driver ID"
//         value={driverId}
//         onChangeText={setDriverId}
//       />

//       <TextInput
//         style={styles.input}
//         placeholder="Password"
//         value={password}
//         onChangeText={setPassword}
//         secureTextEntry
//       />

//       <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
//         {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
//       </TouchableOpacity>
//     </View>
//   );
// };

// export default LoginScreen;

// const styles = StyleSheet.create({
//   container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#f5f5f5" },
//   title: { fontSize: 28, fontWeight: "bold", marginBottom: 30 },
//   input: { width: "100%", padding: 12, marginBottom: 15, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, backgroundColor: "#fff" },
//   button: { width: "100%", padding: 15, backgroundColor: "#28a745", borderRadius: 8, alignItems: "center" },
//   buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
// });
