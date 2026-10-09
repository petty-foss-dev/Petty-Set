import {
  id,
  resolveSceneLayers,
  wallBetween,
  wallEndpoints,
  wallOpenings,
} from "./model.ts";
import type { FloorFinish, RoomFinish, SceneItem, SetScene } from "./model.ts";

export type PlanPoint = { x: number; z: number };
export type PlanRoom = { points: PlanPoint[]; area: number; center: PlanPoint };

function containsPoint(points: PlanPoint[], point: PlanPoint): boolean {
  let inside = false;
  for (
    let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index++
  ) {
    const a = points[index];
    const b = points[previous];
    if (
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
}

function roomCoverage(room: PlanPoint[], footprint: PlanPoint[]): number {
  const xs = room.map((point) => point.x);
  const zs = room.map((point) => point.z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const width = Math.max(...xs) - minX;
  const depth = Math.max(...zs) - minZ;
  let inside = 0;
  let covered = 0;
  for (let row = 0; row < 24; row++) {
    for (let column = 0; column < 24; column++) {
      const point = {
        x: minX + ((column + 0.5) / 24) * width,
        z: minZ + ((row + 0.5) / 24) * depth,
      };
      if (!containsPoint(room, point)) continue;
      inside++;
      if (containsPoint(footprint, point)) covered++;
    }
  }
  return inside ? covered / inside : 0;
}

export function roomFinishFor(
  room: PlanRoom,
  assignments: RoomFinish[] = [],
): FloorFinish {
  let finish: FloorFinish = "timber";
  let best = 0.35;
  for (const assignment of assignments) {
    const coverage = roomCoverage(room.points, assignment.points);
    if (coverage < best) continue;
    best = coverage;
    finish = assignment.finish;
  }
  return finish;
}

export function setRoomFinish(
  assignments: RoomFinish[] = [],
  room: PlanRoom,
  finish: FloorFinish,
): RoomFinish[] {
  return [
    ...assignments.filter(
      (assignment) =>
        roomCoverage(room.points, assignment.points) < 0.95 ||
        roomCoverage(assignment.points, room.points) < 0.95,
    ),
    { finish, points: room.points.map((point) => ({ ...point })) },
  ];
}

const key = (point: PlanPoint) => {
  const coordinate = (value: number) => {
    const rounded = Math.round(value * 1000) / 1000;
    return rounded === 0 ? "0" : String(rounded);
  };
  return `${coordinate(point.x)},${coordinate(point.z)}`;
};
const near = (a: PlanPoint, b: PlanPoint) =>
  Math.hypot(a.x - b.x, a.z - b.z) < 0.01;

export function rectangularRoom(
  items: SceneItem[],
  start: PlanPoint,
  end: PlanPoint,
): SceneItem[] {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.z, end.z);
  const bottom = Math.max(start.z, end.z);
  if (right - left < 0.5 || bottom - top < 0.5) return items;
  const corners = [
    { x: left, z: top },
    { x: right, z: top },
    { x: right, z: bottom },
    { x: left, z: bottom },
  ];
  return polygonRoom(items, corners);
}

export function polygonRoom(
  items: SceneItem[],
  points: PlanPoint[],
): SceneItem[] {
  if (points.length < 3) return items;
  for (let index = 0; index < points.length; index++) {
    const next = (index + 1) % points.length;
    if (
      Math.hypot(
        points[next].x - points[index].x,
        points[next].z - points[index].z,
      ) < 0.25
    )
      return items;
    for (let other = index + 2; other < points.length; other++) {
      const otherNext = (other + 1) % points.length;
      if (otherNext === index) continue;
      if (
        intersection(
          points[index],
          points[next],
          points[other],
          points[otherNext],
        )
      )
        return items;
    }
  }
  const area =
    Math.abs(
      points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point.x * next.z - next.x * point.z;
      }, 0),
    ) / 2;
  if (area < 0.25) return items;
  return points.reduce((result, point, index) => {
    const next = points[(index + 1) % points.length];
    const wall = wallBetween(
      point,
      next,
      result.filter((item) => item.kind === "wall").length + 1,
    );
    return insertPlanWall(result, {
      ...wall,
      name: `Room wall ${result.length + 1}`,
    });
  }, items);
}

