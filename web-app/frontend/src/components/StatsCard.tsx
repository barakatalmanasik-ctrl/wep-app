import { useSettings } from "../context/SettingsContext";

interface Props {
  value: number;
  label: string;
  color?: string;
  icon?: string;
}

export default function StatsCard({ value, label, color, icon }: Props) {
  const { settings } = useSettings();

  return (
    <div className="stat-card">
      {icon && <div className="text-2xl mb-2">{icon}</div>}
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p
        className="text-2xl font-bold"
        style={{ color: color || settings.themeColor }}
      >
        {value.toLocaleString("ar-IQ")}
      </p>
    </div>
  );
}
