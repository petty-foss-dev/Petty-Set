export const sensors = {
  super35: { label: "Super 35", width: 24.89, height: 18.66 },
  fullFrame: { label: "Full frame", width: 36, height: 24 },
  microFourThirds: { label: "Micro Four Thirds", width: 17.3, height: 13 },
} as const;

export type SensorId = keyof typeof sensors;
export const aspectRatios = {
  "16:9": 16 / 9,
  "2.39:1": 2.39,
  "4:3": 4 / 3,
} as const;
export type AspectRatio = keyof typeof aspectRatios;

export function cameraOptics(
  sensorId: SensorId,
  focalLength: number,
  aperture: number,
  focusDistance: number,
  aspectRatio: AspectRatio,
) {
  const sensor = sensors[sensorId];
  const ratio = aspectRatios[aspectRatio];
  const gateWidth = Math.min(sensor.width, sensor.height * ratio);
  const gateHeight = gateWidth / ratio;
  const horizontalFov =
    (2 * Math.atan(gateWidth / (2 * focalLength)) * 180) / Math.PI;
  const verticalFov =
    (2 * Math.atan(gateHeight / (2 * focalLength)) * 180) / Math.PI;
  const circleOfConfusion = Math.hypot(sensor.width, sensor.height) / 1500;
  const hyperfocal =
    (focalLength * focalLength) / (aperture * circleOfConfusion) + focalLength;
  const focusMm = focusDistance * 1000;
  const nearMm = (hyperfocal * focusMm) / (hyperfocal + focusMm - focalLength);
  const farMm =
    focusMm >= hyperfocal
      ? Infinity
      : (hyperfocal * focusMm) / (hyperfocal - focusMm + focalLength);
  return {
    gateWidth,
    gateHeight,
    horizontalFov,
    verticalFov,
    nearFocus: nearMm / 1000,
    farFocus: farMm / 1000,
    hyperfocal: hyperfocal / 1000,
  };
}