export function moveSharedCorner(
  items: SceneItem[],
  from: PlanPoint,
  to: PlanPoint,
): SceneItem[] {
  return items.map((item) => {
    if (item.kind !== "wall" || item.locked) return item;
    const [start, end] = wallEndpoints(item);
    const movedStart = near(start, from);
    const movedEnd = near(end, from);
    if (!movedStart && !movedEnd) return item;
    const a = movedStart ? to : start;
    const b = movedEnd ? to : end;
    if (Math.hypot(a.x - b.x, a.z - b.z) < 0.25) return item;
    const geometry = wallBetween(a, b, 1);
    return {
      ...item,
      x: geometry.x,
      z: geometry.z,
      width: geometry.width,
      rotation: geometry.rotation,
    };
  });
}

export function canSplitWall(wall: SceneItem): boolean {
  if (
    wall.kind !== "wall" ||
    wall.locked ||
    wall.width < 1 ||
    wall.roomExtended
  )
    return false;
  return wallOpenings(wall).every(
    (opening) => Math.abs(opening.offset) - opening.width / 2 >= 0.08,
  );
}

export function splitWall(items: SceneItem[], wallId: string): SceneItem[] {
  const wall = items.find((item) => item.id === wallId);
  if (!wall || !canSplitWall(wall)) return items;
  const [start, end] = wallEndpoints(wall);
  const middle = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
  return items.flatMap((item) =>
    item.id === wallId ? splitAt(item, middle) : [item],
  );
}

function intersection(
  a: PlanPoint,
  b: PlanPoint,
  c: PlanPoint,
  d: PlanPoint,
): PlanPoint | null {
  const ab = { x: b.x - a.x, z: b.z - a.z };
  const cd = { x: d.x - c.x, z: d.z - c.z };
  const denominator = ab.x * cd.z - ab.z * cd.x;
  if (Math.abs(denominator) < 1e-8) return null;
  const ac = { x: c.x - a.x, z: c.z - a.z };
  const t = (ac.x * cd.z - ac.z * cd.x) / denominator;
  const u = (ac.x * ab.z - ac.z * ab.x) / denominator;
  if (t < -1e-7 || t > 1 + 1e-7 || u < -1e-7 || u > 1 + 1e-7) return null;
  return { x: a.x + t * ab.x, z: a.z + t * ab.z };
}

function splitAt(wall: SceneItem, point: PlanPoint): SceneItem[] {
  const [start, end] = wallEndpoints(wall);
  const leftLength = Math.hypot(point.x - start.x, point.z - start.z);
  const rightLength = Math.hypot(end.x - point.x, end.z - point.z);
  if (leftLength < 0.25 || rightLength < 0.25) return [wall];
  const openings = wallOpenings(wall);
  if (
    openings.some(
      (opening) =>
        Math.abs(wall.width / 2 + opening.offset - leftLength) <
        opening.width / 2 + 0.08,
    )
  )
    return [wall];
  const first = wallBetween(start, point, 1);
  const second = wallBetween(point, end, 1);
  const leftOpenings = openings
    .filter((opening) => wall.width / 2 + opening.offset < leftLength)
    .map((opening) => ({
      ...opening,
      offset: wall.width / 2 + opening.offset - leftLength / 2,
    }));
  const rightOpenings = openings
    .filter((opening) => wall.width / 2 + opening.offset > leftLength)
    .map((opening) => ({
      ...opening,
      offset: wall.width / 2 + opening.offset - leftLength - rightLength / 2,
    }));
  return [
    {
      ...wall,
      x: first.x,
      z: first.z,
      width: first.width,
      rotation: first.rotation,
      opening: leftOpenings[0],
      additionalOpenings:
        leftOpenings.length > 1 ? leftOpenings.slice(1) : undefined,
    },
    {
      ...wall,
      id: id(),
      name: `${wall.name} · segment 2`,
      x: second.x,
      z: second.z,
      width: second.width,
      rotation: second.rotation,
      opening: rightOpenings[0],
      additionalOpenings:
        rightOpenings.length > 1 ? rightOpenings.slice(1) : undefined,
    },
  ];
}

