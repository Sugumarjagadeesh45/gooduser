// import React, { useState, useEffect, useRef } from "react";
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   ActivityIndicator,
//   PermissionsAndroid,
//   Platform,
//   Alert,
//   Modal,
//   TextInput,
// } from "react-native";
// import MapView, { Marker, Polyline } from "react-native-maps";
// import Geolocation from "@react-native-community/geolocation";
// import socket from "./socket"; // Adjust path if needed
// import haversine from "haversine-distance";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// type LocationType = { latitude: number; longitude: number };
// type RideType = {
//   rideId: string;
//   otp?: string;
//   pickup: LocationType & { address?: string };
//   drop: LocationType & { address?: string };
//   routeCoords?: LocationType[];
// };

// const DriverScreen = () => {
//   const [location, setLocation] = useState<LocationType | null>(null);
//   const [ride, setRide] = useState<RideType | null>(null);
//   const [travelledKm, setTravelledKm] = useState(0);
//   const [lastCoord, setLastCoord] = useState<LocationType | null>(null);
//   const [otpModalVisible, setOtpModalVisible] = useState(false);
//   const [enteredOtp, setEnteredOtp] = useState("");
//   const [rideStatus, setRideStatus] = useState<
//     "idle" | "onTheWay" | "accepted" | "started" | "completed"
//   >("idle");
//   const [driverId, setDriverId] = useState<string | null>(null);
//   const [driverInfo, setDriverInfo] = useState<any>(null);
//   const [isLoading, setIsLoading] = useState(false);

//   const mapRef = useRef<MapView | null>(null);
//   const watchIdRef = useRef<number | null>(null);
//   const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

//   // Load driverId and driver info from AsyncStorage
//   useEffect(() => {
//     const loadDriverInfo = async () => {
//       try {
//         const storedDriverId = await AsyncStorage.getItem("driverId");
//         const storedDriverName = await AsyncStorage.getItem("driverName");
//         const storedVehicleType = await AsyncStorage.getItem("vehicleType");
        
//         if (storedDriverId) {
//           setDriverId(storedDriverId);
//           setDriverInfo({
//             driverId: storedDriverId,
//             name: storedDriverName || `Driver ${storedDriverId}`,
//             vehicleType: storedVehicleType || "taxi"
//           });
//           console.log(`🚗 Driver info loaded: ${storedDriverId}, ${storedDriverName}, ${storedVehicleType}`);
//         }
//       } catch (error) {
//         console.error("Error loading driver info:", error);
//       }
//     };
//     loadDriverInfo();
//   }, []);

//   // Location tracking with error handling
//   useEffect(() => {
//     const requestLocation = async () => {
//       try {
//         if (Platform.OS === "android") {
//           const granted = await PermissionsAndroid.request(
//             PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
//           );
//           if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
//             Alert.alert("Permission Denied", "Location permission is required");
//             return;
//           }
//         }

//         // Get initial location
//         Geolocation.getCurrentPosition(
//           (pos) => {
//             const loc: LocationType = {
//               latitude: pos.coords.latitude,
//               longitude: pos.coords.longitude,
//             };
//             setLocation(loc);
//             console.log(`📍 Initial driver location: ${loc.latitude}, ${loc.longitude}`);
            
//             // Register driver with initial location
//             if (driverId && driverInfo) {
//               socket.emit("registerDriver", {
//                 driverId: driverId,
//                 latitude: loc.latitude,
//                 longitude: loc.longitude,
//                 vehicleType: driverInfo.vehicleType,
//                 name: driverInfo.name
//               });
//               console.log(`✅ Driver ${driverId} registered with backend`);
//             }

//             if (mapRef.current) {
//               mapRef.current.animateToRegion(
//                 {
//                   latitude: loc.latitude,
//                   longitude: loc.longitude,
//                   latitudeDelta: 0.01,
//                   longitudeDelta: 0.01,
//                 },
//                 500
//               );
//             }
//           },
//           (err) => {
//             console.log("🔴 Initial location error:", err);
//             Alert.alert("Location Error", "Failed to get initial location.");
//           },
//           { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
//         );

