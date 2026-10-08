import { sensors } from "./cinematography.ts";
import type { SetScene, Shot } from "./model.ts";

const csv = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;

export function shotListCSV(scene: SetScene, shots: Shot[]) {
  const rows = [
    [
      "Order",
      "Scene",
      "Shot",
      "Camera",
      "Sensor",
      "Focal length (mm)",
      "Aperture",
      "Focus distance (m)",
      "Aspect ratio",
      "Duration (s)",
      "Notes",
    ],
    ...shots.map((shot, index) => {
      const camera = scene.items.find((item) => item.id === shot.cameraId);
      return [
        index + 1,
        scene.name,
        shot.title,
        camera?.name ?? "",
        sensors[camera?.sensor ?? "super35"].label,
        camera?.focalLength ?? 35,
        camera?.aperture ?? 2.8,
        camera?.focusDistance ?? 3,
        shot.aspectRatio ?? "16:9",
        shot.duration,
        shot.notes,
      ];
    }),
  ];
  return `\uFEFF${rows.map((row) => row.map(csv).join(",")).join("\r\n")}\r\n`;
}