export function insertPlanWall(
  items: SceneItem[],
  wall: SceneItem,
): SceneItem[] {
  const [start, end] = wallEndpoints(wall);
  if (
    items.some((item) => {
      if (item.kind !== "wall") return false;
      const [a, b] = wallEndpoints(item);
      return (
        (near(a, start) && near(b, end)) || (near(a, end) && near(b, start))
      );
    })
  )
    return items;
  const crossing = items
    .filter((item) => item.kind === "wall")
    .flatMap((item) => {
      const [a, b] = wallEndpoints(item);
      const point = intersection(start, end, a, b);
      return point ? [{ wallId: item.id, point }] : [];
    });
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  const along = (point: PlanPoint) =>
    ((point.x - start.x) * (end.x - start.x) +
      (point.z - start.z) * (end.z - start.z)) /
    length ** 2;
  const collinear = items
    .filter((item) => item.kind === "wall")
    .flatMap((item) => {
      const [a, b] = wallEndpoints(item);
      const cross = (point: PlanPoint) =>
        (point.x - start.x) * (end.z - start.z) -
        (point.z - start.z) * (end.x - start.x);
      if (Math.abs(cross(a)) > 0.01 || Math.abs(cross(b)) > 0.01) return [];
      const low = Math.max(0, Math.min(along(a), along(b)));
      const high = Math.min(1, Math.max(along(a), along(b)));
      return high - low > 1e-6 ? [{ low, high }] : [];
    });
  let result = items;
  for (const point of [start, end]) {
    result = result.flatMap((item) => {
      if (item.kind !== "wall") return [item];
      const [a, b] = wallEndpoints(item);
      const distance = Math.hypot(b.x - a.x, b.z - a.z);
      const offset = Math.hypot(point.x - a.x, point.z - a.z);
      if (
        Math.abs(offset + Math.hypot(point.x - b.x, point.z - b.z) - distance) >
        0.01
      )
        return [item];
      return splitAt(item, point);
    });
  }
  for (const { wallId, point } of crossing) {
    result = result.flatMap((item) =>
      item.id === wallId ? splitAt(item, point) : [item],
    );
  }
  const overlapPoints = collinear.flatMap(({ low, high }) =>
    [low, high].map((t) => ({
      x: start.x + (end.x - start.x) * t,
      z: start.z + (end.z - start.z) * t,
    })),
  );
  const sorted = [
    start,
    ...crossing.map((entry) => entry.point),
    ...overlapPoints,
    end,
  ]
    .sort(
      (a, b) =>
        Math.hypot(a.x - start.x, a.z - start.z) -
        Math.hypot(b.x - start.x, b.z - start.z),
    )
    .filter(
      (point, index, points) => index === 0 || !near(point, points[index - 1]),
    );
  const segments = sorted.slice(0, -1).flatMap((point, index) => {
    const next = sorted[index + 1];
    if (Math.hypot(next.x - point.x, next.z - point.z) < 0.25) return [];
    const middle = (along(point) + along(next)) / 2;
    if (
      collinear.some(
        ({ low, high }) => middle > low + 1e-6 && middle < high - 1e-6,
      )
    )
      return [];
    const geometry = wallBetween(point, next, 1);
    return [
      {
        ...wall,
        id: index === 0 ? wall.id : id(),
        name: index === 0 ? wall.name : `${wall.name} · segment ${index + 1}`,
        x: geometry.x,
        z: geometry.z,
        width: geometry.width,
        rotation: geometry.rotation,
      },
    ];
  });
  return [...result, ...segments];
}

