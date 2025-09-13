// src/components/OfflineBanner.tsx
"use client";

import { useState, useEffect } from "react";

const offlineBannerStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  width: "100%",
  backgroundColor: "#343a40",
  color: "white",
  textAlign: "center",
  padding: "10px 0",
  fontSize: "14px",
  zIndex: 9999,
  boxShadow: "0 -2px 5px rgba(0,0,0,0.2)",
};

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div style={offlineBannerStyle}>
      オフラインです。記録は保存され、通信回復後に自動で同期されます。
    </div>
  );
}