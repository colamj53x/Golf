import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { hydrateDurableLocalSettings } from '@/lib/durableLocalSettings';

export function DurableLocalSettingsSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    void hydrateDurableLocalSettings(user.id).catch(() => {
      // Local settings remain usable when remote sync is unavailable.
    });
  }, [user]);

  return null;
}
