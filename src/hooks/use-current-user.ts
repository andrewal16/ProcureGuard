"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types/database";
import type { User } from "@supabase/supabase-js";

interface CurrentUser {
  authUser: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

export function useCurrentUser(): CurrentUser {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchUser() {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          setAuthUser(null);
          setProfile(null);
          return;
        }

        setAuthUser(user);

        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError) {
          setError("Gagal memuat profil user");
          return;
        }

        setProfile(profileData as UserProfile);
      } catch (err) {
        setError("Terjadi kesalahan");
      } finally {
        setIsLoading(false);
      }
    }

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          setAuthUser(null);
          setProfile(null);
          setIsLoading(false);
        } else {
          fetchUser();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { authUser, profile, isLoading, error };
}