//         // Start watching position
//         watchIdRef.current = Geolocation.watchPosition(
//           (pos) => {
//             const loc: LocationType = {
//               latitude: pos.coords.latitude,
//               longitude: pos.coords.longitude,
//             };
//             setLocation(loc);

//             if (mapRef.current) {
//               mapRef.current.animateToRegion(
//                 {
//                   latitude: loc.latitude,
//                   longitude: loc.longitude,
//                   latitudeDelta: 0.01,
//                   longitudeDelta: 0.01,
//                 },
//                 500
//               );
//             }

//             // Calculate travelled distance
//             if (lastCoord) {
//               const dist = haversine(lastCoord, loc);
//               setTravelledKm((prev) => prev + dist / 1000);
//             }
//             setLastCoord(loc);
//           },
//           (err) => {
//             console.log("🔴 Watch position error:", err);
//           },
//           { 
//             enableHighAccuracy: true, 
//             distanceFilter: 5, // Update every 5 meters
//             interval: 5000,    // Check every 5 seconds
//             fastestInterval: 2000 // Minimum 2 second intervals
//           }
//         );
//       } catch (error) {
//         console.log("🔴 Location request error:", error);
//         Alert.alert("Location Error", "Unable to start location tracking.");
//       }
//     };

//     if (driverId && driverInfo) {
//       requestLocation();
//     }

//     return () => {
//       if (watchIdRef.current) {
//         Geolocation.clearWatch(watchIdRef.current);
//       }
//       if (locationUpdateIntervalRef.current) {
//         clearInterval(locationUpdateIntervalRef.current);
//       }
//     };
//   }, [driverId, driverInfo]);

//   // Regular location updates to backend
//   useEffect(() => {
//     if (driverId && driverInfo && location) {
//       // Send location updates every 3 seconds
//       locationUpdateIntervalRef.current = setInterval(() => {
//         if (location) {
//           const payload = {
//             driverId: driverId,
//             lat: location.latitude,
//             lng: location.longitude,
//             vehicleType: driverInfo.vehicleType
//           };

//           if (ride && rideStatus === "started" && ride.rideId) {
//             // During active ride - emit ride-specific location update
//             socket.emit("driverLocationUpdate", { 
//               ...payload, 
//               rideId: ride.rideId 
//             });
//             console.log(`📡 Ride location update sent for ${driverId}`);
//           } else {
//             // When idle - emit general live location update
//             socket.emit("driverLiveLocationUpdate", payload);
//             console.log(`📡 Live location update sent for ${driverId}: ${location.latitude}, ${location.longitude}`);
//           }
//         }
//       }, 3000); // Every 3 seconds
//     }

//     return () => {
//       if (locationUpdateIntervalRef.current) {
//         clearInterval(locationUpdateIntervalRef.current);
//       }
//     };
//   }, [location, ride, rideStatus, driverId, driverInfo]);

//   // Listen for ride requests
//   useEffect(() => {
//     const handleRideRequest = (data: any) => {
//       if (!driverId) {
//         console.log("🔴 No driverId available for ride request");
//         return;
//       }
//       try {
//         const formattedRide: RideType = {
//           rideId: data.rideId,
//           pickup: {
//             latitude: Number(data.pickup.lat),
//             longitude: Number(data.pickup.lng),
//             address: data.pickup.address,
//           },
//           drop: {
//             latitude: Number(data.drop.lat),
//             longitude: Number(data.drop.lng),
//             address: data.drop.address,
//           },
//           routeCoords: data.routeCoords?.map((c: any) => ({
//             latitude: Number(c.lat),
//             longitude: Number(c.lng),
//           })) || [],
//         };
//         setRide(formattedRide);
//         setRideStatus("onTheWay");
//         Alert.alert("New Ride Request", `Pickup at: ${formattedRide.pickup.address}`, [
//           { text: "Accept", onPress: () => acceptRide() },
//           { text: "Reject", onPress: rejectRide },
//         ]);
//       } catch (error) {
//         console.error("🔴 Error processing ride request:", error);
//         Alert.alert("Error", "Invalid ride data received");
//       }
//     };

//     socket.on("rideRequest", handleRideRequest);

