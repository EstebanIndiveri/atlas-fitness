export type Rgb = {
  r: number;
  g: number;
  b: number;
};

const RGB_CHANNEL_EPSILON = 3;

const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;
const D50 = [0.96422, 1, 0.82521] as const;

const D50_TO_D65 = [
  [0.9554734, -0.0230985, 0.0632593],
  [-0.0283697, 1.0099955, 0.0210414],
  [0.012314, -0.0205077, 1.3303659],
] as const;

const XYZ_D65_TO_LIN_SRGB = [
  [3.2409699, -1.5373832, -0.4986108],
  [-0.9692436, 1.8759675, 0.0415551],
  [0.0556301, -0.203977, 1.0569715],
] as const;

function multiply3x3(
  matrix: readonly (readonly number[])[],
  vector: readonly [number, number, number],
): [number, number, number] {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
  ];
}

function linearSrgbToSrgb(channel: number): number {
  const sign = channel < 0 ? -1 : 1;
  const abs = Math.abs(channel);
  const encoded = abs > 0.0031308 ? 1.055 * abs ** (1 / 2.4) - 0.055 : 12.92 * abs;
  return sign * encoded;
}

function clampByte(channel: number): number {
  return Math.round(Math.min(1, Math.max(0, channel)) * 255);
}

function labToRgb(L: number, a: number, b: number): Rgb {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const cubeRootEpsilon = Math.cbrt(LAB_EPSILON);

  const xr = fx > cubeRootEpsilon ? fx ** 3 : (116 * fx - 16) / LAB_KAPPA;
  const yr = L > LAB_KAPPA * LAB_EPSILON ? fy ** 3 : L / LAB_KAPPA;
  const zr = fz > cubeRootEpsilon ? fz ** 3 : (116 * fz - 16) / LAB_KAPPA;

  const xyzD50: [number, number, number] = [xr * D50[0], yr * D50[1], zr * D50[2]];
  const xyzD65 = multiply3x3(D50_TO_D65, xyzD50);
  const linear = multiply3x3(XYZ_D65_TO_LIN_SRGB, xyzD65);

  return {
    r: clampByte(linearSrgbToSrgb(linear[0])),
    g: clampByte(linearSrgbToSrgb(linear[1])),
    b: clampByte(linearSrgbToSrgb(linear[2])),
  };
}

function parseNumber(token: string): number {
  if (token.endsWith('%')) {
    return Number.parseFloat(token.slice(0, -1));
  }
  return Number.parseFloat(token);
}

export function parseCssColor(value: string): Rgb | null {
  const trimmed = value.trim();

  const rgbComma = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.%]+)?\s*\)$/i,
  );
  if (rgbComma) {
    return {
      r: Number.parseFloat(rgbComma[1]),
      g: Number.parseFloat(rgbComma[2]),
      b: Number.parseFloat(rgbComma[3]),
    };
  }

  const rgbSpace = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.%]+)?\s*\)$/i,
  );
  if (rgbSpace) {
    return {
      r: Number.parseFloat(rgbSpace[1]),
      g: Number.parseFloat(rgbSpace[2]),
      b: Number.parseFloat(rgbSpace[3]),
    };
  }

  const lab = trimmed.match(
    /^lab\(\s*([+\-.\d%eE]+)\s+([+\-.\d%eE]+)\s+([+\-.\d%eE]+)(?:\s*\/\s*[\d.%]+)?\s*\)$/i,
  );
  if (lab) {
    return labToRgb(parseNumber(lab[1]), parseNumber(lab[2]), parseNumber(lab[3]));
  }

  return null;
}

export function rgbChannelsClose(actual: Rgb, expected: Rgb, epsilon = RGB_CHANNEL_EPSILON): boolean {
  return (
    Math.abs(actual.r - expected.r) <= epsilon &&
    Math.abs(actual.g - expected.g) <= epsilon &&
    Math.abs(actual.b - expected.b) <= epsilon
  );
}

export function cssColorsMatch(
  actualCssColor: string,
  expectedRgb: string,
  epsilon = RGB_CHANNEL_EPSILON,
): boolean {
  const actual = parseCssColor(actualCssColor);
  const expected = parseCssColor(expectedRgb);
  if (!actual || !expected) {
    return false;
  }
  return rgbChannelsClose(actual, expected, epsilon);
}
