import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReportPage from "./ReportPage";

export default function ReportRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [analysis, _] = useState(() => {
    const viaState = location.state?.analysis;
    if (viaState) return viaState;
    try {
      const s = sessionStorage.getItem("riot:analysis");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (analysis) {
        sessionStorage.setItem("riot:analysis", JSON.stringify(analysis));
      } else {
        sessionStorage.removeItem("riot:analysis");
      }
    } catch {
      //s skip
    }
  }, [analysis]);

  if (!analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-2">No report data available</h1>
          <p className="text-gray-300 mb-6">
            Head back to the homepage and search for a summoner to generate a report.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <ReportPage
      data={analysis}
      onExit={() => {
        try { sessionStorage.removeItem("riot:analysis"); } catch {
            // skip
        }
        navigate("/");
      }}
    />
  );
}