export function calibratedPlacement(
  placement: NonNullable<SetScene["floorplanPlacement"]>,
  first: PlanPoint,
  second: PlanPoint,
  meters: number,
): NonNullable<SetScene["floorplanPlacement"]> {
  const measured = Math.hypot(second.x - first.x, second.z - first.z);
  if (!Number.isFinite(meters) || meters <= 0 || measured < 0.01)
    return placement;
  const factor = meters / measured;
  return {
    ...placement,
    width: placement.width * factor,
    height: placement.height * factor,
  };
}

export function planRooms(items: SceneItem[]): PlanRoom[] {
  const edges = new Map<
    string,
    { from: PlanPoint; to: PlanPoint; wallId: string }[]
  >();
  for (const wall of items) {
    if (wall.kind !== "wall" || wall.hidden) continue;
    const [a, b] = wallEndpoints(wall);
    if (near(a, b)) continue;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      const list = edges.get(key(from)) ?? [];
      list.push({ from, to, wallId: wall.id });
      edges.set(key(from), list);
    }
  }
  for (const list of edges.values())
    list.sort(
      (a, b) =>
        Math.atan2(a.to.z - a.from.z, a.to.x - a.from.x) -
        Math.atan2(b.to.z - b.from.z, b.to.x - b.from.x),
    );
  const visited = new Set<string>();
  const rooms: PlanRoom[] = [];
  for (const list of edges.values()) {
    for (const first of list) {
      const firstKey = `${key(first.from)}>${key(first.to)}`;
      if (visited.has(firstKey)) continue;
      let current = first;
      const points: PlanPoint[] = [];
      const traversed: string[] = [];
      while (traversed.length <= items.length * 2) {
        const edgeKey = `${key(current.from)}>${key(current.to)}`;
        if (traversed.includes(edgeKey)) break;
        traversed.push(edgeKey);
        points.push(current.from);
        const outgoing = edges.get(key(current.to));
        if (!outgoing) break;
        const reverse = outgoing.findIndex(
          (edge) => key(edge.to) === key(current.from),
        );
        if (reverse < 0) break;
        current = outgoing[(reverse - 1 + outgoing.length) % outgoing.length];
        if (`${key(current.from)}>${key(current.to)}` === firstKey) {
          traversed.forEach((entry) => visited.add(entry));
          const twiceArea = points.reduce((sum, point, index) => {
            const next = points[(index + 1) % points.length];
            return sum + point.x * next.z - next.x * point.z;
          }, 0);
          if (twiceArea > 0.1) {
            rooms.push({
              points,
              area: twiceArea / 2,
              center: {
                x:
                  points.reduce((sum, point) => sum + point.x, 0) /
                  points.length,
                z:
                  points.reduce((sum, point) => sum + point.z, 0) /
                  points.length,
              },
            });
          }
          break;
        }
      }
    }
  }
  return rooms;
}

