import type { Hazard } from '@simulacro/contracts';

export function HazardOverlay({ image, width, height, hazards }: {
  image: string; width: number; height: number; hazards: Hazard[];
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden="true"
      className="overlay"
    >
      <image href={image} x={0} y={0} width={width} height={height} />
      {hazards.map((hazard, index) => {
        const open = hazard.status === 'open';
        const color = open ? '#c0392b' : '#1e7e34';
        const dash = open ? '10 6' : undefined;
        return (
          <g key={hazard.id} transform={`translate(${hazard.box.x1} ${hazard.box.y1})`}>
            {/* maskPath is in box-local coordinates (see ARCHITECTURE.md) */}
            {hazard.maskPath ? (
              <path d={hazard.maskPath} fill={color} fillOpacity={0.35} stroke={color} strokeWidth={4} strokeDasharray={dash} />
            ) : (
              <rect
                x={0} y={0}
                width={hazard.box.x2 - hazard.box.x1}
                height={hazard.box.y2 - hazard.box.y1}
                fill="none" stroke={color} strokeWidth={4} strokeDasharray={dash}
              />
            )}
            <circle cx={18} cy={18} r={16} fill={color} />
            <text x={18} y={24} textAnchor="middle" fontSize={20} fontWeight="bold" fill="#ffffff">
              {index + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
