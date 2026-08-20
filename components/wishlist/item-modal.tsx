"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";

/**
 * Wraps the item detail when it is reached by clicking a card. The URL is a real
 * page, so a refresh or a shared link lands on the full view instead.
 */
export function ItemModal({
  title,
  listTitle,
  children,
}: {
  title: string;
  listTitle?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    router.back();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={listTitle ? `From ${listTitle}` : undefined}
      size="full"
      ground="gallery"
    >
      <div className="px-5 py-5 sm:px-7 sm:py-7">{children}</div>
    </Modal>
  );
}
