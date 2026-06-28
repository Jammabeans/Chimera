import { getRegistryDiagnostics } from "@/core/registry/getRegistryDiagnostics";

export default function RegistryDiagnosticsPage() {
  const diagnostics = getRegistryDiagnostics();

  return (
    <main className="container">
      <h1>Registry Diagnostics</h1>
      <p className="subtle">
        This page validates local benchmark registry entries before any future sync/load workflow is attempted.
      </p>

      <section className="registry-diagnostics-summary" aria-label="Registry diagnostics summary">
        <p>
          <strong>Total entries:</strong> {diagnostics.totalCount}
        </p>
        <p>
          <strong>Valid:</strong> {diagnostics.validCount}
        </p>
        <p>
          <strong>Invalid:</strong> {diagnostics.invalidCount}
        </p>
      </section>

      <ul className="registry-diagnostics-list">
        {diagnostics.entries.map((entry) => (
          <li key={`${entry.index}-${entry.id}`} className="registry-diagnostics-item">
            <h2>
              {entry.id} <span className={entry.valid ? "diag-valid" : "diag-invalid"}>{entry.valid ? "valid" : "invalid"}</span>
            </h2>
            <p className="subtle">Registry index: {entry.index >= 0 ? entry.index : "root"}</p>

            {entry.errors.length > 0 ? (
              <>
                <h3>Errors</h3>
                <ul>
                  {entry.errors.map((error) => (
                    <li key={error} className="diag-error">
                      {error}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="diag-valid">No errors.</p>
            )}

            {entry.warnings.length > 0 && (
              <>
                <h3>Warnings</h3>
                <ul>
                  {entry.warnings.map((warning) => (
                    <li key={warning} className="diag-warning">
                      {warning}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

