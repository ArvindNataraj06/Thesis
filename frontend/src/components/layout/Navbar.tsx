import { NavLink, useNavigate } from "react-router-dom";
import Container from "./Container";
import "./Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <Container size="wide" className="navbar__inner">
        <div className="navbar__left" onClick={() => navigate("/")}>
          <div className="navbar__logo">TP</div>
          <div className="navbar__title">Traffic Incident Prediction System</div>
        </div>

        <nav className="navbar__center">
          <NavLink to="/" className={({ isActive }) => (isActive ? "navItem active" : "navItem")}>
            Home
          </NavLink>
          <NavLink
            to="/prediction"
            className={({ isActive }) => (isActive ? "navItem active" : "navItem")}
          >
            Prediction
          </NavLink>
          <NavLink
            to="/live-map"
            className={({ isActive }) => (isActive ? "navItem active" : "navItem")}
          >
            Live Map
          </NavLink>
        </nav>

        <button className="navbar__button" onClick={() => navigate("/prediction")}>
          Start Prediction
        </button>
      </Container>
    </header>
  );
}
