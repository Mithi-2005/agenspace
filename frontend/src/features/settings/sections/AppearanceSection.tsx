import { Monitor, Moon, Sun } from "lucide-react";
import { Switch } from "../../../components/ui/workspaceUi";
import { useTheme } from "../../../theme/useTheme";
import type { ThemePreference } from "../../../theme/theme";
import { SegmentedControl, type SegmentedOption } from "../components/SegmentedControl";
import { SettingRow } from "../components/SettingRow";
import { useReduceMotion } from "../hooks/useReduceMotion";

export function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  const [reducedMotion, setReducedMotion] = useReduceMotion();

  const themeOptions: SegmentedOption<ThemePreference>[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="as-settings-section" aria-labelledby="section-appearance-heading">
      <header className="as-settings-section-head">
        <h2 id="section-appearance-heading" className="as-settings-section-title">
          Appearance
        </h2>
        <p className="as-settings-section-description">
          Customize the visual styling, theme, and animation preferences of your workspace.
        </p>
      </header>

      <div className="as-settings-rows">
        {/* Theme Segmented Control */}
        <SettingRow
          id="row-appearance-theme"
          title="Color theme"
          description="Switch between light, dark, or follow your operating system appearance."
          control={
            <SegmentedControl
              options={themeOptions}
              value={preference}
              onChange={setPreference}
              ariaLabel="Color theme"
            />
          }
        />

        {/* Reduce Motion Toggle */}
        <SettingRow
          id="row-appearance-motion"
          title="Reduce motion"
          description="Minimize UI animations, decorative transitions, and motion across the workspace."
          control={
            <Switch
              label="Reduce motion"
              checked={reducedMotion}
              onChange={setReducedMotion}
            />
          }
        />
      </div>
    </div>
  );
}
