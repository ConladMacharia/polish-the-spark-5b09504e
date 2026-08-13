// src/components/SidedExerciseSession.tsx
//
// Wraps LiveTrackingSession with a Left/Right arm selector.
// The caregiver picks a side before the exercise starts; the choice
// feeds directly into the existing `side` prop that LiveTrackingSession
// and the angle-calculation functions already support.

import { useState } from "react";
import { LiveTrackingSession } from "./LiveTrackingSession";
import type { Side } from "../lib/pose/angleUtils";

interface SidedExerciseSessionProps {
  movement: "elbow" | "shoulderFlexion";
  exerciseName: string;
  defaultSide?: Side;
}

export function SidedExerciseSession({
  movement,
  exerciseName,
  defaultSide = "right",
}: SidedExerciseSessionProps) {
  const [side, setSide] = useState<Side>(defaultSide);
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <div style={{ textAlign: "center", padding: 24 }}>
        <h2>{exerciseName}</h2>
        <p style={{ opacity: 0.7, marginBottom: 16 }}>
          Which arm will the child be using for this exercise?
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
          <button
            onClick={() => setSide("left")}
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              border: side === "left" ? "2px solid #2563eb" : "1px solid #ccc",
              background: side === "left" ? "#eff6ff" : "white",
              fontWeight: side === "left" ? 700 : 400,
            }}
          >
            Left arm
          </button>
          <button
            onClick={() => setSide("right")}
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              border: side === "right" ? "2px solid #2563eb" : "1px solid #ccc",
              background: side === "right" ? "#eff6ff" : "white",
              fontWeight: side === "right" ? 700 : 400,
            }}
          >
            Right arm
          </button>
        </div>

        <button
          onClick={() => setStarted(true)}
          style={{
            padding: "14px 32px",
            borderRadius: 8,
            background: "#2563eb",
            color: "white",
            fontWeight: 700,
            border: "none",
          }}
        >
          Start session
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          textAlign: "center",
          padding: "8px 0",
          fontWeight: 700,
          fontSize: 14,
          background: "#eff6ff",
          borderRadius: 6,
          marginBottom: 8,
        }}
      >
        Tracking: {side === "left" ? "Left" : "Right"} arm
        <button
          onClick={() => setStarted(false)}
          style={{
            marginLeft: 12,
            fontSize: 12,
            fontWeight: 400,
            background: "none",
            border: "none",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Change side
        </button>
      </div>

      <LiveTrackingSession movement={movement} side={side} />
    </div>
  );
}
