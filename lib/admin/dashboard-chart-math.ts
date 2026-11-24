export function chartMaximum(values: number[]) {
  const maximum = Math.max(0, ...values);
  if (maximum <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(maximum / 4));
  const fraction = maximum / 4 / magnitude;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * magnitude * 4;
}

/** Flat circular ring wedge (ZENTRA charts), centred in a 200 × 200 view box. */
export function ringWedgePath(start: number, end: number) {
  const finish = Math.min(end, start + Math.PI * 2 - 0.000001);
  const point = (angle: number, radius: number) =>
    `${100 + Math.cos(angle) * radius},${100 + Math.sin(angle) * radius}`;
  const largeArc = finish - start > Math.PI ? 1 : 0;
  return `M${point(start, 92)} A92,92 0 ${largeArc} 1 ${point(finish, 92)}
    L${point(finish, 62)} A62,62 0 ${largeArc} 0 ${point(start, 62)} Z`;
}

export function donutWedgePath(start: number, end: number) {
  const finish = Math.min(end, start + Math.PI * 2 - 0.000001);
  const point = (angle: number, x: number, y: number) =>
    `${160 + Math.cos(angle) * x},${104 + Math.sin(angle) * y}`;
  const largeArc = finish - start > Math.PI ? 1 : 0;
  return `M${point(start, 126, 80)} A126,80 0 ${largeArc} 1 ${point(finish, 126, 80)}
    L${point(finish, 76, 48)} A76,48 0 ${largeArc} 0 ${point(start, 76, 48)} Z`;
}
