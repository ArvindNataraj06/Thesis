import { NavLink, useNavigate } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <div className="navbar__left" onClick={() => navigate("/")}>
        <div className="navbar__logo">▦</div>
        <div className="navbar__title">Traffic Incident Prediction System</div>
      </div>

      <nav className="navbar__center">
        <NavLink to="/" className={({ isActive }) => (isActive ? "navItem active" : "navItem")}>
          Home
        </NavLink>
        <NavLink
          to="/live-map"
          className={({ isActive }) => (isActive ? "navItem active" : "navItem")}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/prediction"
          className={({ isActive }) => (isActive ? "navItem active" : "navItem")}
        >
          Prediction
        </NavLink>
      </nav>

      <button className="navbar__button" onClick={() => navigate("/live-map")}>
        Go to Dashboard
      </button>
    </header>
  );
}
