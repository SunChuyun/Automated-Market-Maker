import Link from "next/link";

export const Footer = () => (
  <footer className="studio-footer">
    <span>
      <span className="status-dot" /> Educational preview · Test assets only
    </span>
    <div>
      <Link href="/portfolio">Project status</Link>
      <Link href="/debug">Contract tools ↗</Link>
      <a href="https://github.com/SunChuyun/Automated-Market-Maker" target="_blank" rel="noreferrer">
        GitHub ↗
      </a>
    </div>
  </footer>
);
