import { useNavigate } from "react-router-dom";
import capabilityImage from "../../../assets/capability-monitoring.jpg";
import Container from "../../layout/Container";
import "./Home.css";

type CapabilityCardProps = {
  title: string;
  description: string;
};

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">
      <Container>
        <section className="home__hero">
          <div className="home__badge">MASTER THESIS PROJECT</div>
          <h1 className="home__title">AI-Powered Urban Traffic Incident Prediction</h1>
          <p className="home__subtitle">
            Predict lane disruptions from incident metadata using CatBoost and Random Forest models
            to support faster operational decisions.
          </p>
          <div className="home__actions">
            <button className="homeBtn homeBtn--primary" onClick={() => navigate("/prediction")}>
              Open Prediction
            </button>
            <button className="homeBtn homeBtn--ghost" onClick={() => navigate("/live-map")}>
              Open Live Map
            </button>
          </div>
        </section>

        <section className="home__section">
          <div className="home__sectionHead">
            <h2>Core Capabilities</h2>
            <p>What the application provides for the thesis workflow.</p>
          </div>

          <div className="home__grid">
            <CapabilityCard
              title="Real-Time Monitoring"
              description="Review active incidents and monitor spatial context through a map view that is refreshed in intervals."
            />
            <CapabilityCard
              title="Lane State Prediction"
              description="Infer likely lane closure states from event type, severity, time, and planned duration attributes."
            />
            <CapabilityCard
              title="Decision Support"
              description="Inspect confidence and class probabilities to prioritize traffic response and resource allocation."
            />
          </div>
        </section>
      </Container>
    </div>
  );
}

function CapabilityCard({ title, description }: CapabilityCardProps) {
  return (
    <article className="capCard">
      <img src={capabilityImage} alt={title} className="capCard__image" />
      <div className="capCard__body">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </article>
  );
}
