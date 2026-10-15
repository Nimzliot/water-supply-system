import { Component, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MIN_FLOW_LPM } from "../../lib/useController";

// The whole network in 3D: borewell, pump, overhead tank, main valve and both houses, joined by
// pipes. Everything moves only on what the controller reports: the tank level is the measured
// level, the pump impeller spins while the pump relay is on, valve wheels turn with their relays,
// and water travels along a pipe only while a flow meter (or the running pump) says it flows.

const TANK = { x: -1, z: -1, radius: 1.2, height: 2.4, base: 2.2 };
const PIPE_RADIUS = 0.09;
const WATER = "#38bdf8";

const v = (x, y, z) => new THREE.Vector3(x, y, z);

function buildPath(points) {
  const path = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i++) path.add(new THREE.LineCurve3(v(...points[i]), v(...points[i + 1])));
  return path;
}

// The look of moving water: deep blue with lighter streaks, drawn once and tiled along each pipe.
let waterCanvas = null;
function waterTexture() {
  if (!waterCanvas) {
    waterCanvas = document.createElement("canvas");
    waterCanvas.width = 256;
    waterCanvas.height = 64;
    const paint = waterCanvas.getContext("2d");
    const body = paint.createLinearGradient(0, 0, 0, 64);
    body.addColorStop(0, "#0369a1");
    body.addColorStop(0.5, "#38bdf8");
    body.addColorStop(1, "#0369a1");
    paint.fillStyle = body;
    paint.fillRect(0, 0, 256, 64);
    // Streaks of light on the water. Each is drawn three times so the tile wraps without a seam.
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 18; i++) {
      const x = random() * 256;
      const y = random() * 64;
      const width = 12 + random() * 46;
      const height = 2 + random() * 7;
      paint.fillStyle = `rgba(224, 242, 254, ${0.3 + random() * 0.5})`;
      for (const shift of [-256, 0, 256]) {
        paint.beginPath();
        paint.ellipse(x + shift, y, width / 2, height / 2, 0, 0, Math.PI * 2);
        paint.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(waterCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Texture tiles per scene unit of pipe length.
const WATER_TILES_PER_UNIT = 1.3;

// A clear pipe with a continuous stream of water inside it. The water fades in as the pipe fills
// when flow starts, runs along the pipe at a speed set by the measured flow, and drains away when
// flow stops. speed is in scene units per second.
function Pipe({ points, flowing, speed = 1.6 }) {
  const path = useMemo(() => buildPath(points), [points]);
  const length = path.getLength();
  const segments = Math.max(32, Math.round(length * 16));
  const texture = useMemo(() => {
    const map = waterTexture();
    map.repeat.set(length * WATER_TILES_PER_UNIT, 1);
    return map;
  }, [length]);
  const water = useRef();
  const fill = useRef(flowing ? 1 : 0);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1);
    fill.current += ((flowing ? 1 : 0) - fill.current) * Math.min(1, step * 3);
    if (water.current) {
      water.current.visible = fill.current > 0.02;
      water.current.material.opacity = 0.95 * fill.current;
    }
    if (flowing) texture.offset.x -= step * speed * WATER_TILES_PER_UNIT;
  });

  return (
    <group>
      {/* The water itself. */}
      <mesh ref={water}>
        <tubeGeometry args={[path, segments, PIPE_RADIUS * 0.74, 14, false]} />
        <meshStandardMaterial map={texture} transparent opacity={0} emissive="#0284c7" emissiveIntensity={0.35} roughness={0.15} metalness={0.05} depthWrite={false} />
      </mesh>
      {/* The clear pipe around it. */}
      <mesh castShadow>
        <tubeGeometry args={[path, segments, PIPE_RADIUS, 16, false]} />
        <meshPhysicalMaterial color={flowing ? "#e0f2fe" : "#cbd5e1"} transparent opacity={0.3} roughness={0.05} metalness={0.1} depthWrite={false} />
      </mesh>
      {/* Bends: clear elbow fittings, so the water shows through the corners too. */}
      {points.slice(1, -1).map((point) => (
        <mesh key={point.join(",")} position={point}>
          <sphereGeometry args={[PIPE_RADIUS * 1.28, 18, 18]} />
          <meshPhysicalMaterial color="#94a3b8" transparent opacity={0.45} roughness={0.2} metalness={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Label({ position, title, value, tone = "slate" }) {
  const tones = { green: "#059669", red: "#dc2626", blue: "#0284c7", slate: "#475569", amber: "#d97706" };
  return (
    <Html position={position} center distanceFactor={11} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div style={{ background: "rgba(255,255,255,0.94)", borderRadius: 12, padding: "6px 10px", boxShadow: "0 4px 14px rgba(15,23,42,0.14)", whiteSpace: "nowrap", fontFamily: "inherit", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{title}</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: tones[tone] }}>{value}</div>
      </div>
    </Html>
  );
}

function Tank({ percent, filling, fault, online }) {
  const water = useRef();
  const surface = useRef();
  const stream = useRef();
  const sensor = useRef();
  const shown = useRef(percent);
  const inner = TANK.height - 0.08;
  // The stream falling from the inlet: the same water streaks, turned to run down the stream.
  const falling = useMemo(() => {
    const map = waterTexture();
    map.center.set(0.5, 0.5);
    map.rotation = Math.PI / 2;
    map.repeat.set(2, 1);
    return map;
  }, []);
  useEffect(() => () => falling.dispose(), [falling]);

  useFrame((state, delta) => {
    // Ease toward the measured level so a new reading slides rather than jumps.
    shown.current += (percent - shown.current) * Math.min(1, delta * 1.8);
    const height = Math.max(0.03, (Math.min(Math.max(shown.current, 0), 100) / 100) * inner);
    if (water.current) {
      water.current.scale.y = height;
      water.current.position.y = TANK.base + 0.04 + height / 2;
    }
    if (surface.current) {
      const wobble = filling ? Math.sin(state.clock.elapsedTime * 6) * 0.015 : 0;
      surface.current.position.y = TANK.base + 0.04 + height + wobble;
      surface.current.rotation.z += filling ? delta * 1.2 : 0;
    }
    if (stream.current) {
      const top = TANK.base + TANK.height - 0.05;
      const bottom = TANK.base + 0.04 + height;
      stream.current.visible = filling;
      if (filling) falling.offset.x -= Math.min(delta, 0.1) * 3;
      stream.current.scale.y = Math.max(0.01, top - bottom);
      stream.current.position.y = (top + bottom) / 2;
    }
    if (sensor.current) {
      sensor.current.emissiveIntensity = fault ? 0.6 + Math.sin(state.clock.elapsedTime * 8) * 0.5 : 0.15;
    }
  });

  const legs = [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]];
  return (
    <group position={[TANK.x, 0, TANK.z]}>
      {legs.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, TANK.base / 2, z]} castShadow>
          <boxGeometry args={[0.14, TANK.base, 0.14]} />
          <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, TANK.base - 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.1, 0.1, 2.1]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {/* Glass shell so the water inside shows. */}
      <mesh position={[0, TANK.base + TANK.height / 2, 0]}>
        <cylinderGeometry args={[TANK.radius, TANK.radius, TANK.height, 48, 1, true]} />
        <meshPhysicalMaterial color="#e2e8f0" transparent opacity={0.28} roughness={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, TANK.base + TANK.height, 0]}>
        <cylinderGeometry args={[TANK.radius + 0.04, TANK.radius + 0.04, 0.08, 48]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.3} />
      </mesh>
      <mesh position={[0, TANK.base, 0]}>
        <cylinderGeometry args={[TANK.radius, TANK.radius, 0.08, 48]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      {online ? (
        <>
          <mesh ref={water}>
            <cylinderGeometry args={[TANK.radius - 0.05, TANK.radius - 0.05, 1, 48]} />
            <meshPhysicalMaterial color={WATER} transparent opacity={0.78} roughness={0.1} transmission={0.2} />
          </mesh>
          <mesh ref={surface} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.2, TANK.radius - 0.06, 48, 3]} />
            <meshStandardMaterial color="#7dd3fc" transparent opacity={0.65} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={stream} position={[-0.3, 0, 0]}>
            <cylinderGeometry args={[0.055, 0.08, 1, 16]} />
            <meshStandardMaterial map={falling} transparent opacity={0.9} emissive="#0284c7" emissiveIntensity={0.35} />
          </mesh>
        </>
      ) : null}
      {/* Ultrasonic level sensor on the lid; it blinks red while it cannot read the level. */}
      <mesh position={[0.4, TANK.base + TANK.height + 0.12, 0]}>
        <boxGeometry args={[0.36, 0.14, 0.2]} />
        <meshStandardMaterial ref={sensor} color={fault ? "#ef4444" : "#1e293b"} emissive={fault ? "#ef4444" : "#0ea5e9"} />
      </mesh>
    </group>
  );
}

function Pump({ position, running, online }) {
  const impeller = useRef();
  const light = useRef();
  useFrame((state, delta) => {
    if (impeller.current && running) impeller.current.rotation.x += delta * 14;
    if (light.current) light.current.emissiveIntensity = running ? 0.8 + Math.sin(state.clock.elapsedTime * 5) * 0.3 : 0.05;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.3, 0.24, 0.9]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[-0.15, 0.55, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.8, 32]} />
        <meshStandardMaterial color={running ? "#e23744" : "#94a3b8"} metalness={0.4} roughness={0.35} />
      </mesh>
      {/* Pump housing with the impeller visible through its face. */}
      <group position={[0.45, 0.55, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.22, 32]} />
          <meshStandardMaterial color="#475569" metalness={0.5} />
        </mesh>
        <group ref={impeller} position={[0.13, 0, 0]}>
          {[0, 1, 2, 3, 4, 5].map((blade) => (
            <mesh key={blade} rotation={[(blade * Math.PI) / 3, 0, 0]} position={[0, 0, 0]}>
              <boxGeometry args={[0.03, 0.56, 0.09]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.6} />
            </mesh>
          ))}
        </group>
      </group>
      <mesh position={[-0.15, 0.95, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial ref={light} color={running ? "#22c55e" : "#64748b"} emissive="#22c55e" />
      </mesh>
      <Label position={[0, 1.5, 0]} title="Pump" value={!online ? "Offline" : running ? "Running" : "Stopped"} tone={!online ? "slate" : running ? "green" : "slate"} />
    </group>
  );
}

function Borewell({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.36, 0.3, 32]} />
        <meshStandardMaterial color="#78716c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.27, 32]} />
        <meshStandardMaterial color="#0c4a6e" />
      </mesh>
      <Label position={[0, 0.95, 0]} title="Borewell" value="Source" />
    </group>
  );
}

// A gate valve: the hand wheel turns a quarter turn and changes colour with the real relay.
function Valve({ position, rotationY = 0, open, online, title }) {
  const wheel = useRef();
  const target = open ? Math.PI / 2 : 0;
  useFrame((_, delta) => {
    if (wheel.current) wheel.current.rotation.y += (target - wheel.current.rotation.y) * Math.min(1, delta * 4);
  });
  const color = !online ? "#94a3b8" : open ? "#10b981" : "#ef4444";
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.42, 24]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 12]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <group ref={wheel} position={[0, 0.5, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.035, 12, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.4, 0.03, 0.04]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
      <Label position={[0, 1.05, 0]} title={title} value={!online ? "Unknown" : open ? "Open" : "Closed"} tone={!online ? "slate" : open ? "green" : "red"} />
    </group>
  );
}

