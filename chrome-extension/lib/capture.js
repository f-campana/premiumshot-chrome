// Capture coordinates are CSS pixels. Bitmap dimensions, rather than devicePixelRatio,
// determine the conversion, including Chrome zoom and Retina displays.
export function cropBounds(rect, viewport, imageWidth, imageHeight) {
  if (![viewport?.width, viewport?.height, imageWidth, imageHeight].every(n => Number.isFinite(n) && n > 0)) {
    throw new Error('The page viewport could not be measured. Try capturing again.');
  }
  if (!rect) return { x: 0, y: 0, width: imageWidth, height: imageHeight };
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width < 1 || rect.height < 1) {
    throw new Error('Select an area with a visible width and height.');
  }
  if (rect.x < -1 || rect.y < -1 || rect.x + rect.width > viewport.width + 1 || rect.y + rect.height > viewport.height + 1) {
    throw new Error('This element extends beyond the visible page. Select a smaller element or use an area.');
  }
  const sx = imageWidth / viewport.width;
  const sy = imageHeight / viewport.height;
  if (Math.abs(sx-sy)>2*Math.max(1/viewport.width,1/viewport.height)) {
    throw new Error('The page size changed during capture. Return to the page and select again.');
  }
  const x = Math.max(0, Math.floor(rect.x * sx));
  const y = Math.max(0, Math.floor(rect.y * sy));
  const right = Math.min(imageWidth, Math.ceil((rect.x + rect.width) * sx));
  const bottom = Math.min(imageHeight, Math.ceil((rect.y + rect.height) * sy));
  return { x, y, width: right - x, height: bottom - y };
}

export function sameViewport(a, b) {
  return ['width', 'height', 'scrollX', 'scrollY', 'scale', 'offsetX', 'offsetY']
    .every(key => Number.isFinite(a?.[key]) && Number.isFinite(b?.[key]) && Math.abs(a[key] - b[key]) < (key==='scale'?0.001:0.5));
}
