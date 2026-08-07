import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { queryKeys } from "../api/queries";
import {
  buildAttentionItems,
  getNotificationsEnabledSnapshot,
  markNotified,
  shouldNotifyToday,
  subscribeNotificationsEnabled,
} from "../lib/notifications";

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function AttentionNotifier() {
  const enabled = useSyncExternalStore(
    subscribeNotificationsEnabled,
    getNotificationsEnabledSnapshot,
    getNotificationsEnabledSnapshot,
  );
  const supported = typeof Notification !== "undefined";

  const { data } = useQuery({
    queryKey: queryKeys.tracker,
    queryFn: api.tracker.list,
    enabled: enabled && supported,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!enabled || !supported || Notification.permission !== "granted" || !data) return;
    for (const item of buildAttentionItems(data)) {
      if (!shouldNotifyToday(item.key)) continue;
      new Notification(item.title, { body: item.body, tag: item.key });
      markNotified(item.key);
    }
  }, [data, enabled, supported]);

  return null;
}
