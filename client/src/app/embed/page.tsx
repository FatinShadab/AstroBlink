import Observatory from "@/components/Observatory";

/**
 * /embed — compact blink comparator for <iframe> embedding. Outside the signed-in
 * shell so an embed works for any visitor.
 */
export default function EmbedPage() {
  return <Observatory embedOnly />;
}
