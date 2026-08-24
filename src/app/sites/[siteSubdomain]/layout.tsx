import { Bebas_Neue } from "next/font/google";
import "@/features/gym-platform/ui/gym.css";

const gymDisplay = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-gym-display" });

export default function GymPlatformLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${gymDisplay.variable} gym-platform`}>{children}</div>;
}
