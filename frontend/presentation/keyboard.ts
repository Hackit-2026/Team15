export type PresentationKeyboardActions = {
  next(): void;
  previous(): void;
  first(): void;
  last(): void;
  toggleFullscreen(): void;
  exitPresentation(): void;
};

const nextKeys = new Set(["ArrowRight", "ArrowDown", "PageDown", "Enter", " "]);
const previousKeys = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"]);

export type KeyboardCommand =
  | "next"
  | "previous"
  | "first"
  | "last"
  | "fullscreen"
  | "exit";

export function getKeyboardCommand(key: string): KeyboardCommand | null {
  if (nextKeys.has(key)) return "next";
  if (previousKeys.has(key)) return "previous";
  if (key === "Home") return "first";
  if (key === "End") return "last";
  if (key.toLowerCase() === "f") return "fullscreen";
  if (key === "Escape") return "exit";
  return null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function bindPresentationKeyboard(
  actions: PresentationKeyboardActions,
  isEnabled: () => boolean,
): () => void {
  const handleKeydown = (event: KeyboardEvent): void => {
    if (!isEnabled() || isEditableTarget(event.target) || event.repeat) {
      return;
    }

    const command = getKeyboardCommand(event.key);
    if (command === "next") {
      event.preventDefault();
      actions.next();
    } else if (command === "previous") {
      event.preventDefault();
      actions.previous();
    } else if (command === "first") {
      event.preventDefault();
      actions.first();
    } else if (command === "last") {
      event.preventDefault();
      actions.last();
    } else if (command === "fullscreen") {
      event.preventDefault();
      actions.toggleFullscreen();
    } else if (command === "exit") {
      actions.exitPresentation();
    }
  };

  document.addEventListener("keydown", handleKeydown);
  return () => document.removeEventListener("keydown", handleKeydown);
}
