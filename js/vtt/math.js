// Line-line intersection for Raycasting
export function getIntersection(ray, segment) {
    const r_px = ray.a.x;
    const r_py = ray.a.y;
    const r_dx = ray.b.x - ray.a.x;
    const r_dy = ray.b.y - ray.a.y;

    const s_px = segment.a.x;
    const s_py = segment.a.y;
    const s_dx = segment.b.x - segment.a.x;
    const s_dy = segment.b.y - segment.a.y;

    const r_mag = Math.sqrt(r_dx * r_dx + r_dy * r_dy);
    if (r_mag === 0) return null;

    const T2 = r_dx * s_dy - r_dy * s_dx;
    if (T2 === 0) return null; // Parallel

    const T1 = (s_px - r_px) * s_dy - (s_py - r_py) * s_dx;
    const t = T1 / T2;
    const u = ((s_px - r_px) * r_dy - (s_py - r_py) * r_dx) / T2;

    if (t > 0 && u >= 0 && u <= 1) {
        return {
            x: r_px + r_dx * t,
            y: r_py + r_dy * t,
            param: t
        };
    }

    return null;
}

// Distance from point to line segment for Collisions
export function pointToSegmentDistance(p, a, b) {
    const l2 = distSq(a, b);
    if (l2 === 0) return dist(p, a);

    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));

    const proj = {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y)
    };

    return dist(p, proj);
}

export function distSq(v, w) {
    return (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
}

export function dist(v, w) {
    return Math.sqrt(distSq(v, w));
}