//     return () => {
//       socket.off("rideRequest", handleRideRequest);
//     };
//   }, [driverId]);

//   // Handle ride accepted response
//   useEffect(() => {
//     const handleRideAccepted = ({ rideId }: { rideId: string }) => {
//       if (ride && ride.rideId === rideId) {
//         setRideStatus("accepted");
//         Alert.alert("Ride Accepted", "Waiting for OTP from user.");
//       }
//     };

//     socket.on("rideAccepted", handleRideAccepted);

//     return () => {
//       socket.off("rideAccepted", handleRideAccepted);
//     };
//   }, [ride]);

//   // Handle OTP verification response
//   useEffect(() => {
//     const handleOtpSuccess = ({ rideId }: { rideId: string }) => {
//       if (ride && ride.rideId === rideId) {
//         setRideStatus("started");
//         Alert.alert("Ride Started", "Journey has begun!");
//       }
//     };

//     const handleOtpFailed = ({ rideId }: { rideId: string }) => {
//       if (ride && ride.rideId === rideId) {
//         Alert.alert("Invalid OTP", "Please try again.");
//       }
//     };

//     socket.on("rideStarted", handleOtpSuccess);
//     socket.on("otpFailed", handleOtpFailed);

//     return () => {
//       socket.off("rideStarted", handleOtpSuccess);
//       socket.off("otpFailed", handleOtpFailed);
//     };
//   }, [ride]);

//   // Accept ride
//   const acceptRide = () => {
//     if (!ride || !driverId) return;
//     setIsLoading(true);
//     socket.emit("acceptRide", { rideId: ride.rideId, driverId });
//     setIsLoading(false);
//   };

//   // Reject ride
//   const rejectRide = () => {
//     if (!ride || !driverId) return;
//     setIsLoading(true);
//     socket.emit("rejectRide", { rideId: ride.rideId, driverId });
//     setRide(null);
//     setRideStatus("idle");
//     setIsLoading(false);
//   };

//   // Confirm OTP
//   const confirmOTP = () => {
//     if (!ride || !driverId) return;
//     setIsLoading(true);
//     socket.emit("verifyRideOTP", {
//       rideId: ride.rideId,
//       enteredOtp,
//       driverId,
//     });
//     setEnteredOtp("");
//     setOtpModalVisible(false);
//     setIsLoading(false);
//   };

//   // Complete ride
//   const completeRide = () => {
//     if (!ride || !driverId) return;
//     setIsLoading(true);
//     socket.emit("rideStatusUpdate", {
//       rideId: ride.rideId,
//       status: "completed"
//     });
    
//     // Reset ride state
//     setRide(null);
//     setRideStatus("idle");
//     setTravelledKm(0);
//     setLastCoord(null);
//     setIsLoading(false);
    
//     Alert.alert("Ride Completed", `Total distance: ${travelledKm.toFixed(2)} km`);
//   };

//   if (!location)
//     return (
//       <View style={styles.loadingContainer}>
//         <ActivityIndicator size="large" color="#4caf50" />
//         <Text>Fetching your location...</Text>
//       </View>
//     );

//   return (
//     <View style={styles.container}>
//       <View style={styles.statusBar}>
//         <Text style={styles.statusText}>
//           Driver: {driverInfo?.name || driverId} | Status: {rideStatus.toUpperCase()}
//         </Text>
//         <Text style={styles.locationText}>
//           Lat: {location.latitude.toFixed(6)}, Lng: {location.longitude.toFixed(6)}
//         </Text>
//       </View>

//       <MapView
//         ref={mapRef}
//         style={styles.map}
//         initialRegion={{
//           latitude: location.latitude,
//           longitude: location.longitude,
//           latitudeDelta: 0.01,
//           longitudeDelta: 0.01,
//         }}
//         showsUserLocation
//         showsMyLocationButton
//       >
//         {ride && <Marker coordinate={ride.pickup} title="Pickup" pinColor="blue" />}
//         {ride && <Marker coordinate={ride.drop} title="Drop" pinColor="red" />}
//         {ride && ride.routeCoords && (
//           <Polyline coordinates={ride.routeCoords} strokeWidth={5} strokeColor="#4caf50" />
//         )}
//       </MapView>

