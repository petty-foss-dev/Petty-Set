export const sensors = {
  super35: { label: "Super 35", width: 24.89, height: 18.66 },
  fullFrame: { label: "Full frame", width: 36, height: 24 },
  microFourThirds: { label: "Micro Four Thirds", width: 17.3, height: 13 },
  alexa35_4k16x9: { label: "ALEXA 35 · 4K 16:9", width: 24.9, height: 14 },
  alexa35_46k16x9: { label: "ALEXA 35 · 4.6K 16:9", width: 28, height: 15.7 },
  sonyFx3: { label: "Sony FX3 · full frame", width: 35.6, height: 23.8 },
  pocket6kPro: {
    label: "Pocket Cinema Camera 6K Pro · Super 35",
    width: 23.1,
    height: 12.99,
  },
} as const;

export type SensorId = keyof typeof sensors;

export const cameraPresets = {
  alexa35: {
    label: "ARRI ALEXA 35",
    cameraBody: "cinema",
    defaultSensor: "alexa35_4k16x9",
    sensorModes: ["alexa35_4k16x9", "alexa35_46k16x9"],
  },
  sonyFx3: {
    label: "Sony FX3",
    cameraBody: "mirrorless",
    defaultSensor: "sonyFx3",
    sensorModes: ["sonyFx3"],
  },
  pocket6kPro: {
    label: "Blackmagic Pocket Cinema Camera 6K Pro",
    cameraBody: "cinema",
    defaultSensor: "pocket6kPro",
    sensorModes: ["pocket6kPro"],
  },
} as const;
export type CameraPresetId = keyof typeof cameraPresets;

export const lensPresets = {
  zeissCp3_18: {
    label: "ZEISS CP.3 18 mm",
    focalLength: 18,
    minTStop: 2.9,
    minFocus: 0.3,
  },
  zeissCp3_25: {
    label: "ZEISS CP.3 25 mm",
    focalLength: 25,
    minTStop: 2.1,
    minFocus: 0.26,
  },
  zeissCp3_35: {
    label: "ZEISS CP.3 35 mm",
    focalLength: 35,
    minTStop: 2.1,
    minFocus: 0.3,
  },
  zeissCp3_50: {
    label: "ZEISS CP.3 50 mm",
    focalLength: 50,
    minTStop: 2.1,
    minFocus: 0.45,
  },
  zeissCp3_85: {
    label: "ZEISS CP.3 85 mm",
    focalLength: 85,
    minTStop: 2.1,
    minFocus: 1,
  },
} as const;
export type LensPresetId = keyof typeof lensPresets;
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
