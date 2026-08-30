import { describe, expect, it } from "bun:test";

const layoutSource = await Bun.file(new URL("../src/app/layout.tsx", import.meta.url)).text();
const cssSource = await Bun.file(new URL("../src/app/globals.css", import.meta.url)).text();
const appShellSource = await Bun.file(new URL("../src/components/layout/app-shell.tsx", import.meta.url)).text();
const bottomNavSource = await Bun.file(new URL("../src/components/bottom-nav.tsx", import.meta.url)).text();

const groupPageSource = await Bun.file(new URL("../src/app/groups/[groupId]/page.tsx", import.meta.url)).text();
const alertDialogSource = await Bun.file(new URL("../src/components/ui/alert-dialog.tsx", import.meta.url)).text();

describe("Mobile Experience & Viewport Invariants", () => {
  it("defines Next.js Viewport export with viewportFit cover and themeColor", () => {
    expect(layoutSource).toContain("export const viewport: Viewport =");
    expect(layoutSource).toContain('viewportFit: "cover"');
    expect(layoutSource).toContain('width: "device-width"');
    expect(layoutSource).toContain("initialScale: 1");
    expect(layoutSource).toContain("maximumScale: 5");
    expect(layoutSource).toContain("themeColor:");
    expect(layoutSource).toContain("#ffffff");
    expect(layoutSource).toContain("#171717");
  });

  it("configures mobile touch action, tap highlights, and safe area utilities in globals.css", () => {
    expect(cssSource).toContain("-webkit-tap-highlight-color: transparent;");
    expect(cssSource).toContain("overscroll-behavior-y: contain;");
    expect(cssSource).toContain("touch-action: manipulation;");
    expect(cssSource).toContain("@utility pb-safe");
    expect(cssSource).toContain("@utility pt-safe");
    expect(cssSource).toContain("env(safe-area-inset-bottom");
  });

  it("handles mobile safe-area top and bottom clearances in AppShell and BottomNav", () => {
    expect(appShellSource).toContain("env(safe-area-inset-top");
    expect(appShellSource).toContain("env(safe-area-inset-bottom");
    expect(bottomNavSource).toContain("env(safe-area-inset-bottom");
    expect(bottomNavSource).toContain("min-h-[44px]");
  });

  it("positions group page FAB above BottomNav until md breakpoint", () => {
    expect(groupPageSource).toContain("bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-8");
  });

  it("ensures AlertDialogContent respects mobile max-width margins", () => {
    expect(alertDialogSource).toContain("max-w-[calc(100%-2rem)]");
    expect(alertDialogSource).toContain("max-h-[calc(100dvh-2rem)]");
  });
});
