import { Outlet } from "react-router-dom";
import Footer from "./Footer";
import Navbar from "./Navbar";
import "./AppLayout.css";

export default function AppLayout() {
  return (
    <div className="appLayout">
      <Navbar />
      <main className="appLayout__main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