function House({ position, label, receiving, litersToday, limitReached, online }) {
  const windowGlow = useRef();
  useFrame((state) => {
    if (windowGlow.current) windowGlow.current.emissiveIntensity = receiving ? 0.6 + Math.sin(state.clock.elapsedTime * 3) * 0.25 : 0.05;
  });
  const value = !online ? "Offline" : limitReached ? "Limit reached" : receiving ? "Receiving water" : `${(litersToday ?? 0).toFixed(1)} L today`;
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 1.2, 1.3]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 1.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.18, 0.75, 4]} />
        <meshStandardMaterial color="#e23744" roughness={0.7} />
      </mesh>
      <mesh position={[-0.76, 0.42, 0]}>
        <boxGeometry args={[0.02, 0.62, 0.36]} />
        <meshStandardMaterial color="#7c2d12" />
      </mesh>
      <mesh position={[-0.76, 0.75, 0.42]}>
        <boxGeometry args={[0.02, 0.3, 0.3]} />
        <meshStandardMaterial ref={windowGlow} color="#bae6fd" emissive={WATER} />
      </mesh>
      <Label position={[0, 2.35, 0]} title={label} value={value} tone={!online ? "slate" : limitReached ? "amber" : receiving ? "blue" : "slate"} />
    </group>
  );
}

