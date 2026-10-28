import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../context/authContextDef";
import { ToastProvider } from "../context/ToastContext";
import { AccountPage } from "../pages/AccountPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { SectionNav, RailButton } from "../components/workspace/AppShell";
import { Settings } from "lucide-react";
import { parseHashRoute } from "../routing/hashRoute";
import { ApiRequestError } from "../api/client";
import { usePreference } from "../features/settings/hooks/usePreference";

function createMockAuth(overrides = {}) {
  return {
    user: {
      id: "user-1",
      email: "ada@example.com",
      display_name: "Ada Lovelace",
      timezone: "UTC",
      is_active: true,
      is_verified: true,
      last_login_at: "2026-10-26T12:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    token: null,
    status: "authenticated" as const,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
    refreshSession: vi.fn(),
    ...overrides,
  };
}

import { ThemeProvider } from "../theme/ThemeProvider";

function renderSettings(authOverrides = {}) {
  const auth = createMockAuth(authOverrides);
  const result = render(
    <ThemeProvider>
      <ToastProvider>
        <AuthContext.Provider value={auth}>
          <SettingsPage />
        </AuthContext.Provider>
      </ToastProvider>
    </ThemeProvider>
  );
  return { ...result, auth };
}

describe("Settings Hub — Phase 1", () => {
  beforeEach(() => {
    window.location.hash = "#settings?s=profile";
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  describe("Routing & Redirects", () => {
    it("parses settings hash and deep paths into settings workspace route", () => {
      expect(parseHashRoute("#settings")).toBe("settings");
      expect(parseHashRoute("#settings?s=profile")).toBe("settings");
      expect(parseHashRoute("#settings/profile")).toBe("settings");
      expect(parseHashRoute("#settings/security")).toBe("settings");
      expect(parseHashRoute("#settings/unknown-slug")).toBe("settings");
    });

    it("redirects #settings without section to #settings?s=profile", () => {
      window.location.hash = "#settings";
      renderSettings();
      expect(window.location.hash).toBe("#settings?s=profile");
    });

    it("redirects legacy #account to #settings?s=profile via AccountPage shim", () => {
      window.location.hash = "#account";
      render(<AccountPage />);
      expect(window.location.hash).toBe("#settings?s=profile");
    });

    it("renders 404 inside right pane when unknown section is requested, keeping nav mounted", () => {
      window.location.hash = "#settings?s=non-existent-section";
      renderSettings();

      // Left pane nav is still rendered
      expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeInTheDocument();
      // Right pane displays not found
      expect(screen.getByText("Page not found")).toBeInTheDocument();
      expect(
        screen.getByText("That workspace view is not available.")
      ).toBeInTheDocument();

      // Clicking Return to Profile navigates back
      fireEvent.click(screen.getByRole("button", { name: "Return to Profile" }));
      expect(window.location.hash).toBe("#settings?s=profile");
    });
  });

  describe("Navigation & Accessibility", () => {
    it("renders semantic navigation landmark with aria-label", () => {
      renderSettings();
      const nav = screen.getByRole("navigation", { name: "Settings sections" });
      expect(nav).toBeInTheDocument();
    });

    it("marks active section link with aria-current='page'", () => {
      renderSettings();
      const profileLink = screen.getByRole("link", { name: "Profile" });
      expect(profileLink).toHaveAttribute("aria-current", "page");

      const securityLink = screen.getByRole("link", { name: "Security" });
      expect(securityLink).not.toHaveAttribute("aria-current");
    });

    it("switches section and updates hash when clicking another section", () => {
      renderSettings();
      const securityLink = screen.getByRole("link", { name: "Security" });
      fireEvent.click(securityLink);

      expect(window.location.hash).toBe("#settings?s=security");
      expect(securityLink).toHaveAttribute("aria-current", "page");
    });

    it("highlights both Account in SectionNav and Settings in RailButton when on settings route", () => {
      render(
        <>
          <SectionNav route="settings" />
          <RailButton
            label="Settings"
            icon={Settings}
            active={true}
            onClick={() => undefined}
          />
        </>
      );

      const activeElements = document.querySelectorAll('[aria-current="page"]');
      expect(activeElements.length).toBe(2);
      expect(screen.getByRole("button", { name: "Account" })).toHaveAttribute(
        "aria-current",
        "page"
      );
      expect(screen.getByRole("button", { name: "Settings" })).toHaveAttribute(
        "aria-current",
        "page"
      );
    });
  });

  describe("Profile Section Display", () => {
    it("renders avatar initials preview from user display name", () => {
      renderSettings();
      expect(screen.getByLabelText("Avatar initials preview")).toHaveTextContent("AL");
    });

    it("renders read-only email with verified status", () => {
      renderSettings({
        user: {
          id: "u1",
          email: "ada@example.com",
          display_name: "Ada Lovelace",
          timezone: "UTC",
          is_active: true,
          is_verified: true,
          last_login_at: null,
          created_at: "",
          updated_at: "",
        },
      });

      expect(screen.getByText("ada@example.com")).toBeInTheDocument();
      expect(screen.getByText("Verified")).toBeInTheDocument();
      expect(
        screen.getByText("Verification emails are not available yet.")
      ).toBeInTheDocument();
    });

    it("renders unverified status when user is_verified is false", () => {
      renderSettings({
        user: {
          id: "u1",
          email: "bob@example.com",
          display_name: "Bob",
          timezone: "UTC",
          is_active: true,
          is_verified: false,
          last_login_at: null,
          created_at: "",
          updated_at: "",
        },
      });

      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      expect(screen.getByText("Unverified")).toBeInTheDocument();
    });
  });

  describe("Display Name Inline Edit", () => {
    it("renders current display name with Edit button", () => {
      renderSettings();
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Edit Display name" })
      ).toBeInTheDocument();
    });

    it("swaps to inline input with Save and Cancel when Edit is clicked", () => {
      renderSettings();
      fireEvent.click(screen.getByRole("button", { name: "Edit Display name" }));

      const input = screen.getByRole("textbox", { name: "Display name" });
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("Ada Lovelace");
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("cancels edit mode on Escape key without updating", () => {
      renderSettings();
      fireEvent.click(screen.getByRole("button", { name: "Edit Display name" }));

      const input = screen.getByRole("textbox", { name: "Display name" });
      fireEvent.change(input, { target: { value: "Changed Name" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(
        screen.queryByRole("textbox", { name: "Display name" })
      ).not.toBeInTheDocument();
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });

    it("validates empty display name and displays inline error without calling updateProfile", async () => {
      const { auth } = renderSettings();
      fireEvent.click(screen.getByRole("button", { name: "Edit Display name" }));

      const input = screen.getByRole("textbox", { name: "Display name" });
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(
        await screen.findByText("Display name cannot be empty.")
      ).toBeInTheDocument();
      expect(auth.updateProfile).not.toHaveBeenCalled();
    });

    it("saves valid name, calls updateProfile, shows Saved pill, and triggers toast", async () => {
      const { auth } = renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "Edit Display name" }));

      const input = screen.getByRole("textbox", { name: "Display name" });
      fireEvent.change(input, { target: { value: "Countess of Lovelace" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(auth.updateProfile).toHaveBeenCalledWith(
          "Countess of Lovelace",
          "UTC"
        );
      });

      expect(await screen.findByText("Saved")).toBeInTheDocument();
      expect(await screen.findByText("Profile updated.")).toBeInTheDocument();
    });

    it("saves on Enter key press", async () => {
      const { auth } = renderSettings();
      fireEvent.click(screen.getByRole("button", { name: "Edit Display name" }));

      const input = screen.getByRole("textbox", { name: "Display name" });
      fireEvent.change(input, { target: { value: "Augusta Ada" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(auth.updateProfile).toHaveBeenCalledWith("Augusta Ada", "UTC");
      });
    });

    it("displays server error inline if updateProfile fails", async () => {
      renderSettings({
        updateProfile: vi
          .fn()
          .mockRejectedValue(new ApiRequestError(400, "Name already taken")),
      });

      fireEvent.click(screen.getByRole("button", { name: "Edit Display name" }));

      const input = screen.getByRole("textbox", { name: "Display name" });
      fireEvent.change(input, { target: { value: "New Name" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("Name already taken")).toBeInTheDocument();
    });
  });

  describe("Security Section & Coming Soon Rows", () => {
    it("renders security rows and disabled coming soon items", () => {
      window.location.hash = "#settings?s=security";
      renderSettings();

      expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
      expect(
        screen.getByText("Manage your password, authentication sessions, and sign-in credentials.")
      ).toBeInTheDocument();

      // Email address with Coming soon tag
      expect(screen.getByText("Email used for account recovery and critical security alerts.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();

      // Password row
      expect(screen.getByRole("button", { name: "Change password" })).toBeInTheDocument();

      // Active sessions row
      expect(screen.getByRole("button", { name: "Sign out of all devices" })).toBeInTheDocument();

      // 2-step verification switch is disabled and off
      const switch2fa = screen.getByRole("switch", { name: "2-step verification" });
      expect(switch2fa).toBeDisabled();
      expect(switch2fa).toHaveAttribute("aria-checked", "false");

      // Deactivate account text action is disabled
      const deactivateBtn = screen.getByRole("button", { name: "Deactivate" });
      expect(deactivateBtn).toBeDisabled();

      // Verify Coming soon tags
      const comingSoonTags = screen.getAllByText("Coming soon");
      expect(comingSoonTags.length).toBeGreaterThanOrEqual(3);
    });

    it("ensures coming-soon controls are inert and clicking does nothing", () => {
      window.location.hash = "#settings?s=security";
      renderSettings();

      const editBtn = screen.getByRole("button", { name: "Edit" });
      fireEvent.click(editBtn);

      const switch2fa = screen.getByRole("switch", { name: "2-step verification" });
      fireEvent.click(switch2fa);
      expect(switch2fa).toHaveAttribute("aria-checked", "false");

      const deactivateBtn = screen.getByRole("button", { name: "Deactivate" });
      fireEvent.click(deactivateBtn);

      // No modal should open
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Change Password Modal", () => {
    it("opens accessible modal when clicking Change password", () => {
      window.location.hash = "#settings?s=security";
      renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "Change password" }));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Change password" })).toBeInTheDocument();
      expect(screen.getByLabelText("Current password")).toBeInTheDocument();
      expect(screen.getByLabelText("New password")).toBeInTheDocument();
      expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
    });

    it("toggles password field visibility with show/hide buttons", () => {
      window.location.hash = "#settings?s=security";
      renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "Change password" }));

      const currentInput = screen.getByLabelText("Current password");
      expect(currentInput).toHaveAttribute("type", "password");

      const toggleCurrent = screen.getByRole("button", { name: "Show current password" });
      fireEvent.click(toggleCurrent);
      expect(currentInput).toHaveAttribute("type", "text");

      const hideCurrent = screen.getByRole("button", { name: "Hide current password" });
      fireEvent.click(hideCurrent);
      expect(currentInput).toHaveAttribute("type", "password");
    });

    it("displays dynamic password strength as user types new password", () => {
      window.location.hash = "#settings?s=security";
      renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "Change password" }));

      const newInput = screen.getByLabelText("New password");
      fireEvent.change(newInput, { target: { value: "pass" } });
      expect(screen.getByText(/Strength: Weak/)).toBeInTheDocument();

      fireEvent.change(newInput, { target: { value: "Password123" } });
      expect(screen.getByText(/Strength: (Good|Fair|Strong)/)).toBeInTheDocument();

      fireEvent.change(newInput, { target: { value: "Super!Secure#2026Password" } });
      expect(screen.getByText(/Strength: Strong/)).toBeInTheDocument();
    });

    it("validates empty fields and password mismatch without calling API", async () => {
      window.location.hash = "#settings?s=security";
      const { auth } = renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "Change password" }));

      // Submit empty
      const dialog = screen.getByRole("dialog");
      const submitBtn = within(dialog).getByRole("button", { name: "Change password" });
      fireEvent.click(submitBtn);

      expect(await screen.findByText("Current password is required.")).toBeInTheDocument();
      expect(screen.getByText("New password is required.")).toBeInTheDocument();
      expect(screen.getByText("Please confirm your new password.")).toBeInTheDocument();
      expect(auth.changePassword).not.toHaveBeenCalled();

      // Fill mismatching passwords
      fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "OldPassword1" } });
      fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword123" } });
      fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "MismatchPassword123" } });
      fireEvent.click(submitBtn);

      expect(await screen.findByText("New passwords do not match.")).toBeInTheDocument();
      expect(auth.changePassword).not.toHaveBeenCalled();
    });

    it("calls changePassword on valid submission, triggers toast, and closes modal", async () => {
      window.location.hash = "#settings?s=security";
      const { auth } = renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "Change password" }));
      const dialog = screen.getByRole("dialog");

      fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "CurrentPass123" } });
      fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewSecurePass123!" } });
      fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewSecurePass123!" } });

      const submitBtn = within(dialog).getByRole("button", { name: "Change password" });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(auth.changePassword).toHaveBeenCalledWith("CurrentPass123", "NewSecurePass123!");
      });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(await screen.findByText("Password changed. Other active sessions were signed out.")).toBeInTheDocument();
    });

    it("maps API errors to field-level message in modal", async () => {
      window.location.hash = "#settings?s=security";
      renderSettings({
        changePassword: vi
          .fn()
          .mockRejectedValue(new ApiRequestError(400, "Current password is incorrect")),
      });

      fireEvent.click(screen.getByRole("button", { name: "Change password" }));
      const dialog = screen.getByRole("dialog");

      fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "WrongCurrentPass" } });
      fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewSecurePass123!" } });
      fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewSecurePass123!" } });

      const submitBtn = within(dialog).getByRole("button", { name: "Change password" });
      fireEvent.click(submitBtn);

      expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes modal on Cancel button and on Escape key", () => {
      window.location.hash = "#settings?s=security";
      renderSettings();

      // Open and cancel via button
      fireEvent.click(screen.getByRole("button", { name: "Change password" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Open and close via Escape
      fireEvent.click(screen.getByRole("button", { name: "Change password" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Sessions & Logout All Devices", () => {
    it("opens ConfirmDialog when clicking Sign out of all devices", () => {
      window.location.hash = "#settings?s=security";
      renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "Sign out of all devices" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Sign out everywhere?" })).toBeInTheDocument();
      expect(
        screen.getByText(/This will revoke every active session for this account across all browsers and devices/)
      ).toBeInTheDocument();
    });

    it("closes confirm dialog without calling logoutAll when Cancel is clicked", () => {
      window.location.hash = "#settings?s=security";
      const { auth } = renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "Sign out of all devices" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(auth.logoutAll).not.toHaveBeenCalled();
    });

    it("calls logoutAll when confirming sign out all devices", async () => {
      window.location.hash = "#settings?s=security";
      const { auth } = renderSettings();

      fireEvent.click(screen.getByRole("button", { name: "Sign out of all devices" }));
      const confirmBtn = screen.getByRole("button", { name: "Sign out all devices" });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(auth.logoutAll).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Notifications Section", () => {
    it("renders notification preference toggles and toggles them into localStorage", () => {
      window.location.hash = "#settings?s=notifications";
      renderSettings();

      expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();

      const enableNotificationsSwitch = screen.getByRole("switch", { name: "Enable notifications" });
      expect(enableNotificationsSwitch).toHaveAttribute("aria-checked", "true");

      fireEvent.click(enableNotificationsSwitch);
      expect(enableNotificationsSwitch).toHaveAttribute("aria-checked", "false");
      expect(window.localStorage.getItem("agenspace-pref-notifications")).toBe("false");

      const deadlinesSwitch = screen.getByRole("switch", { name: "Deadline reminders" });
      expect(deadlinesSwitch).toHaveAttribute("aria-checked", "true");
      fireEvent.click(deadlinesSwitch);
      expect(window.localStorage.getItem("agenspace-pref-deadline-reminders")).toBe("false");

      const briefingSwitch = screen.getByRole("switch", { name: "Daily briefing reminder" });
      expect(briefingSwitch).toHaveAttribute("aria-checked", "true");
      fireEvent.click(briefingSwitch);
      expect(window.localStorage.getItem("agenspace-pref-briefing-reminder")).toBe("false");
    });
  });

  describe("Moon / Assistant Section", () => {
    it("renders dynamic assistant name and briefing toggle on Overview", () => {
      window.location.hash = "#settings?s=moon";
      renderSettings();

      expect(screen.getByRole("heading", { name: "Moon" })).toBeInTheDocument();
      expect(screen.getByText("Assistant name")).toBeInTheDocument();
      expect(screen.getAllByText("Moon").length).toBeGreaterThanOrEqual(2);

      const briefingSwitch = screen.getByRole("switch", { name: "Show Moon briefing on Overview" });
      expect(briefingSwitch).toHaveAttribute("aria-checked", "true");

      fireEvent.click(briefingSwitch);
      expect(briefingSwitch).toHaveAttribute("aria-checked", "false");
      expect(window.localStorage.getItem("agenspace-pref-moon-briefing")).toBe("false");

      // Coming soon access row
      const manageLink = screen.getByText("Manage apps");
      expect(manageLink).toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("Appearance Section", () => {
    it("renders theme segmented control and syncs with ThemeProvider", () => {
      window.location.hash = "#settings?s=appearance";
      renderSettings();

      expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();

      const radiogroup = screen.getByRole("radiogroup", { name: "Color theme" });
      expect(radiogroup).toBeInTheDocument();

      const darkRadio = screen.getByRole("radio", { name: "Dark" });
      fireEvent.click(darkRadio);

      expect(darkRadio).toHaveAttribute("aria-checked", "true");
      expect(window.localStorage.getItem("agenspace-theme")).toBe("dark");

      const lightRadio = screen.getByRole("radio", { name: "Light" });
      fireEvent.click(lightRadio);
      expect(lightRadio).toHaveAttribute("aria-checked", "true");
      expect(window.localStorage.getItem("agenspace-theme")).toBe("light");
    });

    it("navigates segmented control with arrow keys", () => {
      window.location.hash = "#settings?s=appearance";
      renderSettings();

      fireEvent.click(screen.getByRole("radio", { name: "Light" }));
      expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");

      const radiogroup = screen.getByRole("radiogroup", { name: "Color theme" });
      fireEvent.keyDown(radiogroup, { key: "ArrowRight" });
      expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");

      fireEvent.keyDown(radiogroup, { key: "ArrowRight" });
      expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
    });

    it("toggles reduce motion and sets data-motion attribute on html element", () => {
      window.location.hash = "#settings?s=appearance";
      renderSettings();

      const motionSwitch = screen.getByRole("switch", { name: "Reduce motion" });
      fireEvent.click(motionSwitch);

      expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");
      expect(window.localStorage.getItem("agenspace-pref-reduce-motion")).toBe("true");

      fireEvent.click(motionSwitch);
      expect(document.documentElement.getAttribute("data-motion")).toBeNull();
      expect(window.localStorage.getItem("agenspace-pref-reduce-motion")).toBe("false");
    });
  });

  describe("Connected Apps Section", () => {
    it("renders read-only integrations with Not connected tags and Manage links", () => {
      window.location.hash = "#settings?s=apps";
      renderSettings();

      expect(screen.getByRole("heading", { name: "Connected apps" })).toBeInTheDocument();
      expect(screen.getByText("Gmail")).toBeInTheDocument();
      expect(screen.getByText("Google Classroom")).toBeInTheDocument();
      expect(screen.getByText("Google Calendar")).toBeInTheDocument();

      const notConnectedTags = screen.getAllByText("Not connected");
      expect(notConnectedTags.length).toBe(3);

      const manageLinks = screen.getAllByRole("link", { name: /Manage .* in Manage integrations/ });
      expect(manageLinks.length).toBe(3);
      for (const link of manageLinks) {
        expect(link).toHaveAttribute("href", "#manage");
      }
    });
  });

  describe("Data & Privacy Section", () => {
    it("renders coming soon data export and storage policy explanation", () => {
      window.location.hash = "#settings?s=data";
      renderSettings();

      expect(screen.getByRole("heading", { name: "Data and privacy" })).toBeInTheDocument();
      expect(screen.getByText("Export my data")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Export data" })).toBeDisabled();

      expect(screen.getByText("Where is your data stored?")).toBeInTheDocument();
      expect(screen.getByText(/Server storage:/)).toBeInTheDocument();
      expect(screen.getByText(/Local browser storage:/)).toBeInTheDocument();
    });
  });

  describe("Delete Account Section", () => {
    it("renders danger styled delete account section with disabled coming soon action", () => {
      window.location.hash = "#settings?s=delete";
      renderSettings();

      expect(screen.getByRole("heading", { name: "Delete account" })).toBeInTheDocument();
      expect(screen.getByText("Delete account permanently")).toBeInTheDocument();

      const deleteBtn = screen.getByRole("button", { name: "Delete account" });
      expect(deleteBtn).toBeDisabled();
      expect(deleteBtn).toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("usePreference Hook & Token Security", () => {
    function PreferenceConsumer() {
      const [val, setVal] = usePreference("test-key", false);
      return (
        <button onClick={() => setVal(!val)}>{val ? "ENABLED" : "DISABLED"}</button>
      );
    }

    it("persists boolean preference in localStorage", () => {
      render(<PreferenceConsumer />);
      expect(screen.getByRole("button")).toHaveTextContent("DISABLED");

      fireEvent.click(screen.getByRole("button"));
      expect(screen.getByRole("button")).toHaveTextContent("ENABLED");
      expect(window.localStorage.getItem("test-key")).toBe("true");
    });

    it("never writes auth tokens, secrets, or passwords to localStorage or sessionStorage", () => {
      renderSettings();
      const localKeys = Object.keys(window.localStorage);
      const sessionKeys = Object.keys(window.sessionStorage);

      for (const k of [...localKeys, ...sessionKeys]) {
        expect(k.toLowerCase()).not.toContain("token");
        expect(k.toLowerCase()).not.toContain("secret");
        expect(k.toLowerCase()).not.toContain("password");
        expect(k.toLowerCase()).not.toContain("bearer");
      }
    });
  });
});
