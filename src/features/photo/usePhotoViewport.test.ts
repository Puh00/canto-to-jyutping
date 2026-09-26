import { describe, expect, it } from 'vitest';
import { constrainPhotoView, fitPhoto, photoPoint, resizePhotoView } from './usePhotoViewport';

describe('photo editor geometry', () => {
  it('fits portrait and landscape photos without cropping or stretching', () => {
    expect(fitPhoto(1200, 800, 900, 1600)).toEqual({ width: 1200, height: 800, imageWidth: 450, imageHeight: 800 });
    expect(fitPhoto(400, 600, 1600, 900)).toEqual({ width: 400, height: 600, imageWidth: 400, imageHeight: 225 });
  });

  it('centers unused space and maps image edges rather than viewport edges', () => {
    const bounds = fitPhoto(1200, 800, 900, 1600);
    const view = constrainPhotoView({ scale: 1, x: 0, y: 0 }, bounds);
    expect(view).toEqual({ scale: 1, x: .3125, y: 0 });
    expect(photoPoint({ x: .3125, y: 0 }, view, bounds)).toEqual({ x: 0, y: 0 });
    expect(photoPoint({ x: .6875, y: 1 }, view, bounds)).toEqual({ x: 1, y: 1 });
    expect(photoPoint({ x: .1, y: .5 }, view, bounds).x).toBeLessThan(0);
  });

  it('allows pan only on axes where the zoomed photo exceeds the viewport', () => {
    const bounds = fitPhoto(1200, 800, 900, 1600);
    expect(constrainPhotoView({ scale: 2, x: -1, y: -5 }, bounds)).toEqual({ scale: 2, x: .125, y: -1 });
    expect(constrainPhotoView({ scale: 20, x: 2, y: -10 }, bounds)).toEqual({ scale: 6, x: 0, y: -5 });
  });

  it('preserves the viewed image point and zoom across orientation changes', () => {
    const before = fitPhoto(400, 600, 1600, 900);
    const after = fitPhoto(800, 300, 1600, 900);
    const view = constrainPhotoView({ scale: 3, x: -.4, y: -.05 }, before);
    const resized = resizePhotoView(view, before, after);
    const oldCenter = photoPoint({ x: .5, y: .5 }, view, before);
    const newCenter = photoPoint({ x: .5, y: .5 }, resized, after);
    expect(resized.scale).toBe(3);
    expect(newCenter.x).toBeCloseTo(oldCenter.x);
    expect(newCenter.y).toBeCloseTo(oldCenter.y);
  });
});
