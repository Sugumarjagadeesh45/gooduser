import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "./src/LoginScreen";
import Screen1 from "./src/Screen1";
import ActiveRideScreen from "./src/ActiveRideScreen";
import RejectRideScreen from "./src/RejectRideScreen";

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export type RootStackParamList = {
  LoginScreen: undefined;
  Screen1: { isNewUser?: boolean; phone?: string };
  ActiveRideScreen: { rideId: string };
  RejectRideScreen: { rideId: string };
};

const id: string = uuidv4();
console.log("App UUID:", id);

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="LoginScreen">
        <Stack.Screen 
          name="LoginScreen" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Screen1" 
          component={Screen1} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="ActiveRideScreen" 
          component={ActiveRideScreen} 
          options={{ title: "Active Ride" }} 
        />
        <Stack.Screen 
          name="RejectRideScreen" 
          component={RejectRideScreen} 
          options={{ title: "Reject Ride" }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