//       {isLoading && (
//         <View style={styles.loadingOverlay}>
//           <ActivityIndicator size="large" color="#4caf50" />
//         </View>
//       )}

//       {ride && rideStatus === "onTheWay" && (
//         <View style={styles.buttonContainer}>
//           <TouchableOpacity
//             style={[styles.button, { backgroundColor: "#4caf50", flex: 1, marginRight: 5 }]}
//             onPress={acceptRide}
//             disabled={isLoading}
//           >
//             <Text style={styles.btnText}>Accept Ride</Text>
//           </TouchableOpacity>
//           <TouchableOpacity
//             style={[styles.button, { backgroundColor: "#f44336", flex: 1, marginLeft: 5 }]}
//             onPress={rejectRide}
//             disabled={isLoading}
//           >
//             <Text style={styles.btnText}>Reject Ride</Text>
//           </TouchableOpacity>
//         </View>
//       )}

//       {ride && rideStatus === "accepted" && (
//         <TouchableOpacity
//           style={styles.button}
//           onPress={() => setOtpModalVisible(true)}
//           disabled={isLoading}
//         >
//           <Text style={styles.btnText}>Enter OTP & Start Ride</Text>
//         </TouchableOpacity>
//       )}

//       {ride && rideStatus === "started" && (
//         <TouchableOpacity
//           style={styles.button}
//           onPress={completeRide}
//           disabled={isLoading}
//         >
//           <Text style={styles.btnText}>Complete Ride ({travelledKm.toFixed(2)} km)</Text>
//         </TouchableOpacity>
//       )}

//       <Modal visible={otpModalVisible} transparent animationType="slide">
//         <View style={styles.modalContainer}>
//           <View style={styles.modalContent}>
//             <Text style={styles.modalTitle}>Enter OTP from User</Text>
//             <TextInput
//               placeholder="Enter 4-digit OTP"
//               value={enteredOtp}
//               onChangeText={setEnteredOtp}
//               keyboardType="numeric"
//               style={styles.input}
//               maxLength={4}
//             />
//             <View style={styles.modalButtons}>
//               <TouchableOpacity
//                 style={[styles.button, { backgroundColor: "#f44336", flex: 1, marginRight: 5 }]}
//                 onPress={() => {
//                   setOtpModalVisible(false);
//                   setEnteredOtp("");
//                 }}
//               >
//                 <Text style={styles.btnText}>Cancel</Text>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 style={[styles.button, { backgroundColor: "#4caf50", flex: 1, marginLeft: 5 }]}
//                 onPress={confirmOTP}
//                 disabled={isLoading || enteredOtp.length !== 4}
//               >
//                 <Text style={styles.btnText}>Confirm OTP</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// };

// export default DriverScreen;

// const styles = StyleSheet.create({
//   container: { flex: 1 },
//   statusBar: {
//     backgroundColor: "#2196F3",
//     padding: 10,
//     paddingTop: Platform.OS === "ios" ? 40 : 10,
//   },
//   statusText: {
//     color: "#fff",
//     fontSize: 16,
//     fontWeight: "bold",
//     textAlign: "center",
//   },
//   locationText: {
//     color: "#fff",
//     fontSize: 12,
//     textAlign: "center",
//     marginTop: 2,
//   },
//   map: { flex: 1 },
//   buttonContainer: {
//     flexDirection: "row",
//     justifyContent: "space-around",
//     margin: 10,
//   },
//   button: {
//     backgroundColor: "#4caf50",
//     padding: 15,
//     borderRadius: 8,
//     margin: 10,
//     alignItems: "center",
//   },
//   btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
//   loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
//   modalContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     backgroundColor: "rgba(0,0,0,0.5)",
//   },
//   modalContent: {
//     backgroundColor: "#fff",
//     padding: 20,
//     borderRadius: 10,
//     width: "80%",
//     maxWidth: 300,
//   },
//   modalTitle: { 
//     fontSize: 18, 
//     fontWeight: "bold", 
//     marginBottom: 15, 
//     textAlign: "center" 
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: "#ddd",
//     borderRadius: 5,
//     marginVertical: 10,
//     padding: 15,
//     fontSize: 18,
//     textAlign: "center",
//     letterSpacing: 2,
//   },
//   modalButtons: {
//     flexDirection: "row",
//     marginTop: 10,
//   },
//   loadingOverlay: {
//     ...StyleSheet.absoluteFillObject,
//     justifyContent: "center",
//     alignItems: "center",
//     backgroundColor: "rgba(0,0,0,0.3)",
//   },
// });














