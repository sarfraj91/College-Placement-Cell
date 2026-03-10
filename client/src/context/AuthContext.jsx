import { createContext, useEffect, useState } from "react";
import API from "../services/api";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await API.get("/users/profile");
      setUser(res.data.user);
      return res.data.user;
    } catch {
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      await fetchUser();
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await API.get("/users/logout");
    } catch (err) {
      console.error("Logout error:", err);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, loading, fetchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
