import { create } from "zustand";
import { supabase } from "../lib/supabase";

export const useAuthStore = create((set, get) => ({
  session: null,
  profile: null,
  loading: true,

  initialize: () => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        set({ session, loading: false });
        if (session) {
          get().fetchProfile(session.user.id, session.user);
        } else {
          set({ profile: null });
        }
      },
    );
    return () => listener.subscription.unsubscribe();
  },

  fetchProfile: async (userId, authUser) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!error && data) {
      // If name is empty in profiles table, fall back to auth metadata or email
      if (!data.name || data.name === "New User") {
        const fallbackName =
          authUser?.user_metadata?.name ||
          authUser?.user_metadata?.full_name ||
          authUser?.email?.split("@")[0] ||
          "User";

        // Update the profile name in Supabase
        await supabase
          .from("profiles")
          .update({ name: fallbackName })
          .eq("id", userId);

        set({ profile: { ...data, name: fallbackName } });
      } else {
        set({ profile: data });
      }
    } else {
      // Profile row missing — create it
      const fallbackName =
        authUser?.user_metadata?.name ||
        authUser?.user_metadata?.full_name ||
        authUser?.email?.split("@")[0] ||
        "User";

      await supabase.from("profiles").upsert({
        id: userId,
        name: fallbackName,
        role: "admin",
      });

      set({ profile: { id: userId, name: fallbackName, role: "admin" } });
    }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  signUp: async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return { data, error };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  isAdmin: () => get().profile?.role === "admin",
  isAuthenticated: () => !!get().session,
}));
