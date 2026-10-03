import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#faf7f2] text-sm text-[#6E6E73]">
        Carregando painel…
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}
