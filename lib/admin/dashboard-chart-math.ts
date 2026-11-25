export function chartMaximum(values: number[]) {
  const maximum = Math.max(0, ...values);
  if (maximum <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(maximum / 4));
  const fraction = maximum / 4 / magnitude;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * magnitude * 4;
}

export function donutWedgePath(start: number, end: number) {
  const finish = Math.min(end, start + Math.PI * 2 - 0.000001);
  const point = (angle: number, x: number, y: number) =>
    `${160 + Math.cos(angle) * x},${104 + Math.sin(angle) * y}`;
  const largeArc = finish - start > Math.PI ? 1 : 0;
  return `M${point(start, 126, 80)} A126,80 0 ${largeArc} 1 ${point(finish, 126, 80)}
    L${point(finish, 76, 48)} A76,48 0 ${largeArc} 0 ${point(start, 76, 48)} Z`;
}

type ChartPoint = { x: number; y: number };

/**
 * A smooth SVG path through points with increasing x, using monotone cubic tangents
 * (Fritsch–Carlson): the curve never overshoots between two values, so a count never appears to
 * dip below zero or rise above its peak.
 */
export function smoothLinePath(points: ChartPoint[]) {
  if (!points.length) return '';
  const [first] = points;
  if (points.length === 1) return `M${first.x} ${first.y}`;
  const slopes = points.slice(1).map((point, index) => {
    const previous = points[index];
    return (point.y - previous.y) / (point.x - previous.x || 1);
  });
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes[index - 1];
    const [before, after] = [slopes[index - 1], slopes[index]];
    return before * after <= 0 ? 0 : (before + after) / 2;
  });
  slopes.forEach((slope, index) => {
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      return;
    }
    const a = tangents[index] / slope;
    const b = tangents[index + 1] / slope;
    const length = Math.hypot(a, b);
    if (length > 3) {
      tangents[index] = (3 / length) * a * slope;
      tangents[index + 1] = (3 / length) * b * slope;
    }
  });
  const round = (value: number) => Math.round(value * 100) / 100;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M${round(point.x)} ${round(point.y)}`;
    const previous = points[index - 1];
    const third = (point.x - previous.x) / 3;
    return `${path} C${round(previous.x + third)} ${round(previous.y + tangents[index - 1] * third)} ${round(point.x - third)} ${round(point.y - tangents[index] * third)} ${round(point.x)} ${round(point.y)}`;
  }, '');
}
