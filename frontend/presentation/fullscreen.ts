export async function enterFullscreen(element: HTMLElement): Promise<boolean> {
  if (!document.fullscreenEnabled) {
    return false;
  }
  try {
    await element.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
}

export async function toggleFullscreen(element: HTMLElement): Promise<boolean> {
  if (document.fullscreenElement) {
    await exitFullscreen();
    return false;
  }
  return enterFullscreen(element);
}
