import { describe, expect, it } from "vitest";
import { validatePdfFile } from "./file-validation";
import { getKeyboardCommand } from "./keyboard";
import { clampPage } from "./navigation";

describe("clampPage", () => {
  it("keeps a page inside the document range", () => {
    expect(clampPage(3, 10)).toBe(3);
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(11, 10)).toBe(10);
  });

  it("truncates decimal page numbers", () => {
    expect(clampPage(3.9, 10)).toBe(3);
  });
});

describe("getKeyboardCommand", () => {
  it("maps presentation navigation keys", () => {
    expect(getKeyboardCommand("ArrowRight")).toBe("next");
    expect(getKeyboardCommand(" ")).toBe("next");
    expect(getKeyboardCommand("Backspace")).toBe("previous");
    expect(getKeyboardCommand("Home")).toBe("first");
    expect(getKeyboardCommand("End")).toBe("last");
    expect(getKeyboardCommand("f")).toBe("fullscreen");
    expect(getKeyboardCommand("Escape")).toBe("exit");
  });
});

describe("validatePdfFile", () => {
  it("accepts a non-empty PDF", () => {
    const file = new File(["pdf"], "slides.pdf", { type: "application/pdf" });
    expect(validatePdfFile(file)).toBeNull();
  });

  it("rejects a non-PDF file", () => {
    const file = new File(["text"], "slides.txt", { type: "text/plain" });
    expect(validatePdfFile(file)).toBe("PDFファイルを選択してください");
  });
});
