// D:\newapp\driverapp-main\driverapp-main\src\Screen1.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import Geolocation from "@react-native-community/geolocation";
import socket from "./socket";
import haversine from "haversine-distance";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "./apiConfig";

type LocationType = { latitude: number; longitude: number };
type RideType = {
  rideId: string;
  RAID_ID?: string;
  otp?: string;
  pickup: LocationType & { address?: string };
  drop: LocationType & { address?: string };
  routeCoords?: LocationType[];
  fare?: number;
  distance?: string;
};

const DriverScreen = () => {
  const [location, setLocation] = useState<LocationType | null>(null);
  const [ride, setRide] = useState<RideType | null>(null);
  const [travelledKm, setTravelledKm] = useState(0);
  const [lastCoord, setLastCoord] = useState<LocationType | null>(null);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [rideStatus, setRideStatus] = useState<
    "idle" | "onTheWay" | "accepted" | "started" | "completed"
  >("idle");
  const [isRegistered, setIsRegistered] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [driverStatus, setDriverStatus] = useState<
    "offline" | "online" | "onRide"
  >("offline");
  const mapRef = useRef<MapView | null>(null);
  const [driverId, setDriverId] = useState<string>("");
  const [driverName, setDriverName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  // Refs for preventing state updates on unmounted component
  const isMounted = useRef(true);
  
  // Console log for component initialization
  console.log("🚗 DriverScreen component initialized");
  
  // Set up isMounted ref
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Update saveLocationToDatabase function
  const saveLocationToDatabase = async (location: LocationType) => {
    try {
      console.log("💾 Saving location to DB for driver:", driverId);
      
      const payload = {
        driverId,
        driverName: driverName || "Unknown Driver",
        latitude: location.latitude,
        longitude: location.longitude,
        vehicleType: "taxi",
        status: driverStatus === "onRide" ? "OnRide" : "Live",
        timestamp: new Date().toISOString(),
      };
      
      const response = await fetch(`${API_BASE}/driver-location/update`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await AsyncStorage.getItem('authToken')}`
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Failed to save location:", {
          status: response.status,
          message: errorText
        });
        
        // Only throw critical errors
        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }
        return; // Don't throw for non-critical errors
      }
      
      const responseData = await response.json();
      console.log("✅ Location saved successfully:", responseData);
      
    } catch (error) {
      console.error("❌ Error saving location to DB:", error.message || error);
      
      // Only show alert for critical errors that need user attention
      if (error.message.includes("Server error") || error.message.includes("Network")) {
        if (isMounted.current) {
          Alert.alert("Sync Error", "Having trouble updating your location. Some features may be affected.");
        }
      }
    }
  };
  
  // Register driver if not registered and location/driverId is available
  useEffect(() => {
    console.log("🔍 Driver registration check:", {
      isRegistered,
      hasDriverId: !!driverId,
      hasLocation: !!location
    });
    
    if (!isRegistered && driverId && location) {
      console.log("📝 Registering driver with socket:", driverId);
      socket.emit("registerDriver", {
        driverId,
        driverName,
        latitude: location.latitude,
        longitude: location.longitude,
        vehicleType: "taxi",
      });
      setIsRegistered(true);
      setDriverStatus("online");
      console.log("✅ Driver registration emitted, status set to online");
    }
  }, [driverId, location, isRegistered, driverName]);
  
  // Load driver info from AsyncStorage
  useEffect(() => {
    const loadDriverInfo = async () => {
      try {
        console.log("📂 Loading driver info from AsyncStorage...");
        const storedDriverId = await AsyncStorage.getItem("driverId");
        const storedDriverName = await AsyncStorage.getItem("driverName");
        
        console.log("📋 Retrieved driver info:", {
          driverId: storedDriverId,
          driverName: storedDriverName
        });
        
        if (storedDriverId) setDriverId(storedDriverId);
        if (storedDriverName) setDriverName(storedDriverName);
        
        console.log("✅ Driver info loaded successfully");
      } catch (error) {
        console.error("❌ Error loading driver info:", error);
      }
    };
    loadDriverInfo();
  }, []);
  
  const fetchRoute = async (origin: LocationType, destination: LocationType) => {
    try {
      console.log("🗺️ Fetching route between:", {
        origin: { lat: origin.latitude, lng: origin.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude }
      });
      
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(
          ([lng, lat]: number[]) => ({
            latitude: lat,
            longitude: lng,
          })
        );
        
        console.log("✅ Route fetched successfully, coordinates count:", coords.length);
        setRide((prev) => (prev ? { ...prev, routeCoords: coords } : null));
      } else {
        console.error("❌ No routes found in response");
      }
    } catch (error) {
      console.error("❌ Error fetching route:", error);
    }
  };
  
  const acceptRide = async (rideId?: string) => {
    const currentRideId = rideId || ride?.rideId;
    console.log("👍 Accepting ride:", {
      rideId: currentRideId,
      currentStatus: rideStatus
    });
    
    if (!currentRideId) {
      console.error("❌ No ride ID provided for acceptance");
      return;
    }
    
    setRideStatus("accepted");
    setDriverStatus("onRide");
    console.log("📊 Status updated: accepted, onRide");
    
    if (location && ride?.pickup) {
      console.log("🗺️ Fetching route to pickup location");
      await fetchRoute(location, ride.pickup);
    }
    
    console.log("📡 Emitting acceptRide event:", {
      rideId: currentRideId,
      driverId,
      driverName
    });
    
    socket.emit("acceptRide", {
      rideId: currentRideId,
      driverId,
      driverName,
    });
    
    console.log("✅ Ride acceptance emitted");
    if (isMounted.current) {
      Alert.alert("Ride Accepted ✅", "Proceed to pickup location");
    }
  };
  
  const rejectRide = (rideId?: string) => {
    const currentRideId = rideId || ride?.rideId;
    console.log("👎 Rejecting ride:", {
      rideId: currentRideId,
      currentStatus: rideStatus
    });
    
    if (!currentRideId) {
      console.error("❌ No ride ID provided for rejection");
      return;
    }
    
    setRide(null);
    setRideStatus("idle");
    setDriverStatus("online");
    console.log("📊 Status updated: idle, online");
    
    console.log("📡 Emitting rejectRide event:", {
      rideId: currentRideId,
      driverId
    });
    
    socket.emit("rejectRide", {
      rideId: currentRideId,
      driverId,
    });
    
    console.log("✅ Ride rejection emitted");
    if (isMounted.current) {
      Alert.alert("Ride Rejected ❌", "You rejected the ride");
    }
  };
  
const confirmOTP = async () => {
  console.log("🔢 Confirming OTP:", {
    enteredOTP: enteredOtp,
    expectedOTP: ride?.otp,
    rideId: ride?.rideId
  });
  
  if (!ride) {
    console.error("❌ No ride available to confirm OTP");
    return;
  }
  
  if (!ride.otp) {
    console.error("❌ No OTP available for this ride");
    Alert.alert("Error", "OTP not yet received. Please wait...");
    return;
  }
  
  if (enteredOtp === ride.otp) {
    console.log("✅ OTP verification successful");
    setRideStatus("started");
    setOtpModalVisible(false);
    
    if (location) {
      console.log("🗺️ Fetching route to destination");
      await fetchRoute(location, ride.drop);
    }
    
    Alert.alert("OTP Verified", "Ride started successfully!");
  } else {
    console.error("❌ OTP verification failed");
    Alert.alert("Invalid OTP", "Please try again.");
  }
};
  
  const completeRide = () => {
    console.log("🏁 Completing ride:", {
      rideId: ride?.rideId,
      distance: travelledKm
    });
    
    if (!ride) {
      console.error("❌ No ride available to complete");
      return;
    }
    
    setRideStatus("completed");
    setDriverStatus("online");
    console.log("📊 Status updated: completed, online");
    
    console.log("📡 Emitting completeRide event:", {
      rideId: ride.rideId,
      driverId,
      distance: travelledKm
    });
    
    socket.emit("completeRide", {
      rideId: ride.rideId,
      driverId,
      distance: travelledKm,
    });
    
    console.log("✅ Ride completion emitted");
    if (isMounted.current) {
      Alert.alert("Ride Completed", `You travelled ${travelledKm.toFixed(2)} km.`);
    }
    setRide(null);
    setTravelledKm(0);
  };
  
  // ---------- Location Tracking ----------
  useEffect(() => {
    console.log("📍 Setting up location tracking...");
    let watchId: number | null = null;
    
    const requestLocation = async () => {
      try {
        if (Platform.OS === "android") {
          console.log("🔐 Requesting Android location permission...");
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: "Location Permission",
              message: "This app needs access to your location to track rides",
              buttonNeutral: "Ask Me Later",
              buttonNegative: "Cancel",
              buttonPositive: "OK",
            }
          );
          
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.error("❌ Location permission denied");
            if (isMounted.current) {
              Alert.alert("Permission Denied", "Location permission is required for this app to work");
            }
            return;
          }
          console.log("✅ Location permission granted");
        }
        
        console.log("🔄 Starting location watch...");
        watchId = Geolocation.watchPosition(
          (pos) => {
            if (!isMounted.current) return;
            
            const loc: LocationType = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
            
            console.log(`📍 Driver location updated: lat=${loc.latitude.toFixed(6)}, lng=${loc.longitude.toFixed(6)}`);
            setLocation(loc);
            
            if (mapRef.current) {
              mapRef.current.animateToRegion(
                {
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                },
                500
              );
            }
            
            if (lastCoord) {
              const dist = haversine(lastCoord, loc);
              setTravelledKm(prev => prev + dist / 1000);
            }
            setLastCoord(loc);
            
            // Save location in background (don't await)
            saveLocationToDatabase(loc).catch(error => {
              console.error("❌ Background location save failed:", error);
            });
          },
          (err) => {
            console.error("❌ Geolocation error:", err);
            if (isMounted.current) {
              Alert.alert(
                "Location Error", 
                "Could not get your location. Please check your GPS settings and location permissions."
              );
            }
          },
          {
            enableHighAccuracy: true,
            distanceFilter: 10,
            interval: 5000,
            fastestInterval: 2000,
            timeout: 20000,
          }
        );
        
        console.log("✅ Location watch started successfully");
        
        // Fallback: Get current position once if watch fails
        setTimeout(() => {
          if (!location && isMounted.current) {
            console.log("📍 Trying to get current position as fallback...");
            Geolocation.getCurrentPosition(
              (pos) => {
                const loc: LocationType = {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                };
                console.log("📍 Fallback location received:", loc);
                setLocation(loc);
              },
              (err) => {
                console.error("❌ Fallback location error:", err);
              },
              {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 10000,
              }
            );
          }
        }, 10000); // Try after 10 seconds if no location yet
        
      } catch (error) {
        console.error("❌ Error setting up location tracking:", error);
        if (isMounted.current) {
          Alert.alert("Setup Error", "Failed to initialize location tracking");
        }
      }
    };
    
    requestLocation();
    
    // Cleanup function
    return () => {
      console.log("🛑 Clearing location watch...");
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, []); // Empty dependency array - only run once
  
  // ---------- Socket Event Listeners ----------
  useEffect(() => {
    console.log("🔌 Setting up socket listeners...");
    
    const handleConnect = () => {
      if (!isMounted.current) return;
      console.log("✅ Driver socket connected:", socket.id);
      setSocketConnected(true);
      
      if (location && driverId) {
        console.log("📝 Registering driver with socket after connection...");
        socket.emit("registerDriver", {
          driverId,
          driverName,
          latitude: location.latitude,
          longitude: location.longitude,
          vehicleType: "taxi",
        });
        setIsRegistered(true);
        setDriverStatus("online");
        console.log("✅ Driver registered after socket connection");
      }
    };
    
// In Screen1.tsx, update the handleRideRequest function in the socket useEffect

const handleRideRequest = (data: any) => {
  if (!isMounted.current) return;
  console.log("🚖 New ride request received:", JSON.stringify(data, null, 2));
  
  // Add validation for the incoming data
  if (!data || !data.rideId) {
    console.error("❌ Invalid ride request data - missing rideId:", data);
    return;
  }
  
  // Safely extract and validate ride data
  try {
    const rideData: RideType = {
      rideId: data.rideId || "",
      RAID_ID: data.RAID_ID || "N/A",
      otp: data.otp || "0000",
      pickup: {
        latitude: data.pickup?.lat || data.pickup?.latitude || 0,
        longitude: data.pickup?.lng || data.pickup?.longitude || 0,
        address: data.pickup?.address || "Unknown location"
      },
      drop: {
        latitude: data.drop?.lat || data.drop?.latitude || 0,
        longitude: data.drop?.lng || data.drop?.longitude || 0,
        address: data.drop?.address || "Unknown location"
      },
      fare: data.fare || 0,
      distance: data.distance || "0 km",
    };
    
    console.log("✅ Valid ride request, setting ride data:", rideData);
    
    // Use a timeout to ensure state updates don't happen too quickly
    setTimeout(() => {
      if (!isMounted.current) return;
      
      setRide(rideData);
      setRideStatus("onTheWay");
      console.log("📊 Ride status set to onTheWay");
      
      // Safely show the alert with validated data
      Alert.alert(
        "New Ride Request 🚖",
        `Pickup: ${rideData.pickup.address}\nDrop: ${rideData.drop.address}\nFare: ₹${rideData.fare}\nDistance: ${rideData.distance}`,
        [
          { 
            text: "Reject", 
            onPress: () => {
              if (isMounted.current) rejectRide(rideData.rideId);
            }, 
            style: "cancel" 
          },
          { 
            text: "Accept", 
            onPress: () => {
              if (isMounted.current) acceptRide(rideData.rideId);
            }
          },
        ],
        { cancelable: false } // Prevent accidental dismissal
      );
    }, 100); // Small delay to ensure proper state updates
    
  } catch (error) {
    console.error("❌ Error processing ride request:", error);
    if (isMounted.current) {
      Alert.alert("Error", "Could not process ride request. Please try again.");
    }
  }
};





// In Screen1.tsx, add a new handler for rideOTP event
const handleRideOTP = (data: any) => {
  if (!isMounted.current) return;
  console.log("🔢 Ride OTP received:", data);
  
  if (ride && ride.rideId === data.rideId) {
    setRide(prev => prev ? { ...prev, otp: data.otp } : null);
    console.log(`✅ OTP updated for ride ${data.rideId}: ${data.otp}`);
  }
};

// Add the event listener in the socket useEffect
socket.on("rideOTP", handleRideOTP);

// And in the cleanup, remove it
socket.off("rideOTP", handleRideOTP);



    const handleDisconnect = (reason: string) => {
      if (!isMounted.current) return;
      console.log("❌ Driver socket disconnected, reason:", reason);
      setSocketConnected(false);
      setIsRegistered(false);
      setDriverStatus("offline");
    };
    
    const handleConnectError = (error: Error) => {
      if (!isMounted.current) return;
      console.log("❌ Socket connection error:", error.message);
      setSocketConnected(false);
      setError("Failed to connect to server");
    };
    
    const handleRideCancelled = (data: any) => {
      if (!isMounted.current) return;
      console.log("🚫 Ride cancelled event received:", data);
      
      if (ride && ride.rideId === data.rideId) {
        console.log("✅ Cancelling current ride");
        setRide(null);
        setRideStatus("idle");
        Alert.alert("Ride Cancelled", "The passenger cancelled the ride.");
      }
    };
    
    // Add event listeners
    socket.on("connect", handleConnect);
    socket.on("newRideRequest", handleRideRequest);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("rideCancelled", handleRideCancelled);
    
    console.log("✅ All socket event listeners attached");
    
    // Connect socket if not connected
    if (!socket.connected) {
      console.log("🔗 Connecting socket...");
      socket.connect();
    }
    
    // Proper cleanup
    return () => {
      console.log("🧹 Cleaning up socket listeners...");
      socket.off("connect", handleConnect);
      socket.off("newRideRequest", handleRideRequest);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("rideCancelled", handleRideCancelled);
      console.log("✅ Socket event listeners removed");
    };
  }, [location, driverId, driverName]);
  
  // ---------- UI ----------
  if (error) {
    console.log("❌ Displaying error UI:", error);
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => setError(null)}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (!location) {
    console.log("📍 Waiting for location...");
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4caf50" />
        <Text style={styles.loadingText}>Fetching your location...</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            console.log("🔄 Manually retrying location fetch...");
            Geolocation.getCurrentPosition(
              (pos) => {
                setLocation({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
              },
              (err) => {
                console.error("❌ Manual location fetch error:", err);
                Alert.alert("Location Error", "Could not get your location. Please check GPS settings.");
              },
              { enableHighAccuracy: true, timeout: 15000 }
            );
          }}
        >
          <Text style={styles.retryText}>Retry Location</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  console.log("🖥️ Rendering driver UI with status:", {
    rideStatus,
    driverStatus,
    socketConnected,
    hasRide: !!ride
  });
  
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {ride && (
          <Marker coordinate={ride.pickup} title="Pickup" pinColor="blue" />
        )}
        {ride && (
          <Marker coordinate={ride.drop} title="Drop" pinColor="red" />
        )}
        {ride?.routeCoords && (
          <Polyline
            coordinates={ride.routeCoords}
            strokeWidth={5}
            strokeColor="#4caf50"
          />
        )}
      </MapView>
      
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>
            Socket: {socketConnected ? "Connected" : "Disconnected"}
          </Text>
          <Text
            style={[
              styles.statusText,
              {
                color:
                  driverStatus === "online"
                    ? "#4caf50"
                    : driverStatus === "onRide"
                    ? "#ff9800"
                    : "#f44336",
              },
            ]}
          >
            Status: {driverStatus}
          </Text>
        </View>
        <Text style={styles.locationText}>
          Lat: {location.latitude.toFixed(6)}, Lng: {location.longitude.toFixed(6)}
        </Text>
        {ride && <Text style={styles.rideInfoText}>Ride ID: {ride.rideId}</Text>}
      </View>
      
      {ride && rideStatus === "onTheWay" && (
        <View style={styles.rideActions}>
          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={() => acceptRide()}
          >
            <Text style={styles.btnText}>Accept Ride</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={() => rejectRide()}
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
      
      <Modal visible={otpModalVisible} transparent animationType="slide">
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
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  statusContainer: {
    position: "absolute",
    top: 50,
    left: 10,
    right: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 10,
    borderRadius: 8,
    elevation: 3,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  locationText: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  rideInfoText: {
    fontSize: 10,
    color: "#888",
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
  acceptButton: { backgroundColor: "#4caf50", flex: 1 },
  rejectButton: { backgroundColor: "#f44336", flex: 1 },
  startButton: { backgroundColor: "#2196f3", margin: 10 },
  completeButton: { backgroundColor: "#ff9800", margin: 10 },
  cancelButton: { backgroundColor: "#757575", flex: 1, marginRight: 5 },
  confirmButton: { backgroundColor: "#4caf50", flex: 1, marginLeft: 5 },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    marginVertical: 10,
    padding: 12,
    fontSize: 16,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    marginTop: 15,
    gap: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  errorText: {
    fontSize: 16,
    color: "#f44336",
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#4caf50",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});