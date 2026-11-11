import type { Metadata } from "next";
import { DevUi } from "./DevUi";

export const metadata: Metadata = {
  title: "UI primitives (dev)",
  robots: { index: false, follow: false },
};

/** Temporary page showing every primitive in every state. Delete before demo (PROMPT Phase 1). */
export default function DevUiPage() {
  return <DevUi />;
}
