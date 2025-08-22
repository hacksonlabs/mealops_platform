import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  signUp: () => {},
  signIn: () => {},
  signOut: () => {},
  getUserProfile: () => {},
  refreshSession: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  const fetchUserProfile = async (userId) => {
    if (!userId) {
      setUserProfile(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error.message);
        setUserProfile(null);
      } else {
        setUserProfile(data);
      }
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
      setUserProfile(null);
    }
  };

  useEffect(() => {
    // Get initial session on component mount
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session) {
          await fetchUserProfile(session.user.id);
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Error getting initial session:", error?.message);
        // Do not throw, as we want the app to load even if the session check fails
      } finally {
        setLoading(false); // Set loading to false after the initial check
      }
    };
    getInitialSession();

    // Set up the real-time auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event:", event);
      setSession(session);
      setUser(session?.user ?? null);
      
      // Fetch profile based on the new session
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null); // Clear profile on sign-out
      }
    });

    // Cleanup subscription on component unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email, password, userData = {}) => {
    try {
      setLoading(true);
      const { data, error } = await supabase?.auth?.signUp({
        email,
        password,
        options: {
          data: userData,
          emailRedirectTo: `${window.location.origin}/login-registration`,
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error("Sign up error:", error?.message);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      setLoading(true);
      const { data, error } = await supabase?.auth?.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error("Sign in error:", error?.message);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase?.auth?.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error("Sign out error:", error?.message);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase?.auth?.refreshSession();
      if (error) {
        console.error("Session refresh error:", error?.message);
        // Force sign out if refresh fails
        await supabase?.auth?.signOut();
        return { session: null, error };
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      return { session, error: null };
    } catch (error) {
      console.error("Unexpected refresh error:", error);
      return { session: null, error };
    }
  };

  const getUserProfile = async () => {
    try {
      // Validate session first
      if (!session?.user?.id) {
        return { data: null, error: new Error("No active session") };
      }

      const { data, error } = await supabase?.from("user_profiles")?.select("*")?.eq("id", session?.user?.id)?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error("Get user profile error:", error?.message);
      return { data: null, error };
    }
  };

  const value = {
    user,
    session,
    loading,
    userProfile,
    signUp,
    signIn,
    signOut,
    getUserProfile,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};