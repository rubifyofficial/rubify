import { useState, useEffect, useCallback } from 'react';
import { getSafeUser, supabase } from './supabase';

export type Profile = {
  id: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
};

export type CoupleData = {
  couple_id: string;
  partner_id: string;
  partner_name: string;
  partner_avatar_url: string | null;
  created_at: string; // relationship start or couple creation
};

export function useProfileAndCouple() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<CoupleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getSafeUser();
      if (!user) {
        console.warn('[useProfileAndCouple] no valid user session');
        setProfile(null);
        setCouple(null);
        setError(null);
        return;
      }

      // 1. My Profile
      const { data: pData, error: pErr } = await supabase.rpc('get_my_profile');
      if (pErr) throw pErr;
      const myProfile = Array.isArray(pData) ? pData[0] : pData;
      setProfile(myProfile);

      // 2. Couple / Partner
      const { data: cData, error: cErr } = await supabase.rpc('get_my_couple');
      if (cErr) throw cErr;
      const myCouple = Array.isArray(cData) ? cData[0] : cData;
      if (myCouple?.couple_id) {
        setCouple(myCouple);
      }
    } catch (e: any) {
      console.log('[useProfileAndCouple] error:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { profile, couple, loading, error, refresh: fetchData };
}
