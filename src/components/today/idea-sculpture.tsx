"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Circle, Pause, Play } from "@phosphor-icons/react";
import {
  Component,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CatmullRomCurve3,
  Color,
  Group,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
} from "three";

import { IdeaSculptureFallback } from "@/components/today/idea-sculpture-fallback";
import { useTheme } from "@/components/ui/theme-provider";

import styles from "./today-workspace.module.css";

type StaticReason =
  | "loading"
  | "reduced-motion"
  | "save-data"
  | "webgl-unavailable";

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

function staticReason(): StaticReason | null {
  if (typeof window === "undefined") return "loading";
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return "reduced-motion";
  }
  if ((window.navigator as NavigatorWithConnection).connection?.saveData) {
    return "save-data";
  }
  if (typeof window.WebGLRenderingContext === "undefined") {
    return "webgl-unavailable";
  }

  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ??
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    if (!context) return "webgl-unavailable";
  } catch {
    return "webgl-unavailable";
  }

  return null;
}

class SculptureErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // The raster fallback keeps the decision workflow available after GPU failure.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function path(points: Array<[number, number, number]>) {
  return new CatmullRomCurve3(
    points.map(([x, y, z]) => new Vector3(x, y, z)),
    false,
    "catmullrom",
    0.42,
  );
}

function WovenTube({
  color,
  points,
  radius,
}: {
  color: string;
  points: Array<[number, number, number]>;
  radius: number;
}) {
  const geometry = useMemo(
    () => new TubeGeometry(path(points), 88, radius, 12, false),
    [points, radius],
  );
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(color),
        roughness: 0.66,
        metalness: 0.02,
      }),
    [color],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <mesh geometry={geometry} material={material} />;
}

function DemandTicker({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!active) {
      invalidate();
      return;
    }

    let frame = 0;
    let lastFrameAt = 0;
    const tick = (time: number) => {
      if (time - lastFrameAt >= 1000 / 30) {
        lastFrameAt = time;
        invalidate();
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame);
  }, [active, invalidate]);

  return null;
}

function SculptureScene({ active, dark }: { active: boolean; dark: boolean }) {
  const group = useRef<Group>(null);
  const palette = dark
    ? { cream: "#cbb79e", coral: "#df4d2d", blue: "#283e70", bead: "#d7c2a7" }
    : { cream: "#e7cda8", coral: "#ef5a33", blue: "#315991", bead: "#ead9bd" };
  const paths = useMemo(
    () => ({
      cream: [
        [-0.8, 3.4, -0.1],
        [-1.0, 2.25, 0.1],
        [0.92, 1.62, 0.08],
        [0.58, 0.26, 0.38],
        [-0.86, -0.42, 0.06],
        [0.36, -1.08, -0.18],
      ] as Array<[number, number, number]>,
      coral: [
        [-0.42, 3.45, -0.28],
        [-0.52, 2.15, -0.2],
        [0.84, 1.25, -0.18],
        [0.62, -0.05, -0.1],
        [-0.48, -0.66, -0.24],
      ] as Array<[number, number, number]>,
      blue: [
        [-0.52, 0.04, 0.02],
        [-1.02, -0.85, 0.08],
        [-0.12, -1.5, 0.12],
        [0.06, -2.32, 0.02],
        [-0.54, -3.18, -0.1],
      ] as Array<[number, number, number]>,
      orbit: [
        [-1.65, 1.25, 0.26],
        [-0.8, 1.1, 0.38],
        [0.05, 0.68, 0.22],
        [1.32, 0.72, 0.05],
      ] as Array<[number, number, number]>,
    }),
    [],
  );

  useFrame((_state, delta) => {
    if (active && group.current) {
      group.current.rotation.y += Math.min(delta, 0.04) * 0.18;
    }
  });

  return (
    <>
      <ambientLight intensity={dark ? 1.2 : 1.7} />
      <directionalLight intensity={dark ? 2.1 : 2.6} position={[3, 4, 6]} />
      <pointLight color={palette.coral} intensity={7} position={[-2, 0, 3]} />
      <group ref={group} rotation={[0.04, -0.12, -0.08]} scale={0.82}>
        <WovenTube color={palette.coral} points={paths.coral} radius={0.115} />
        <WovenTube color={palette.cream} points={paths.cream} radius={0.15} />
        <WovenTube color={palette.blue} points={paths.blue} radius={0.13} />
        <WovenTube color={dark ? "#6580b3" : "#7693bd"} points={paths.orbit} radius={0.018} />
        <mesh position={[-1.67, 1.25, 0.26]}>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshStandardMaterial color={palette.bead} roughness={0.8} />
        </mesh>
        <mesh position={[1.33, 0.72, 0.05]}>
          <sphereGeometry args={[0.1, 24, 24]} />
          <meshStandardMaterial color={palette.coral} roughness={0.58} />
        </mesh>
        <mesh position={[-0.72, -2.2, 0.35]}>
          <sphereGeometry args={[0.19, 24, 24]} />
          <meshStandardMaterial color={palette.bead} roughness={0.86} />
        </mesh>
      </group>
      <DemandTicker active={active} />
    </>
  );
}

