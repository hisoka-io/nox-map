import { useRef, useMemo, useEffect } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { GLOBE_RADIUS } from "./constants";
import { useDashboardStore } from "../store/useDashboardStore";

const STYLE_CONFIG = {
  night: { texture: "./earth_night.jpg", tint: "#44ffaa", opacity: 0.9 },
  day: { texture: "./earth_day.jpg", tint: "#88ccaa", opacity: 0.7 },
  dark: { texture: null, tint: "#0a1a0e", opacity: 0.8 },
} as const;

export function Globe() {
  const groupRef = useRef<THREE.Group>(null);
  const globeStyle = useDashboardStore((s) => s.globeStyle);
  const config = STYLE_CONFIG[globeStyle];

  const textures = useTexture({
    night: "./earth_night.jpg",
    day: "./earth_day.jpg",
  });

  useMemo(() => {
    textures.night.colorSpace = THREE.SRGBColorSpace;
    textures.day.colorSpace = THREE.SRGBColorSpace;
  }, [textures]);

  const activeTexture = config.texture
    ? globeStyle === "day"
      ? textures.day
      : textures.night
    : null;

  // Rotation is handled by OrbitControls autoRotate in App.tsx
  // so the globe, nodes, and arcs all move together.

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshBasicMaterial
          map={activeTexture}
          color={config.tint}
          transparent
          opacity={config.opacity}
        />
      </mesh>

      {/* Subtle wireframe overlay */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.001, 48, 24]} />
        <meshBasicMaterial
          color="#00ff88"
          wireframe
          transparent
          opacity={0.04}
        />
      </mesh>

      {/* Atmosphere glow inner */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.03, 64, 64]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.08, 64, 64]} />
        <meshBasicMaterial
          color="#00aa66"
          transparent
          opacity={0.015}
          side={THREE.BackSide}
        />
      </mesh>

      <DotGrid />
    </group>
  );
}

function DotGrid() {
  const pointsRef = useRef<THREE.Points>(null);

  const geo = useMemo(() => {
    const positions: number[] = [];
    const colorArr: number[] = [];
    const step = 4;
    const baseColor = new THREE.Color("#00ff88");
    const dimColor = new THREE.Color("#004422");
    const tempColor = new THREE.Color();

    for (let lat = -85; lat <= 85; lat += step) {
      const lonStep = step / Math.max(Math.cos((lat * Math.PI) / 180), 0.15);
      for (let lon = -180; lon < 180; lon += Math.max(lonStep, step)) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        const r = GLOBE_RADIUS * 1.002;
        positions.push(
          -r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta),
        );

        const latFactor = 1 - Math.abs(lat) / 90;
        tempColor
          .copy(dimColor)
          .lerp(baseColor, latFactor * 0.5 + Math.random() * 0.2);
        colorArr.push(tempColor.r, tempColor.g, tempColor.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colorArr, 3));
    return g;
  }, []);

  useEffect(() => {
    return () => {
      geo.dispose();
    };
  }, [geo]);

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        size={0.01}
        transparent
        opacity={0.25}
        sizeAttenuation
        vertexColors
      />
    </points>
  );
}
