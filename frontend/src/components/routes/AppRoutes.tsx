import { Routes, Route, Navigate } from "react-router-dom";

// import Navbar from "../layout/Navbar";
// import Footer from "../layout/Footer";

import Home from "../pages/Home/Home";
import LiveMap from "../pages/LiveMap/LiveMap";
import Prediction from "../pages/Prediction/Prediction";

export default function AppRoutes() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* <Navbar /> */}

      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live-map" element={<LiveMap />} />
          <Route path="/prediction" element={<Prediction />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* <Footer /> */}
    </div>
  );
}
