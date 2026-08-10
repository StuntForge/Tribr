import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "tribr_tutorial_seen_v1";

// Gates the automatic post-signup tutorial - once a device has seen it, it
// won't show itself again unannounced. Replaying it from Settings doesn't
// touch this flag; it's only about whether the app should show it on its own.
export function useTutorialSeen() {
  const [loading, setLoading] = useState(true);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      setSeen(v === "1");
      setLoading(false);
    });
  }, []);

  const markSeen = useCallback(async () => {
    await AsyncStorage.setItem(KEY, "1");
    setSeen(true);
  }, []);

  return { loading, seen, markSeen };
}
