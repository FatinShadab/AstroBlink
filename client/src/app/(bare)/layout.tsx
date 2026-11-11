/** Pages WITHOUT header or footer, e.g. /embed (architecture §3). */
export default function BareLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="flex min-h-full flex-1 flex-col">
      {children}
    </main>
  );
}
