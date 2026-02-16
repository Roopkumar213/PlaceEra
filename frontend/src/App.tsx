import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Today from './pages/Today';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
      <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/dashboard" />} />
      <Route path="/reset-password/:token" element={!isAuthenticated ? <ResetPassword /> : <Navigate to="/dashboard" />} />

      {/* Public Route */}
      <Route path="/" element={<Landing />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/today" element={<Today />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
