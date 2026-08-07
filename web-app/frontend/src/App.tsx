import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Statement from "./pages/Statement";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Backup from "./pages/Backup";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/statement" element={<Statement />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/backup" element={<Backup />} />
      </Route>
    </Routes>
  );
}
