// review:PF0-T4
import { Route, Routes } from "react-router-dom";

import ComposeScreen from "../screens/ComposeScreen";
import GalleryScreen from "../screens/GalleryScreen";
import HistoryScreen from "../screens/HistoryScreen";
import IdentityScreen from "../screens/IdentityScreen";
import LiveScreen from "../screens/LiveScreen";
import MultiPlatformLiveScreen from "../screens/MultiPlatformLiveScreen";
import RetroScreen from "../screens/RetroScreen";
import WorldOverviewScreen from "../screens/WorldOverviewScreen";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<GalleryScreen />} />
      <Route path="/history" element={<HistoryScreen />} />
      <Route path="/worlds" element={<WorldOverviewScreen />} /> {/* review:P11-T6 */}
      <Route path="/identity/:personId" element={<IdentityScreen />} />
      <Route path="/compose" element={<ComposeScreen />} />
      <Route path="/run/:id/live" element={<LiveScreen />} />
      <Route path="/run/:id/retro" element={<RetroScreen />} />
      <Route path="/world/:id/live" element={<MultiPlatformLiveScreen />} />
    </Routes>
  );
}