export function floorplanSVG(source: SetScene): string {
  const scene = resolveSceneLayers(source);
  const walls = scene.items.filter(
    (item) => item.kind === "wall" && !item.hidden,
  );
  const points = walls.flatMap(wallEndpoints);
  if (points.length === 0) return "";
  const scale = 70;
  const minX = Math.min(...points.map((point) => point.x)) - 1;
  const maxX = Math.max(...points.map((point) => point.x)) + 1;
  const minZ = Math.min(...points.map((point) => point.z)) - 1;
  const maxZ = Math.max(...points.map((point) => point.z)) + 1;
  const width = Math.ceil((maxX - minX) * scale);
  const height = Math.ceil((maxZ - minZ) * scale + 100);
  const x = (value: number) => ((value - minX) * scale).toFixed(1);
  const y = (value: number) => ((value - minZ) * scale + 70).toFixed(1);
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[char]!,
    );
  const rooms = planRooms(scene.items).map((room, index) => {
    const fill = {
      timber: "#d6b991",
      tile: "#d6d9d2",
      concrete: "#b9bcb5",
      stone: "#c9bda7",
    }[roomFinishFor(room, scene.roomFinishes)];
    return (
      `<polygon points="${room.points.map((point) => `${x(point.x)},${y(point.z)}`).join(" ")}" fill="${fill}" stroke="none"/>` +
      `<text x="${x(room.center.x)}" y="${y(room.center.z)}" text-anchor="middle" fill="#534c43" font-size="14">Room ${index + 1} · ${room.area.toFixed(1)} m²</text>`
    );
  });
  const wallShapes = walls.map((wall) => {
    const [a, b] = wallEndpoints(wall);
    const line = `<line x1="${x(a.x)}" y1="${y(a.z)}" x2="${x(b.x)}" y2="${y(b.z)}" stroke="#34332f" stroke-width="${Math.max(4, wall.depth * scale).toFixed(1)}" stroke-linecap="square"/>`;
    const midpoint = `<text x="${x(wall.x)}" y="${(Number(y(wall.z)) - 10).toFixed(1)}" text-anchor="middle" fill="#4b4840" font-size="11">${wall.width.toFixed(2)} m</text>`;
    if (!wallOpenings(wall).length) return line + midpoint;
    const direction = {
      x: (b.x - a.x) / wall.width,
      z: (b.z - a.z) / wall.width,
    };
    const openings = wallOpenings(wall)
      .map((opening) => {
        const centerDistance = wall.width / 2 + opening.offset;
        const center = {
          x: a.x + direction.x * centerDistance,
          z: a.z + direction.z * centerDistance,
        };
        const half = opening.width / 2;
        const start = {
          x: center.x - direction.x * half,
          z: center.z - direction.z * half,
        };
        const end = {
          x: center.x + direction.x * half,
          z: center.z + direction.z * half,
        };
        const gap = `<line x1="${x(start.x)}" y1="${y(start.z)}" x2="${x(end.x)}" y2="${y(end.z)}" stroke="#eee6d8" stroke-width="${Math.max(6, wall.depth * scale + 2).toFixed(1)}"/>`;
        const mark =
          opening.type === "window"
            ? `<line x1="${x(start.x)}" y1="${y(start.z)}" x2="${x(end.x)}" y2="${y(end.z)}" stroke="#5490a3" stroke-width="3"/>`
            : opening.width > 1.6
              ? ""
              : `<line x1="${x(start.x)}" y1="${y(start.z)}" x2="${x(start.x - direction.z * opening.width)}" y2="${y(start.z + direction.x * opening.width)}" stroke="#a97246" stroke-width="2"/>`;
        return gap + mark;
      })
      .join("");
    return line + openings + midpoint;
  });
  const symbols = scene.items
    .filter(
      (item) =>
        !item.hidden &&
        ["actor", "camera", "light", "power"].includes(item.kind),
    )
    .map((item) => {
      const color = {
        actor: "#b16d41",
        camera: "#364d55",
        light: "#d49a35",
        power: "#6b5d9f",
      }[item.kind as "actor" | "camera" | "light" | "power"];
      return `<circle cx="${x(item.x)}" cy="${y(item.z)}" r="8" fill="${color}"/><text x="${x(item.x)}" y="${(Number(y(item.z)) - 12).toFixed(1)}" text-anchor="middle" fill="#35332e" font-size="10">${escape(item.name)}</text>`;
    });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f9f6ef"/><text x="30" y="36" fill="#302c28" font-family="sans-serif" font-size="22" font-weight="700">${escape(scene.name)}</text><g font-family="sans-serif">${rooms.join("")}${wallShapes.join("")}${symbols.join("")}</g><line x1="30" y1="${height - 35}" x2="100" y2="${height - 35}" stroke="#302c28" stroke-width="3"/><text x="30" y="${height - 43}" font-family="sans-serif" fill="#302c28" font-size="12">1 m</text></svg>`;
}