// Pipe routes, in scene units. Water runs from the first point to the last.
const ROUTES = {
  suction: [[-7, -0.6, 1.2], [-7, 0.45, 1.2], [-5.25, 0.45, 1.2]],
  delivery: [[-3.9, 0.55, 1.2], [-2.6, 0.55, 1.2], [-2.6, 5.05, 1.2], [-2.6, 5.05, -1], [-1.3, 5.05, -1], [-1.3, 4.55, -1]],
  outlet: [[-1, 2.15, -1], [-1, 0.4, -1], [1.95, 0.4, -1]],
  main: [[2.45, 0.4, -1], [4, 0.4, -1]],
  branch1: [[4, 0.4, -1], [4, 0.4, -3.6], [5.15, 0.4, -3.6]],
  branch2: [[4, 0.4, -1], [4, 0.4, 1.9], [5.15, 0.4, 1.9]],
  house1: [[5.6, 0.4, -3.6], [6.5, 0.4, -3.6]],
  house2: [[5.6, 0.4, 1.9], [6.5, 0.4, 1.9]]
};

// Pulls the camera back on narrow (phone) screens so the whole plant fits.
function FitCamera() {
  const { camera, size } = useThree();
  const aspect = size.width / Math.max(size.height, 1);
  useEffect(() => {
    const distance = aspect < 0.8 ? 2.5 : aspect < 1.2 ? 1.6 : 1;
    camera.position.set(9 * distance, 8 * distance, 12 * distance);
    camera.updateProjectionMatrix();
  }, [camera, aspect]);
  return null;
}

