export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center font-mono text-xs uppercase tracking-[0.3em] text-muted">
          Superhuman OS
        </p>
        {children}
      </div>
    </main>
  );
}
