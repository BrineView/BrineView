interface BubbleSpec {
  left: number;
  size: number;
  duration: number;
  delay: number;
}

const BUBBLES: BubbleSpec[] = [
  { left: 5, size: 14, duration: 14, delay: 0 },
  { left: 12, size: 8, duration: 18, delay: 3 },
  { left: 22, size: 20, duration: 12, delay: 5 },
  { left: 30, size: 10, duration: 16, delay: 1 },
  { left: 40, size: 16, duration: 13, delay: 7 },
  { left: 48, size: 9, duration: 20, delay: 2 },
  { left: 58, size: 22, duration: 11, delay: 9 },
  { left: 66, size: 12, duration: 17, delay: 4 },
  { left: 74, size: 8, duration: 19, delay: 6 },
  { left: 82, size: 18, duration: 12, delay: 8 },
  { left: 90, size: 11, duration: 15, delay: 10 },
  { left: 96, size: 15, duration: 16, delay: 2 },
];

export default function OceanBackground() {
  return (
    <>
      {/* Animated wave layers */}
      <div className="wave-layer wave-layer-1" />
      <div className="wave-layer wave-layer-2" />
      <div className="wave-layer wave-layer-3" />

      {/* Shimmer overlay */}
      <div className="shimmer-overlay" />

      {/* Rising bubbles */}
      {BUBBLES.map((b, i) => (
        <div
          key={i}
          className="bubble"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </>
  );
}