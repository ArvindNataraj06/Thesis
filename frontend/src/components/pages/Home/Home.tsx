import React from "react";
import { useNavigate, NavLink } from "react-router-dom";
import "./Home.css";

type CapabilityCardProps = {
  title: string;
  description: string;
  imageUrl: string;
};

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">
      {/* Top Navbar */}
      <header className="home__navbar">
        <div className="home__brand" onClick={() => navigate("/")}>
          <span className="home__logo">▦</span>
          <span className="home__brandText">Traffic Incident Prediction System</span>
        </div>

        <nav className="home__navLinks">
          <NavLink to="/" className={({ isActive }) => (isActive ? "navLink active" : "navLink")}>
            Home
          </NavLink>
          <NavLink to="/live-map" className={({ isActive }) => (isActive ? "navLink active" : "navLink")}>
            Dashboard
          </NavLink>
          <a className="navLink" href="#documentation">
            Documentation
          </a>
          <a className="navLink" href="#about">
            About Research
          </a>
        </nav>

        <button className="btn btn--primary" onClick={() => navigate("/live-map")}>
          Go to Dashboard
        </button>
      </header>

      {/* Hero */}
      <section className="home__heroWrap">
        <div className="home__hero">
          <div className="home__heroBadge">MASTER’S THESIS PROJECT</div>

          <h1 className="home__heroTitle">
            AI-Powered Traffic <br />
            Incident Prediction
          </h1>

          <p className="home__heroSubtitle">
            Predict lane-state disruptions from incident attributes using supervised ML models (CatBoost + Random Forest),
            enabling faster situational awareness and better traffic management decisions.
          </p>

          <div className="home__heroActions">
            <button className="btn btn--primary" onClick={() => navigate("/live-map")}>
              Go to Dashboard
            </button>
            <button className="btn btn--secondary" onClick={() => navigate("/prediction")}>
              Try Prediction
            </button>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="home__section">
        <div className="home__sectionHead">
          <h2 className="home__sectionTitle">Core System Capabilities</h2>
          <div className="home__sectionUnderline" />
        </div>

        <div className="home__grid">
          <CapabilityCard
            title="Real-time Monitoring"
            description="Dashboard view for incident tracking (live map integration placeholder) with filters for incident attributes."
            imageUrl="/assets/capability-monitoring.jpg"
          />
          <CapabilityCard
            title="Lane Closure Prediction"
            description="Multi-class prediction of lane_state: CLOSED, SINGLE_LANE_ALTERNATING, SOME_LANES_CLOSED using tabular ML."
            imageUrl="/assets/capability-prediction.jpg"
          />
          <CapabilityCard
            title="Decision Support"
            description="Explainable outputs: confidence and probability distribution, ready for future LLM explanation layer."
            imageUrl="/assets/capability-decision.jpg"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="home__cta" id="about">
        <h2 className="home__ctaTitle">Ready to explore the research?</h2>
        <p className="home__ctaSubtitle">
          Launch the analytical dashboard to see the trained models in action on structured incident data.
        </p>

        <button className="btn btn--primary btn--large" onClick={() => navigate("/live-map")}>
          Launch Analytical Dashboard
        </button>
      </section>

      {/* Footer */}
      <footer className="home__footer" id="documentation">
        <div className="home__footerLeft">
          <span className="home__footerDot" />
          <span>Master’s Thesis 2024</span>
        </div>

        <div className="home__footerLinks">
          <a href="#" className="footerLink">Research Paper</a>
          <a href="#" className="footerLink">GitHub Repository</a>
          <a href="#" className="footerLink">Contact</a>
          <a href="#" className="footerLink">Institutional Archive</a>
        </div>

        <div className="home__footerRight">
          © {new Date().getFullYear()} Traffic Incident Prediction System
        </div>
      </footer>
    </div>
  );
}

function CapabilityCard({ title, description, imageUrl }: CapabilityCardProps) {
  return (
    <div className="capCard">
      <div className="capCard__imageWrap">
        <img src={imageUrl} alt={title} className="capCard__image" />
      </div>

      <div className="capCard__body">
        <h3 className="capCard__title">{title}</h3>
        <p className="capCard__desc">{description}</p>
      </div>
    </div>
  );
}
