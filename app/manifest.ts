import type { MetadataRoute } from "next";

// Lets the iPhone/Android "Add to Home Screen" open the app full screen, like a real app
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.BUSINESS_NAME ?? "Event Scheduler",
    short_name: process.env.BUSINESS_NAME ?? "Events",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#7c5cff",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
