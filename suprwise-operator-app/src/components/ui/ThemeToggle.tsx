export function ThemeToggle({ id }: { id?: string }) {
  return (
    <div className="theme-toggle" id={id}>
      <div className="theme-knob" />
    </div>
  );
}
