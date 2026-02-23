import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Application Pages
import Home from './pages/Home';
import Today from './pages/Today';
import Curriculum from './pages/Curriculum';
import Progress from './pages/Progress';
import Consistency from './pages/Consistency';
import MockHistory from './pages/MockHistory';
import MockPerformanceReport from './pages/MockPerformanceReport';
import UserAnalyticsDashboard from './pages/UserAnalyticsDashboard';
import Settings from './pages/Settings';

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
            <Route path="/consistency" element={<Consistency />} />
            <Route path="/mock" element={<MockHistory />} />
            <Route path="/mock/report" element={<MockPerformanceReport />} />
            <Route path="/analytics" element={<UserAnalyticsDashboard />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
