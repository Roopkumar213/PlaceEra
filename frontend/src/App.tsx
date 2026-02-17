import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
<<<<<<< HEAD
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Today from './pages/Today';
=======
import ProtectedRoute from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
>>>>>>> d745bebe8885f5257535b76286ab4174c11d9897

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

<<<<<<< HEAD
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
=======
// Application Pages
import Home from './pages/Home';
import Today from './pages/Today';
import Curriculum from './pages/Curriculum';
import Progress from './pages/Progress';
>>>>>>> d745bebe8885f5257535b76286ab4174c11d9897

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/today" element={<Today />} />
            <Route path="/curriculum" element={<Curriculum />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/settings" element={<div className="p-8">Settings (Coming Soon)</div>} />
          </Route>
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
