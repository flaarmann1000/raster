import { Vec2 } from '../types'

export const v = {
  add: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s }),
  div: (a: Vec2, s: number): Vec2 => ({ x: a.x / s, y: a.y / s }),
  len: (a: Vec2): number => Math.sqrt(a.x * a.x + a.y * a.y),
  lenSq: (a: Vec2): number => a.x * a.x + a.y * a.y,
  norm: (a: Vec2): Vec2 => { const l = v.len(a); return l < 1e-10 ? { x: 0, y: 0 } : v.div(a, l) },
  perp: (a: Vec2): Vec2 => ({ x: -a.y, y: a.x }),  // 90° CCW
  dot: (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y,
  lerp: (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
  dist: (a: Vec2, b: Vec2): number => v.len(v.sub(a, b)),
  distSq: (a: Vec2, b: Vec2): number => v.lenSq(v.sub(a, b)),
  rotate: (a: Vec2, angle: number): Vec2 => ({
    x: a.x * Math.cos(angle) - a.y * Math.sin(angle),
    y: a.x * Math.sin(angle) + a.y * Math.cos(angle),
  }),
  clone: (a: Vec2): Vec2 => ({ x: a.x, y: a.y }),
  eq: (a: Vec2, b: Vec2, eps = 1e-6): boolean => Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps,
}
