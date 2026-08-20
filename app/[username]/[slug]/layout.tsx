export default function GalleryLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <div className="ground-gallery min-h-dvh bg-bg text-fg">
      {children}
      {modal}
    </div>
  );
}