// D:\newapp\driverapp-main\driverapp-main\src\Screen1.tsx
import React, { useState, useEffect, useRef } from "react";
import { 
  View, Text, TouchableOpacity, StyleSheet, 
  ActivityIndicator, PermissionsAndroid, Platform, 
  Alert, Modal, TextInput 
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import Geolocation from "@react-native-community/geolocation";
import socket from "./socket";
import haversine from "haversine-distance";
import { API_BASE } from "./apiConfig";

type LocationType = { latitude: number; longitude: number };
type RideType = {
  rideId: string;
  otp?: string;
  pickup: LocationType & { address?: string };
  drop: LocationType & { address?: string };
  routeCoords?: LocationType[];
};

const DriverScreen = () => {
  const [location, setLocation] = useState<LocationType | null>(null);
  const [ride, setRide] = useState<RideType | null>(null);
  const [travelledKm, setTravelledKm] = useState(0);
  const [lastCoord, setLastCoord] = useState<LocationType | null>(null);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [rideStatus, setRideStatus] = useState<"idle" | "onTheWay" | "accepted" | "started" | "completed">("idle");
  const [isRegistered, setIsRegistered] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [driverStatus, setDriverStatus] = useState<"offline" | "online" | "onRide">("offline");
  const mapRef = useRef<MapView | null>(null);

  // ---------- Helper Functions ----------
  const saveLocationToDatabase = async (location: LocationType) => {
    try {
      console.log("Saving location to DB:", location);
      const response = await fetch(`${API_BASE}/driver-location/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: "D001",
          latitude: location.latitude,
          longitude: location.longitude,
          vehicleType: "taxi",
          status: driverStatus === "onRide" ? "OnRide" : "Live"
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Location saved to DB:", data);
    } catch (error) {
      console.error("Error saving location to DB:", error);
    }
  };

  const fetchRoute = async (origin: LocationType, destination: LocationType) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]: number[]) => ({ 
          latitude: lat, 
          longitude: lng 
        }));
        
        setRide(prev => prev ? { ...prev, routeCoords: coords } : null);
      }
    } catch (error) {
      console.error("Error fetching route:", error);
    }
  };

  const acceptRide = async () => {
    if (!ride) return;
    setRideStatus("accepted");
    setDriverStatus("onRide");
    
    // 获取路线
    await fetchRoute(location, ride.pickup);
    
    // 通知后端接受行程
    socket.emit("acceptRide", {
      rideId: ride.rideId,
      driverId: "D001"
    });
    
    Alert.alert("Ride Accepted", "You can now go to pickup location.");
  };

  const rejectRide = () => {
    if (!ride) return;
    setRide(null);
    setRideStatus("idle");
    
    // 通知后端拒绝行程
    socket.emit("rejectRide", {
      rideId: ride.rideId,
      driverId: "D001"
    });
    
    Alert.alert("Ride Rejected", "You rejected the ride.");
  };

  const confirmOTP = async () => {
    if (!ride) return;
    if (enteredOtp === ride.otp) {
      setRideStatus("started");
      setOtpModalVisible(false);
      
      // 获取到目的地的路线
      await fetchRoute(location, ride.drop);
      
      Alert.alert("OTP Verified", "Ride started successfully!");
    } else {
      Alert.alert("Invalid OTP", "Please try again.");
    }
  };

  const completeRide = () => {
    setRideStatus("completed");
    setDriverStatus("online");
    
    // 通知后端完成行程
    if (ride) {
      socket.emit("completeRide", {
        rideId: ride.rideId,
        driverId: "D001",
        distance: travelledKm
      });
    }
    
    Alert.alert("Ride Completed", `You travelled ${travelledKm.toFixed(2)} km.`);
    setRide(null);
    setTravelledKm(0);
  };

  // ---------- Location Tracking ----------
  useEffect(() => {
    const requestLocation = async () => {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert("Permission Denied", "Location permission is required");
          return;
        }
      }
      
      const watchId = Geolocation.watchPosition(
        (pos) => {
          const loc: LocationType = { 
            latitude: pos.coords.latitude, 
            longitude: pos.coords.longitude 
          };
          
          console.log(`Driver location updated: lat=${loc.latitude}, lng=${loc.longitude}`);
          setLocation(loc);
          mapRef.current?.animateToRegion(
            { 
              latitude: loc.latitude, 
              longitude: loc.longitude, 
              latitudeDelta: 0.01, 
              longitudeDelta: 0.01 
            },
            500
          );
          
          if (lastCoord) {
            const dist = haversine(lastCoord, loc);
            setTravelledKm((prev) => prev + dist / 1000);
          }
          setLastCoord(loc);
          
          // Register driver on first location update
          if (!isRegistered) {
            console.log("Registering driver with socket...");
            socket.emit("registerDriver", {
              driverId: "D001",
              latitude: loc.latitude,
              longitude: loc.longitude,
              vehicleType: "taxi",
              name: "Driver D001"
            });
            setIsRegistered(true);
            setDriverStatus("online");
          }
          
          // Emit live location updates
          console.log("Emitting driver live location update...");
          socket.emit("driverLiveLocationUpdate", {
            driverId: "D001",
            lat: loc.latitude,
            lng: loc.longitude
          });
          
          // Also emit the alternative event name for compatibility
          socket.emit("driverLocationUpdate", {
            driverId: "D001",
            latitude: loc.latitude,
            longitude: loc.longitude
          });
          
          // Save to database
          saveLocationToDatabase(loc);
        },
        (err) => {
          console.log("Geolocation error:", err);
          Alert.alert("Location Error", "Could not get location. Please check GPS settings.");
        },
        { 
          enableHighAccuracy: true, 
          distanceFilter: 10,  // 增加距离过滤器到10米
          interval: 5000,     // 增加更新间隔到5秒
          fastestInterval: 2000 // 最快更新间隔2秒
        }
      );
      
      return () => {
        console.log("Clearing location watch...");
        Geolocation.clearWatch(watchId);
      };
    };
    
    requestLocation();
  }, [lastCoord, isRegistered, driverStatus]);

  // Socket event listeners
  useEffect(() => {
    console.log("Setting up socket listeners...");
    
    // 连接事件
    socket.on("connect", () => {
      console.log("Driver socket connected:", socket.id);
      setSocketConnected(true);
      // 如果已有位置，重新注册
      if (location && !isRegistered) {
        socket.emit("registerDriver", {
          driverId: "D001",
          latitude: location.latitude,
          longitude: location.longitude,
          vehicleType: "taxi",
          name: "Driver D001"
        });
        setIsRegistered(true);
        setDriverStatus("online");
      }
    });
    
    // 断开连接事件
    socket.on("disconnect", (reason) => {
      console.log("Driver socket disconnected, reason:", reason);
      setSocketConnected(false);
      setIsRegistered(false);
      setDriverStatus("offline");
    });
    
    // 连接错误事件
    socket.on("connect_error", (error) => {
      console.log("Socket connection error:", error);
      setSocketConnected(false);
    });
    
    // 新行程请求
    socket.on("newRideRequest", (data) => {
      console.log("New ride request received:", data);
      setRide({
        rideId: data.rideId,
        otp: data.otp,
        pickup: data.pickup,
        drop: data.drop
      });
      setRideStatus("onTheWay");
      Alert.alert("New Ride Request", "You have a new ride request!");
    });
    
    return () => {
      console.log("Cleaning up socket listeners...");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("newRideRequest");
    };
  }, [location, isRegistered]);

  // ---------- UI ----------
  if (!location)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4caf50" />
        <Text>Fetching your location...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ 
          latitude: location.latitude, 
          longitude: location.longitude, 
          latitudeDelta: 0.01, 
          longitudeDelta: 0.01 
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {ride && (
          <Marker 
            coordinate={ride.pickup} 
            title="Pickup" 
            pinColor="blue" 
          />
        )}
        {ride && (
          <Marker 
            coordinate={ride.drop} 
            title="Drop" 
            pinColor="red" 
          />
        )}
        {ride?.routeCoords && (
          <Polyline 
            coordinates={ride.routeCoords} 
            strokeWidth={5} 
            strokeColor="#4caf50" 
          />
        )}
      </MapView>
      
      {/* Status indicator */}
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>
            Socket: {socketConnected ? "Connected" : "Disconnected"}
          </Text>
          <Text style={[
            styles.statusText, 
            { color: driverStatus === "online" ? "#4caf50" : driverStatus === "onRide" ? "#ff9800" : "#f44336" }
          ]}>
            Status: {driverStatus === "online" ? "Online" : driverStatus === "onRide" ? "On Ride" : "Offline"}
          </Text>
        </View>
        <Text style={styles.locationText}>
          Lat: {location.latitude.toFixed(6)}, Lng: {location.longitude.toFixed(6)}
        </Text>
      </View>
      
      {ride && rideStatus === "onTheWay" && (
        <View style={styles.rideActions}>
          <TouchableOpacity 
            style={[styles.button, styles.acceptButton]} 
            onPress={acceptRide}
          >
            <Text style={styles.btnText}>Accept Ride</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.rejectButton]} 
            onPress={rejectRide}
          >
            <Text style={styles.btnText}>Reject Ride</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {ride && rideStatus === "accepted" && (
        <TouchableOpacity 
          style={[styles.button, styles.startButton]} 
          onPress={() => setOtpModalVisible(true)}
        >
          <Text style={styles.btnText}>Enter OTP & Start Ride</Text>
        </TouchableOpacity>
      )}
      
      {ride && rideStatus === "started" && (
        <TouchableOpacity 
          style={[styles.button, styles.completeButton]} 
          onPress={completeRide}
        >
          <Text style={styles.btnText}>
            Complete Ride ({travelledKm.toFixed(2)} km)
          </Text>
        </TouchableOpacity>
      )}
      
      <Modal 
        visible={otpModalVisible} 
        transparent 
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter OTP</Text>
            <TextInput 
              placeholder="Enter 4-digit OTP"
              value={enteredOtp}
              onChangeText={setEnteredOtp}
              keyboardType="numeric"
              style={styles.input}
              maxLength={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => setOtpModalVisible(false)}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.confirmButton]} 
                onPress={confirmOTP}
              >
                <Text style={styles.btnText}>Confirm OTP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default DriverScreen;

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center",
    backgroundColor: "#f5f5f5"
  },
  statusContainer: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 8,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  rideActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    margin: 10,
    gap: 10,
  },
  button: { 
    padding: 15, 
    borderRadius: 8, 
    alignItems: "center",
    elevation: 2,
    minWidth: 120,
  },
  acceptButton: { 
    backgroundColor: "#4caf50", 
    flex: 1 
  },
  rejectButton: { 
    backgroundColor: "#f44336", 
    flex: 1 
  },
  startButton: { 
    backgroundColor: "#2196f3", 
    margin: 10 
  },
  completeButton: { 
    backgroundColor: "#ff9800", 
    margin: 10 
  },
  cancelButton: { 
    backgroundColor: "#757575", 
    flex: 1, 
    marginRight: 5 
  },
  confirmButton: { 
    backgroundColor: "#4caf50", 
    flex: 1, 
    marginLeft: 5 
  },
  btnText: { 
    color: "#fff", 
    fontWeight: "bold",
    fontSize: 14,
  },
  modalContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "rgba(0,0,0,0.5)" 
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: '80%',
    elevation: 5,
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: "bold", 
    marginBottom: 15,
    textAlign: 'center',
    color: "#333"
  },
  input: { 
    borderWidth: 1, 
    borderColor: "#ddd", 
    borderRadius: 5, 
    marginVertical: 10, 
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
});