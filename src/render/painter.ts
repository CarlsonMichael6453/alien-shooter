export interface Painter {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  fillRect(x: number, y: number, w: number, h: number, color: string): void;
  fillCircle(x: number, y: number, r: number, color: string): void;
  strokeCircle(x: number, y: number, r: number, color: string, width: number): void;
  fillEllipse(x: number, y: number, rx: number, ry: number, color: string): void;
  fillPolygon(points: ReadonlyArray<readonly [number, number]>, color: string): void;
  fillRoundRect(x: number, y: number, w: number, h: number, radius: number, color: string): void;
  fillVerticalGradient(x: number, y: number, w: number, h: number, colors: readonly string[]): void;
}
