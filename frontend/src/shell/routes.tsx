// review:PF0-T4
import { Route, Routes } from "react-router-dom";

import ComposeScreen from "../screens/ComposeScreen";
import GalleryScreen from "../screens/GalleryScreen";
import LiveScreen from "../screens/LiveScreen";
import RetroScreen from "../screens/RetroScreen";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<GalleryScreen />} />
      <Route path="/compose" element={<ComposeScreen />} />
      <Route path="/run/:id/live" element={<LiveScreen />} />
      <Route path="/run/:id/retro" element={<RetroScreen />} />
    </Routes>
  );
}
