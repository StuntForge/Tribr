import React from "react";
import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import UserDetail from "./pages/UserDetail";
import Reports from "./pages/Reports";
import Subscriptions from "./pages/Subscriptions";
import JobCategories from "./pages/JobCategories";
import Broadcast from "./pages/Broadcast";
import AuditLog from "./pages/AuditLog";

function Layout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth();
  return (
    <div className="layout">
      <div className="sidebar">
        <h1>Project Exchange</h1>
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/users">Users</NavLink>
        <NavLink to="/reports">Reports</NavLink>
        <NavLink to="/subscriptions">Subscriptions</NavLink>
        <NavLink to="/job-categories">Job Categories</NavLink>
        <NavLink to="/broadcast">Broadcast</NavLink>
        <NavLink to="/audit-log">Audit Log</NavLink>
        <div className="logout">
          <p style={{ fontSize: 12, padding: "0 20px", opacity: 0.7 }}>{admin?.email}</p>
          <a onClick={logout} style={{ cursor: "pointer" }}>
            Sign out
          </a>
        </div>
      </div>
      <div className="content">{children}</div>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/users"
        element={
          <Protected>
            <Users />
          </Protected>
        }
      />
      <Route
        path="/users/:id"
        element={
          <Protected>
            <UserDetail />
          </Protected>
        }
      />
      <Route
        path="/reports"
        element={
          <Protected>
            <Reports />
          </Protected>
        }
      />
      <Route
        path="/subscriptions"
        element={
          <Protected>
            <Subscriptions />
          </Protected>
        }
      />
      <Route
        path="/job-categories"
        element={
          <Protected>
            <JobCategories />
          </Protected>
        }
      />
      <Route
        path="/broadcast"
        element={
          <Protected>
            <Broadcast />
          </Protected>
        }
      />
      <Route
        path="/audit-log"
        element={
          <Protected>
            <AuditLog />
          </Protected>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
