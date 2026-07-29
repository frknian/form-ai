import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  recordFoodSelection,
  searchFoods,
  type FoodSearchResult,
} from "../api/nutrition";
import { readRecentFoods, saveRecentFood, type RecentFood } from "../storage/recent-foods";

type Props = {
  apiBaseUrl: string;
  accessToken: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  onSelect?: (food: FoodSearchResult, grams: number) => void;
};

export function FoodSearchScreen({
  apiBaseUrl,
  accessToken,
  mealType = "snack",
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [recent, setRecent] = useState<RecentFood[]>([]);
  const [grams, setGrams] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const options = useMemo(() => ({ baseUrl: apiBaseUrl, accessToken }), [apiBaseUrl, accessToken]);

  useEffect(() => {
    readRecentFoods().then(setRecent).catch(() => setRecent([]));
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    let active = true;
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const found = await searchFoods(normalized, options);
        if (active) setResults(found);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Arama tamamlanamadı.");
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [options, query]);

  async function choose(food: FoodSearchResult) {
    const portion = Math.min(5000, Math.max(1, Number(grams) || food.servingGrams || 100));
    onSelect?.(food, portion);
    setRecent(await saveRecentFood(food, portion));
    await recordFoodSelection(food, query || food.name, portion, mealType, options).catch(() => undefined);
  }

  const visible = query.trim().length >= 2 ? results : recent.map((item) => item.food);
  const isSearching = query.trim().length >= 2;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Besin ara</Text>
        <Text style={styles.subtitle}>Türkçe yazım hataları ve benzer adlar desteklenir.</Text>
      </View>
      <View style={styles.controls}>
        <TextInput
          accessibilityLabel="Besin adı"
          autoCapitalize="none"
          onChangeText={setQuery}
          placeholder="Örn. sucuklu yumurta"
          placeholderTextColor="#777"
          style={styles.input}
          value={query}
        />
        <TextInput
          accessibilityLabel="Gram"
          keyboardType="numeric"
          onChangeText={setGrams}
          style={[styles.input, styles.grams]}
          value={grams}
        />
      </View>
      {isSearching && loading ? <ActivityIndicator color="#9fbd29" style={styles.status} /> : null}
      {isSearching && error ? <Text style={[styles.status, styles.error]}>{error}</Text> : null}
      {!isSearching && recent.length > 0 ? <Text style={styles.section}>Son seçimlerin</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={visible}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{isSearching ? "Sonuç bulunamadı." : "Aramak için en az iki harf yaz."}</Text> : null}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => choose(item)} style={styles.card}>
            <View style={styles.cardText}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
                {item.personalized ? <Text style={styles.badge}>Sana özel</Text> : null}
              </View>
              <Text numberOfLines={1} style={styles.meta}>
                {[item.brand, item.category].filter(Boolean).join(" · ") || "Besin"}
              </Text>
            </View>
            <Text style={styles.calories}>{item.nutritionPer100g?.calories ?? "—"} kcal</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#11120f" },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  title: { color: "#f5f7ee", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#a6aa9d", fontSize: 14, marginTop: 5 },
  controls: { flexDirection: "row", gap: 10, paddingHorizontal: 20 },
  input: { flex: 1, backgroundColor: "#20221d", borderColor: "#383c30", borderRadius: 14, borderWidth: 1, color: "#fff", padding: 14 },
  grams: { flex: 0, width: 78, textAlign: "center" },
  status: { margin: 18 },
  error: { color: "#ff8a80" },
  section: { color: "#d9f76b", fontSize: 13, fontWeight: "700", paddingHorizontal: 20, paddingTop: 18 },
  list: { gap: 10, padding: 20 },
  empty: { color: "#777c70", textAlign: "center", paddingTop: 32 },
  card: { alignItems: "center", backgroundColor: "#1b1d18", borderRadius: 16, flexDirection: "row", padding: 16 },
  cardText: { flex: 1, paddingRight: 12 },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  name: { color: "#f5f7ee", flexShrink: 1, fontSize: 16, fontWeight: "700" },
  badge: { backgroundColor: "#d9f76b", borderRadius: 8, color: "#1d1d1b", fontSize: 10, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 3 },
  meta: { color: "#929689", fontSize: 12, marginTop: 5 },
  calories: { color: "#d9f76b", fontWeight: "800" },
});
