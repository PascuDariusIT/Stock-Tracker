import { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  isPositive?: boolean;
}

export function Sparkline({
  data,
  width = 96,
  height = 30,
  strokeWidth = 2,
  isPositive,
}: SparklineProps) {
  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (data.length === 1) return [{ x: 0, y: height / 2 }, { x: width, y: height / 2 }];

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 3;
    const usableHeight = height - padding * 2;

    const stepX = width / (data.length - 1);

    return data.map((val, idx) => {
      const x = +(idx * stepX).toFixed(1);
      // Invert Y so higher values are higher up in SVG
      const y = +(height - padding - ((val - min) / range) * usableHeight).toFixed(1);
      return { x, y };
    });
  }, [data, width, height]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    return `${pathD} L ${lastX} ${height} L ${firstX} ${height} Z`;
  }, [points, pathD, height]);

  const positive = isPositive !== undefined ? isPositive : (data.length > 1 ? data[data.length - 1] >= data[0] : true);
  const strokeColor = positive ? '#22c55e' : '#ef4444';
  const gradientId = useMemo(() => `spark-${Math.random().toString(36).substr(2, 9)}`, []);

  const lastPoint = points.length > 0 ? points[points.length - 1] : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {areaD && <path d={areaD} fill={`url(#${gradientId})`} />}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={2.5}
          fill={strokeColor}
          filter="drop-shadow(0 0 3px rgba(34, 197, 94, 0.8))"
        />
      )}
    </svg>
  );
}

export default Sparkline;