const speedFor = (lpm) => 0.9 + Math.min(Number(lpm) || 0, 25) * 0.12;

function Scene({ live }) {
  const { online, meta, flows, houses, tankPercent, pumpRunning } = live;
  const running = online && pumpRunning;
  const house1Flow = online && flows.house1 > MIN_FLOW_LPM;
  const house2Flow = online && flows.house2 > MIN_FLOW_LPM;
  const mainFlow = online && (flows.main > MIN_FLOW_LPM || house1Flow || house2Flow);
  const mainSpeed = speedFor(Math.max(flows.main, flows.house1 + flows.house2));

  return (
    <>
      <hemisphereLight args={["#ffffff", "#cbd5e1", 0.9]} />
      <directionalLight position={[6, 12, 6]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial color="#ecfdf5" />
      </mesh>
      <gridHelper args={[28, 28, "#d1fae5", "#d1fae5"]} position={[0, 0.005, 0]} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={26} blur={2.2} far={6} />

      <Borewell position={[-7, 0, 1.2]} />
      <Pump position={[-4.6, 0, 1.2]} running={running} online={online} />
      <Tank percent={online ? tankPercent : 0} filling={running} fault={Boolean(meta?.sensor_fault)} online={online} />
      <Label
        position={[TANK.x, TANK.base + TANK.height + 0.75, TANK.z]}
        title="Overhead tank"
        value={!online ? "Offline" : meta?.sensor_fault ? "Sensor fault" : `${Math.round(tankPercent)}%`}
        tone={!online ? "slate" : meta?.sensor_fault ? "red" : "blue"}
      />
      <Valve position={[2.2, 0.4, -1]} open={Boolean(meta?.main_valve_open)} online={online} title="Main valve" />
      <Valve position={[5.38, 0.4, -3.6]} open={Boolean(meta?.house1_valve_open)} online={online} title="House 1 valve" />
      <Valve position={[5.38, 0.4, 1.9]} open={Boolean(meta?.house2_valve_open)} online={online} title="House 2 valve" />
      <House position={[7.4, 0, -3.6]} label={houses[0]?.label || "House 1"} receiving={house1Flow} litersToday={houses[0]?.litersToday} limitReached={houses[0]?.limitReached} online={online && houses[0]?.online} />
      <House position={[7.4, 0, 1.9]} label={houses[1]?.label || "House 2"} receiving={house2Flow} litersToday={houses[1]?.litersToday} limitReached={houses[1]?.limitReached} online={online && houses[1]?.online} />

      <Pipe points={ROUTES.suction} flowing={running} speed={2.2} />
      <Pipe points={ROUTES.delivery} flowing={running} speed={2.2} />
      <Pipe points={ROUTES.outlet} flowing={mainFlow} speed={mainSpeed} />
      <Pipe points={ROUTES.main} flowing={mainFlow} speed={mainSpeed} />
      <Pipe points={ROUTES.branch1} flowing={house1Flow} speed={speedFor(flows.house1)} />
      <Pipe points={ROUTES.branch2} flowing={house2Flow} speed={speedFor(flows.house2)} />
      <Pipe points={ROUTES.house1} flowing={house1Flow} speed={speedFor(flows.house1)} />
      <Pipe points={ROUTES.house2} flowing={house2Flow} speed={speedFor(flows.house2)} />

      <FitCamera />
      <OrbitControls makeDefault enableDamping target={[0.4, 1.5, -0.6]} minDistance={6} maxDistance={45} maxPolarAngle={Math.PI / 2.1} />
    </>
  );
}

class WebGlBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">This browser could not start 3D graphics (WebGL). Try another browser or turn on hardware acceleration.</div>;
    }
    return this.props.children;
  }
}

export default function Plant3D({ live }) {
  return (
    <WebGlBoundary>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [9, 8, 12], fov: 40 }} gl={{ antialias: true }}>
        <color attach="background" args={["#f0f9ff"]} />
        <fog attach="fog" args={["#f0f9ff", 45, 90]} />
        <Scene live={live} />
      </Canvas>
    </WebGlBoundary>
  );
}
