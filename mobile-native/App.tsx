import { StatusBar } from "expo-status-bar";
import { FoodSearchScreen } from "./src/screens/FoodSearchScreen";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "https://form-ai.frknian.workers.dev";
const accessToken = process.env.EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN || "";

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <FoodSearchScreen apiBaseUrl={apiBaseUrl} accessToken={accessToken} />
    </>
  );
}
