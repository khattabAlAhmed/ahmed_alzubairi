export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-lg border border-text/10 bg-surface p-6 shadow-sm">
      <h1 className="text-2xl">{title}</h1>
      <p className="mt-2 text-text-secondary">{text}</p>
    </section>
  );
}
