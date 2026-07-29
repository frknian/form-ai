import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FoodSearchResult } from "../api/nutrition";

const KEY = "form-ai:recent-food-selections:v1";
const MAX_ITEMS = 12;

export type RecentFood = {
  food: FoodSearchResult;
  portionGrams: number;
  selectedAt: string;
};

export async function readRecentFoods(): Promise<RecentFood[]> {
  const stored = await AsyncStorage.getItem(KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

export async function saveRecentFood(food: FoodSearchResult, portionGrams: number) {
  const current = await readRecentFoods();
  const next: RecentFood[] = [
    { food, portionGrams, selectedAt: new Date().toISOString() },
    ...current.filter((item) => item.food.id !== food.id),
  ].slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
