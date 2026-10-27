import { netBoundingBox } from '../geometry/nets';
import { polygonContainsNetPoint } from '../geometry/nets';
import type { NetLayout, SolidDefinition, Vec2 } from '../geometry/types';

interface DrawState {
  solid: SolidDefinition;
  layout: NetLayout;
  selectedFaceId: string | null;
  note?: string;
}

export class NetView {
  private state: DrawState | null = null;
  private hoveredFaceId: string | null = null;
  private mapping: {
    scale: number;
    offsetX: number;
    offsetY: number;
    minX: number;
    maxY: number;
  } | null = null;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onPick: (faceId: string | null) => void,
  ) {
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('click', this.handleClick);
    this.resizeObserver = new ResizeObserver(() => this.redraw());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
  }

  render(
    solid: SolidDefinition,
    layout: NetLayout,
    selectedFaceId: string | null,
    note?: string,
  ): void {
    this.state = { solid, layout, selectedFaceId, note };
    this.redraw();
  }

  redraw(): void {
    if (!this.state) return;
    const { solid, layout, selectedFaceId, note } = this.state;
    const width = this.canvas.parentElement?.clientWidth ?? this.canvas.clientWidth;
    const height = this.canvas.parentElement?.clientHeight ?? this.canvas.clientHeight;
    if (width <= 0 || height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(width * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    } else if (this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.height = Math.round(height * dpr);
    }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const box = netBoundingBox(layout);
    const padding = Math.min(56, Math.max(28, Math.min(width, height) * 0.1));
    const scale = Math.min(
      (width - padding * 2) / Math.max(box.width, 0.001),
      (height - padding * 2 - (note ? 28 : 0)) / Math.max(box.height, 0.001),
    );
    const contentWidth = box.width * scale;
    const contentHeight = box.height * scale;
    const offsetX = (width - contentWidth) / 2;
    const offsetY = (height - contentHeight - (note ? 28 : 0)) / 2;
    this.mapping = { scale, offsetX, offsetY, minX: box.minX, maxY: box.maxY };

    const toCanvas = (point: Vec2) => ({
      x: offsetX + (point.x - box.minX) * scale,
      y: offsetY + (box.maxY - point.y) * scale,
    });

    const faces = [...layout.faces].sort((a, b) => {
      if (a.faceId === selectedFaceId) return 1;
      if (b.faceId === selectedFaceId) return -1;
      return 0;
    });

    for (const netFace of faces) {
      const solidFace = solid.faces.find((face) => face.id === netFace.faceId);
      const points = netFace.polygon.map(toCanvas);
      if (points.length < 3) continue;
      const isSelected = netFace.faceId === selectedFaceId;
      const isHovered = netFace.faceId === this.hoveredFaceId;
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      if (isSelected) {
        ctx.save();
        ctx.shadowColor = 'rgba(223, 106, 80, 0.45)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = solidFace?.color ?? '#dfa83d';
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = solidFace?.color ?? '#dfa83d';
        ctx.globalAlpha = isHovered ? 1 : 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = isSelected ? '#b8462c' : '#143e3b';
      ctx.lineWidth = isSelected ? 3.4 : isHovered ? 2.2 : 1.4;
      ctx.lineJoin = 'round';
      ctx.stroke();

      const center = points.reduce(
        (acc, point) => ({
          x: acc.x + point.x / points.length,
          y: acc.y + point.y / points.length,
        }),
        { x: 0, y: 0 },
      );
      const fontSize = Math.max(10, Math.min(15, scale * 0.22));
      if (netFace.polygon.length * scale > 42) {
        ctx.font = `600 ${fontSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
        ctx.fillStyle = '#123f3c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(solidFace?.label ?? '', center.x, center.y);
      }
    }

    if (note) {
      ctx.font = '600 12px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      ctx.fillStyle = '#b8462c';
      ctx.textAlign = 'center';
      ctx.fillText(note, width / 2, height - 18);
    }
  }

  private toNetCoordinates(event: PointerEvent): Vec2 | null {
    if (!this.mapping) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { scale, offsetX, offsetY, minX, maxY } = this.mapping;
    return {
      x: (x - offsetX) / scale + minX,
      y: maxY - (y - offsetY) / scale,
    };
  }

  private faceAt(point: Vec2): string | null {
    if (!this.state) return null;
    const layout = this.state.layout;
    for (const netFace of layout.faces) {
      if (polygonContainsNetPoint(netFace, point)) return netFace.faceId;
    }
    return null;
  }

  private handlePointerMove = (event: PointerEvent): void => {
    const point = this.toNetCoordinates(event);
    if (!point) return;
    const faceId = this.faceAt(point);
    if (faceId !== this.hoveredFaceId) {
      this.hoveredFaceId = faceId;
      this.canvas.style.cursor = faceId ? 'pointer' : 'default';
      this.redraw();
    }
  };

  private handlePointerLeave = (): void => {
    if (this.hoveredFaceId !== null) {
      this.hoveredFaceId = null;
      this.canvas.style.cursor = 'default';
      this.redraw();
    }
  };

  private handleClick = (event: PointerEvent): void => {
    const point = this.toNetCoordinates(event);
    if (!point) return;
    this.onPick(this.faceAt(point));
  };

  dispose(): void {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('click', this.handleClick);
  }
}
