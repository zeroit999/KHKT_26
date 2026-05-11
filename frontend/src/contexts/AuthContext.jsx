import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../components/firebase.js";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";

const AuthContext = createContext({});

// AuthContext keeps hook and provider together to preserve the existing file structure.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);

  // Kiểm tra hết hạn subscription
  const checkSubscriptionExpiry = async (uid) => {
    try {
      const userRef = doc(db, "users", uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) return false;

      const userData = userDoc.data();
      const subscription = userData.subscription;

      if (subscription?.isPro && subscription?.endDate) {
        const endDate = subscription.endDate.toDate();
        const now = new Date();

        if (endDate < now) {
          // Hết hạn - cập nhật isPro = false
          await updateDoc(userRef, {
            "subscription.isPro": false,
          });
          return false;
        }
        return true;
      }

      return subscription?.isPro || false;
    } catch (error) {
      console.error("Error checking subscription expiry:", error);
      return false;
    }
  };

  // Lấy Firebase Auth Token
  const getAuthToken = async (firebaseUser = null) => {
    const targetUser = firebaseUser || user;
    if (targetUser) {
      try {
        const token = await targetUser.getIdToken();
        setAuthToken(token);
        console.log("🔑 Auth token obtained:", token.substring(0, 50) + "...");
        return token;
      } catch (error) {
        console.error("Error getting auth token:", error);
        return null;
      }
    }
    console.warn("⚠️ No user available for getAuthToken");
    return null;
  };

  // Fetch user data và subscription status
  const fetchUserData = async (firebaseUser) => {
    try {
      console.log("📋 Fetching user data for:", firebaseUser.email);
      const docRef = doc(db, "users", firebaseUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        setUserDetails(userData);
        console.log("✅ User data loaded:", userData);

        // Check subscription status
        const proStatus = await checkSubscriptionExpiry(firebaseUser.uid);
        setIsPro(proStatus);
        console.log("💎 Pro status:", proStatus);
      } else {
        // User chưa có data, tạo mới
        console.log("🆕 Creating new user document");
        const newUserDetails = {
          firstName: firebaseUser.displayName || "User",
          email: firebaseUser.email,
          photo: firebaseUser.photoURL,
          subscription: {
            isPro: false,
            plan: null,
            startDate: null,
            endDate: null,
          },
        };
        await setDoc(docRef, newUserDetails);
        setUserDetails(newUserDetails);
        setIsPro(false);
      }

      // Get auth token - pass firebaseUser to avoid race condition
      console.log("🔑 Getting auth token...");
      const token = await getAuthToken(firebaseUser);
      console.log("🔑 Auth token result:", token ? "SUCCESS" : "FAILED");
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log("🚀 AuthContext: Setting up auth listener");
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      console.log(
        "🔄 Auth state changed:",
        firebaseUser ? firebaseUser.email : "No user"
      );
      setUser(firebaseUser);

      if (firebaseUser) {
        await fetchUserData(firebaseUser);
      } else {
        console.log("🚪 User logged out, clearing state");
        setUserDetails(null);
        setIsPro(false);
        setAuthToken(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Effect để ensure authToken được set khi user đã có
  useEffect(() => {
    if (user && !authToken && !isLoading) {
      console.log("🔧 User exists but no authToken, getting token...");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      getAuthToken(user);
    }
  }, [user, authToken, isLoading]);

  // Refresh auth token khi cần
  const refreshAuthToken = async () => {
    if (user) {
      try {
        console.log("🔄 Refreshing auth token...");
        const token = await user.getIdToken(true); // force refresh
        setAuthToken(token);
        console.log("✅ Auth token refreshed successfully");
        return token;
      } catch (error) {
        console.error("Error refreshing auth token:", error);
        return null;
      }
    }
    console.warn("⚠️ No user available for refreshAuthToken");
    return null;
  };

  const value = {
    user,
    userDetails,
    isPro,
    isLoading,
    authToken,
    getAuthToken: () => getAuthToken(user),
    refreshAuthToken,
    checkSubscriptionExpiry,
    fetchUserData: () => (user ? fetchUserData(user) : null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
