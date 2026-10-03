import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import PropertyDetail from "@/pages/PropertyDetail";
import AdminLogin from "@/pages/AdminLogin";
import AdminLayout from "@/pages/AdminLayout";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminProperties from "@/pages/AdminProperties";
import AdminPropertyEdit from "@/pages/AdminPropertyEdit";
import AdminBookings from "@/pages/AdminBookings";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import ProtectedRoute from "@/components/ProtectedRoute";
import WhatsAppContact from "@/components/WhatsAppContact";
import { AuthProvider } from "@/context/AuthContext";
import ScrollToPage from "@/components/ScrollToPage";
function App() {
  return <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/casa/:id" element={<PropertyDetail />} />
            <Route path="/pagamento/sucesso" element={<PaymentSuccess />} />
            <Route path="/pagamento/cancelado" element={<PaymentCancel />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="casas" element={<AdminProperties />} />
              <Route path="casas/:id" element={<AdminPropertyEdit />} />
              <Route path="reservas" element={<AdminBookings />} />
            </Route>
          </Routes>
          <ScrollToPage />
          <WhatsAppContact />
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </BrowserRouter>
    </div>;
}
export default App;
