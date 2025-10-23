import React from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import LandingPage from "./pages/LandingPage";
import ReportRoute from "./pages/ReportRoute";

const BASENAME = import.meta.env.BASE_URL || "/";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
    errorElement: (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <a href="/" className="text-indigo-400 underline">
            Go Home
          </a>
        </div>
      </div>
    ),
  },
  {
    path: "/report",
    element: <ReportRoute />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
