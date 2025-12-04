// app/hooks/ .ts
import { useState, useEffect } from 'react';

export interface TrackerInfo {
  eid: string;
  registeredAt: number;
}

export function useTrackerStorage(account: string | null) {
  const [trackers, setTrackers] = useState<TrackerInfo[]>([]);

  // 从 localStorage 读取（按钱包地址隔离）
  useEffect(() => {
    if (!account) {
      setTrackers([]);
      return;
    }
    const key = `trackless_trackers_${account.toLowerCase()}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setTrackers(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse trackers', e);
      }
    }
  }, [account]);

  // 添加新 tracker
  const addTracker = (eid: string) => {
    if (!account) return;
    const newTracker = { eid, registeredAt: Date.now() };
    const updated = [...trackers, newTracker];
    setTrackers(updated);
    localStorage.setItem(`trackless_trackers_${account.toLowerCase()}`, JSON.stringify(updated));
  };

  return { trackers, addTracker };
}