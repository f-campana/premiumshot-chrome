// Same backing-pixel geometry as PremiumShotCore.Zoom. At 100%, one export
// pixel occupies one display pixel; the CSS size accounts for devicePixelRatio.
export class Zoom {
  scale = 1;
  x = 0;
  y = 0;
  floor = 1;
  fitScale = 1;
  imageWidth = 1;
  imageHeight = 1;
  viewportWidth = 1;
  viewportHeight = 1;

  configure({width, height, viewportWidth, viewportHeight, backingScale = 1, fit = true}) {
    const backing = Math.max(1, backingScale);
    this.imageWidth = Math.max(1, width) / backing;
    this.imageHeight = Math.max(1, height) / backing;
    this.viewportWidth = Math.max(1, viewportWidth);
    this.viewportHeight = Math.max(1, viewportHeight);
    this.fitScale = Math.min(4, this.viewportWidth / this.imageWidth, this.viewportHeight / this.imageHeight);
    this.floor = Math.min(1, this.fitScale);
    if (fit) {
      this.scale = this.fitScale;
      this.x = this.y = 0;
    } else {
      this.scale = Math.min(4, Math.max(this.floor, this.scale));
      this.clampPan();
    }
  }

  zoomTo(value, anchorX = 0, anchorY = 0) {
    const next = Math.min(4, Math.max(this.floor, value));
    const ratio = next / this.scale;
    this.x = anchorX - (anchorX - this.x) * ratio;
    this.y = anchorY - (anchorY - this.y) * ratio;
    this.scale = next;
    this.clampPan();
  }

  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.clampPan();
  }

  clampPan() {
    const maxX = Math.max(0, (this.imageWidth * this.scale - this.viewportWidth) / 2);
    const maxY = Math.max(0, (this.imageHeight * this.scale - this.viewportHeight) / 2);
    this.x = Math.min(maxX, Math.max(-maxX, this.x));
    this.y = Math.min(maxY, Math.max(-maxY, this.y));
  }
}
