export function shouldCycleFrames(imageCount: number, isVisible: boolean, pageVisible: boolean, reducedMotion: boolean) {
  return imageCount > 1 && isVisible && pageVisible && !reducedMotion;
}

export function nextFrameIndex(current: number, imageCount: number) {
  return imageCount > 0 ? (current + 1) % imageCount : 0;
}
