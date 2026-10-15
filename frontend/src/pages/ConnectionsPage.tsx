import { CalendarDays, Mail } from "lucide-react";
import React from "react";
import { getConnectionCatalog } from "../services/connectionService";
import type { ConnectionProvider } from "../types/connections";

function ProviderMark({ provider }: { provider: ConnectionProvider }) {
  const Icon = provider.category === "mail" ? Mail : CalendarDays;
  return (
    <span className={`provider-mark cat-${provider.category}`} aria-hidden="true">
      <Icon size={18} strokeWidth={1.75} />
    </span>
  );
}

export const ConnectionsPage: React.FC = () => {
  const catalog = getConnectionCatalog();

  return (
    <div className="page-connections">
      <header className="page-kicker">
        <div>
          <p className="date-line">Authorized services</p>
          <h1>Connections</h1>
        </div>
      </header>

      <section className="panel trust-panel">
        <h2>How connections will work</h2>
        <ul>
          <li>You authorize a named provider. Kosway will not invent OAuth success.</li>
          <li>Imported suggestions stay in Needs review until you accept or dismiss them.</li>
          <li>Disconnecting a provider will revoke access independently of executing any action.</li>
        </ul>
      </section>

      <ul className="provider-list">
        {catalog.providers.map((provider) => (
          <li key={provider.id} className="provider-row">
            <ProviderMark provider={provider} />
            <div className="provider-body">
              <div className="provider-title">
                <h2>{provider.name}</h2>
                <span className="status-tag">Not available yet</span>
              </div>
              <p>{provider.description}</p>
              <p className="provider-enables">{provider.enables.join(" · ")}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
