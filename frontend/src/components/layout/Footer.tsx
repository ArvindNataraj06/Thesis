import Container from "./Container";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <Container size="wide" className="footer__inner">
        <div className="footer__left">
          <span className="footer__dot" />
          <span>Master Thesis Project</span>
        </div>

        <div className="footer__center">
          <a className="footerLink" href="#">
            Research Summary
          </a>
          <a className="footerLink" href="#">
            Model Notes
          </a>
          <a className="footerLink" href="#">
            Contact
          </a>
        </div>

        <div className="footer__right">
          Copyright {new Date().getFullYear()} Traffic Incident Prediction System
        </div>
      </Container>
    </footer>
  );
}
