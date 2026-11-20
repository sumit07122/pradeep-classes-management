import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./context/AuthContext";
import { AppRoutes } from "./routes/AppRoutes";

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Analytics />
    </AuthProvider>
  );
}
