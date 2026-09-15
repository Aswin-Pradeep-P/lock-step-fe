export function Header({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between border-b bg-background px-6 py-4 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </header>
  );
}