export default function IdeaSculpture() {
  const { resolvedTheme } = useTheme();
  const figureRef = useRef<HTMLElement>(null);
  const [fallbackReason, setFallbackReason] = useState<StaticReason | null>(
    staticReason,
  );
  const [intersecting, setIntersecting] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const handleMotionChange = () => setFallbackReason(staticReason());
    media?.addEventListener?.("change", handleMotionChange);
    return () => media?.removeEventListener?.("change", handleMotionChange);
  }, []);

  useEffect(() => {
    const element = figureRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setIntersecting(entry.isIntersecting),
      { rootMargin: "80px", threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibility = () =>
      setPageVisible(document.visibilityState !== "hidden");
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const active = !fallbackReason && !paused && intersecting && pageVisible;

  return (
    <figure
      aria-label="Woven paths from signal to idea"
      className={styles.sculptureFigure}
      data-motion={fallbackReason ? "static" : active ? "playing" : "paused"}
      ref={figureRef}
    >
      <div className={styles.sculptureCanvas}>
        {fallbackReason ? (
          <IdeaSculptureFallback reason={fallbackReason} />
        ) : (
          <SculptureErrorBoundary
            fallback={<IdeaSculptureFallback reason="webgl-error" />}
          >
            <Canvas
              aria-hidden="true"
              camera={{ fov: 37, position: [0, 0.05, 7.8] }}
              dpr={[1, 1.5]}
              frameloop="demand"
              gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
            >
              <SculptureScene active={active} dark={resolvedTheme === "dark"} />
            </Canvas>
          </SculptureErrorBoundary>
        )}
      </div>
      <ul aria-label="Idea threads" className={styles.sculptureLabels}>
        <li data-tone="cobalt">
          <Circle aria-hidden="true" size={8} weight="fill" /> Process stories
        </li>
        <li data-tone="warning">
          <Circle aria-hidden="true" size={8} weight="fill" /> Imperfection as trust
        </li>
        <li data-tone="coral">
          <Circle aria-hidden="true" size={8} weight="fill" /> Creative courage
        </li>
      </ul>
      <figcaption className={styles.sculptureCaption}>
        A woven creative path connects process, imperfection, and courage.
      </figcaption>
      {fallbackReason ? (
        <span className={styles.staticReason}>
          Still sculpture · {fallbackReason.replaceAll("-", " ")}
        </span>
      ) : (
        <button
          aria-label={paused ? "Resume idea sculpture" : "Pause idea sculpture"}
          className={styles.sculptureControl}
          onClick={() => setPaused((value) => !value)}
          type="button"
        >
          {paused ? <Play aria-hidden="true" size={18} weight="fill" /> : <Pause aria-hidden="true" size={18} weight="fill" />}
          {paused ? "Resume ideas" : "Pause ideas"}
        </button>
      )}
    </figure>
  );
}
