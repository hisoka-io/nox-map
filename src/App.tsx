import React, { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Globe } from "./components/Globe";
import { NodeMarkers } from "./components/NodeMarkers";
import { PacketArcs } from "./components/PacketArcs";
import { TopBar } from "./components/TopBar";
import { EventFeed } from "./components/EventFeed";
import { StatsPanel } from "./components/StatsPanel";
import { BottomTicker } from "./components/BottomTicker";
import { NodeDetail } from "./components/NodeDetail";
import { useIndexer } from "./hooks/useIndexer";
import { useDashboardStore } from "./store/useDashboardStore";

class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#050a05",
            fontFamily: '"JetBrains Mono", monospace',
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ color: "#f59e0b", fontSize: "14px", marginBottom: 8 }}>
              3D rendering unavailable
            </div>
            <div style={{ color: "#666", fontSize: "11px" }}>
              Your browser or device may not support WebGL.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


function SceneCanvas() {
  return (
    <CanvasErrorBoundary>
      <div style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0, 5.5], fov: 40 }}
          style={{ background: "#050a05" }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
        >
          <ambientLight intensity={0.3} />
          <Globe />
          <NodeMarkers />
          <PacketArcs />
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={3}
            maxDistance={10}
            autoRotate
            autoRotateSpeed={0.3}
            enableDamping
          />
        </Canvas>
      </div>
    </CanvasErrorBoundary>
  );
}

export default function App() {
  useEffect(() => {
    const s = useDashboardStore.getState();
    s.setNodes([]);
    s.setClusterConnected(false);
    s.setSelectedNodeId(null);
    s.setMockMode(false);

    const params = new URLSearchParams(window.location.search);
    if (params.get("mock") === "true") {
      s.setMockMode(true);
    }
  }, []);

  useIndexer();

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "#050a05",
        fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
      }}
    >
      <SceneCanvas />
      <TopBar />
      <EventFeed />
      <StatsPanel />
      <BottomTicker />
      <NodeDetail />

    </main>
  );
}
