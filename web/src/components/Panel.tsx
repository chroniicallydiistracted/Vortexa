import React, { useEffect, useState, useMemo } from "react";
import { useStore } from "../util/store";

// Adjusted to new catalog structure: { layers: CatalogEntry[] }
interface CatalogEntry {
  category: string;
  suggested_label: string;
  slug: string;
  source_type?: string;
  notes?: string;
  attribution?: string;
}

interface PanelProps {
  onSelect: (slug: string) => void;
  activeLayerSlug: string | null;
}

export default function Panel({ onSelect, activeLayerSlug }: PanelProps) {
  const mode = useStore((s) => s.mode);
  const gibsOn = useStore((s) => s.gibsGeocolor3d);
  const gibsTimestamps = useStore((s) => s.gibsTimestamps);
  const setGibsTimestamps = useStore((s) => s.setGibsTimestamps);
  const gibsSelectedTime = useStore((s) => s.gibsSelectedTime);
  const setGibsSelectedTime = useStore((s) => s.setGibsSelectedTime);
  const gibsPlaying = useStore((s) => s.gibsPlaying);
  const toggleGibsPlaying = useStore((s) => s.toggleGibsPlaying);
  const stepGibsTime = useStore((s) => s.stepGibsTime);
  const gibsPlaybackSpeedMs = useStore((s) => s.gibsPlaybackSpeedMs);
  const setGibsPlaybackSpeed = useStore((s) => s.setGibsPlaybackSpeed);
  const showFirms3d = useStore((s) => s.showFirms3d);
  const toggleFirms3d = useStore((s) => s.toggleFirms3d);
  const showOwmTemp3d = useStore((s) => s.showOwmTemp3d);
  const toggleOwmTemp3d = useStore((s) => s.toggleOwmTemp3d);
  const [palette, setPalette] = useState<CatalogEntry[] | null>(null);
  useEffect(() => {
    fetch("/catalog.json")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPalette(data as any); // backward compatibility if array
        } else if (data && Array.isArray(data.layers)) {
          setPalette(data.layers);
        }
      })
      .catch(() => {});
  }, []);
  // Group entries by category
  const grouped = useMemo(() => {
    if (!palette) return {} as Record<string, CatalogEntry[]>;
    return palette.reduce(
      (acc, e) => {
        const key = e.category || "Other";
        (acc[key] = acc[key] || []).push(e);
        return acc;
      },
      {} as Record<string, CatalogEntry[]>,
    );
  }, [palette]);
  // Track which categories are collapsed
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCat = (c: string) => setCollapsed((s) => ({ ...s, [c]: !s[c] }));
  const allCats = useMemo(() => Object.keys(grouped).sort(), [grouped]);
  const collapseAll = () =>
    setCollapsed(Object.fromEntries(allCats.map((c) => [c, true])));
  const expandAll = () =>
    setCollapsed(Object.fromEntries(allCats.map((c) => [c, false])));
  // Fetch GIBS timestamps when 3D + gibs active and none loaded yet
  useEffect(() => {
    if (mode !== "3d" || !gibsOn) return;
    if (gibsTimestamps.length > 0) return;
    fetch("/api/gibs/timestamps")
      .then((r) => r.json())
      .then((arr) => {
        if (Array.isArray(arr)) {
          setGibsTimestamps(arr);
          if (arr.length > 0) setGibsSelectedTime(arr[arr.length - 1]); // latest
        }
      })
      .catch(() => {});
  }, [mode, gibsOn, gibsTimestamps.length]);
  return (
    <div
      style={{ padding: 12, overflow: "auto", fontSize: 13, lineHeight: 1.3 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <h3 style={{ margin: "0 8px 0 0" }}>Layers</h3>
        <button onClick={collapseAll} style={btnStyle}>
          Collapse All
        </button>
        <button onClick={expandAll} style={btnStyle}>
          Expand All
        </button>
        <button onClick={() => onSelect("")} style={btnStyle}>
          Clear
        </button>
      </div>
      {!palette && <div>Loading palette…</div>}
      {palette &&
        allCats.map((cat) => {
          const list = grouped[cat];
          const isCollapsed = collapsed[cat];
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => toggleCat(cat)}
              >
                <div style={{ fontWeight: 600, flex: 1 }}>{cat}</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginRight: 6 }}>
                  {list.length}
                </div>
                <div
                  style={{
                    transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    transition: "transform .15s",
                  }}
                >
                  &#9656;
                </div>
              </div>
              {!isCollapsed && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  {list.map((entry) => {
                    const slug = entry.slug;
                    const label = entry.suggested_label;
                    const active = slug === activeLayerSlug;
                    return (
                      <button
                        key={slug}
                        onClick={() => onSelect(active ? "" : slug)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: active
                            ? "2px solid #69b2ff"
                            : "1px solid #333",
                          background: active ? "#132235" : "#1a2633",
                          color: "#e8eef6",
                          cursor: "pointer",
                          fontSize: 12,
                          maxWidth: "160px",
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                        }}
                        title={
                          (entry.notes || "") +
                          (entry.attribution ? ` | ${entry.attribution}` : "")
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      {mode === "3d" && gibsOn && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>GIBS Time</div>
          {gibsTimestamps.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Loading timestamps…
            </div>
          )}
          {gibsTimestamps.length > 0 && (
            <select
              value={gibsSelectedTime || ""}
              onChange={(e) => setGibsSelectedTime(e.target.value || null)}
              style={{
                width: "100%",
                padding: "4px 6px",
                background: "#1a2633",
                color: "#e8eef6",
                border: "1px solid #35506d",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {gibsTimestamps.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          {gibsTimestamps.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 8,
                alignItems: "center",
              }}
            >
              <button
                style={btnStyle}
                onClick={() => stepGibsTime(-1)}
                disabled={!gibsTimestamps.length}
              >
                ◀
              </button>
              <button
                style={{
                  ...btnStyle,
                  background: gibsPlaying ? "#35506d" : "#223244",
                }}
                onClick={toggleGibsPlaying}
              >
                {gibsPlaying ? "Pause" : "Play"}
              </button>
              <button
                style={btnStyle}
                onClick={() => stepGibsTime(1)}
                disabled={!gibsTimestamps.length}
              >
                ▶
              </button>
              <select
                value={String(gibsPlaybackSpeedMs)}
                onChange={(e) => setGibsPlaybackSpeed(Number(e.target.value))}
                style={{ ...btnStyle, padding: "3px 4px" }}
              >
                <option value={2000}>0.5x</option>
                <option value={1500}>1x</option>
                <option value={800}>2x</option>
                <option value={400}>4x</option>
              </select>
            </div>
          )}
          {gibsPlaying && <GibsPlaybackAdvance />}
        </div>
      )}
      {mode === "3d" && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>3D Data Layers</div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            <input
              type="checkbox"
              checked={showFirms3d}
              onChange={toggleFirms3d}
            />{" "}
            FIRMS Fire Detections
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            <input
              type="checkbox"
              checked={showOwmTemp3d}
              onChange={toggleOwmTemp3d}
            />{" "}
            OWM Temperature Overlay
          </label>
        </div>
      )}
    </div>
  );
}

// Component to advance playback using setInterval while mounted
function GibsPlaybackAdvance() {
  const gibsPlaying = useStore((s) => s.gibsPlaying);
  const gibsPlaybackSpeedMs = useStore((s) => s.gibsPlaybackSpeedMs);
  const step = useStore((s) => s.stepGibsTime);
  useEffect(() => {
    if (!gibsPlaying) return;
    const id = setInterval(() => step(1), gibsPlaybackSpeedMs);
    return () => clearInterval(id);
  }, [gibsPlaying, gibsPlaybackSpeedMs]);
  return null;
}

const btnStyle: React.CSSProperties = {
  background: "#223244",
  border: "1px solid #35506d",
  color: "#e0e8f0",
  padding: "3px 6px",
  fontSize: 11,
  borderRadius: 4,
  cursor: "pointer",
};
