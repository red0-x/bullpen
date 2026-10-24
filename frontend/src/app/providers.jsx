"use client";

import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";

export function Providers({ children }) {
  return (
    <AuthProvider>
      {children}
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#FFFFFF",
            border: "1.5px solid #E8D9C6",
            borderRadius: "16px",
            boxShadow: "none",
            color: "#3A1F14",
            fontFamily: "var(--font-body)",
          },
        }}
      />
    </AuthProvider>
  );
}
