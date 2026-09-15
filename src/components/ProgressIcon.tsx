import { useState } from "react";
import ProgressGraph from "./ProgressGraph";
import { Button } from "@/components/ui/button";

interface ProgressIconProps {
  childId: string;
  exercise?: string;
}

export default function ProgressIcon({ childId, exercise }: ProgressIconProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <span className="mr-2">📈</span>
        Progress
      </Button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div style={{ width: 720, maxWidth: "95%", background: "white", padding: 16, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Progress</h3>
              <div>
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
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
