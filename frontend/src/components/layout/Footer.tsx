import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__left">
        <span className="footer__dot" />
        <span>Master’s Thesis 2024</span>
      </div>

      <div className="footer__center">
        <a className="footerLink" href="#">Research Paper</a>
        <a className="footerLink" href="#">GitHub Repository</a>
        <a className="footerLink" href="#">Contact</a>
      </div>

      <div className="footer__right">
        © {new Date().getFullYear()} Traffic Incident Prediction System
      </div>
    </footer>
  );
}
