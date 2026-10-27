import { Link } from "react-router-dom";
import logoImg from "@/assets/images/tripmate-logo.png";

interface TripMateLogoProps {
  variant?: "white" | "dark";
  className?: string;
  to?: string;
}

export function TripMateLogo({
  variant = "white",
  className = "h-8 sm:h-9",
  to = "/",
}: TripMateLogoProps) {
  const content = (
    <img
      src={logoImg}
      alt="TripMate"
      className={`w-auto object-contain select-none transition-opacity hover:opacity-90 ${
        variant === "white"
          ? "mix-blend-screen brightness-110"
          : "invert mix-blend-multiply brightness-95"
      } ${className}`}
      loading="eager"
    />
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center focus:outline-none cursor-pointer">
        {content}
      </Link>
    );
  }

  return content;
}

export default TripMateLogo;
