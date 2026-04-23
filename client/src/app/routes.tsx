import { createBrowserRouter, Outlet } from "react-router";
import { AuthProvider } from "./context/AuthContext";
import { PostureProvider } from "./context/PostureContext";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Report } from "./components/Report";
import { ScreenLock } from "./components/ScreenLock";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthLayout } from "./components/AuthLayout";
import { Login } from "./components/Login";
import { Signup } from "./components/Signup";
import { FindPassword } from "./components/FindPassword";
import { ResetPassword } from "./components/ResetPassword";
import { SettingsPage } from "./components/Settings";

const RootProviders = () => (
  <AuthProvider>
    <PostureProvider>
      <Outlet />
    </PostureProvider>
  </AuthProvider>
);

export const router = createBrowserRouter([
  {
    element: <RootProviders />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "login", Component: Login },
          { path: "signup", Component: Signup },
          { path: "find-password", Component: FindPassword },
          { path: "reset-password", Component: ResetPassword },
        ],
      },
      {
        path: "/",
        Component: ProtectedRoute,
        children: [
          {
            path: "/",
            Component: Layout,
            children: [
              { index: true, Component: Dashboard },
              { path: "report", Component: Report },
              { path: "settings", Component: SettingsPage },
              { path: "lock", Component: ScreenLock },
              { path: "*", Component: () => <div className="p-8 text-center text-slate-500 font-bold text-lg flex items-center justify-center flex-1">페이지 준비중입니다.</div> },
            ],
          }
        ],
      },
    ]
  }
]);
