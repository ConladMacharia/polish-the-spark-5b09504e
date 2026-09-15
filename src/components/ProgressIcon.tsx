import { useState } from "react";
import ProgressGraph from "./ProgressGraph";

interface ProgressIconProps {
  childId: string;
  exercise?: string;
}

export default function ProgressIcon({ childId, exercise }: ProgressIconProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button aria-label="Open progress" onClick={() => setOpen(true)}>
        📈
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 720, maxWidth: "95%", background: "white", padding: 16, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Progress</h3>
              <div>
                <button onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <ProgressGraph childId={childId} exercise={exercise} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
