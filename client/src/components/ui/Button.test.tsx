import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { cn } from "@/lib/utils/cn";

describe("Button", () => {
  it("renders an accessible button with type=button by default", () => {
    render(<Button>Start training</Button>);
    const button = screen.getByRole("button", { name: "Start training" });
    expect(button.getAttribute("type")).toBe("button");
  });

  it("requires an aria-label for icon-only buttons (rendered as a labelled button)", () => {
    render(
      <Button variant="icon" aria-label="Settings">
        <span aria-hidden="true">⚙</span>
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  });
});

describe("cn", () => {
  it("merges conflicting Tailwind classes, keeping the last", () => {
    expect(cn("h-8", "h-10")).toBe("h-10");
    expect(cn("text-body", false && "hidden", "font-medium")).toBe("text-body font-medium");
  });
});
