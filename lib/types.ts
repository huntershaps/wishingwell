export type Visibility = "public" | "link" | "private";
export type Priority = "someday" | "medium" | "high" | "dream";
export type ReservationStatus = "reserved" | "purchased" | "released" | "expired";
/** What a viewer is allowed to know about an item's gift state. */
export type GiftState = "available" | "reserved" | "purchased" | "hidden";

export type Profile = {
  userId: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  accent: string;
  location: string | null;
  links: { label: string; url: string }[];
  visibility: "public" | "private";
  discoverable: boolean;
};

export type Settings = {
  userId: string;
  surpriseMode: boolean;
  allowGuestReservations: boolean;
  reservationsExpire: boolean;
  reservationDays: number;
  defaultVisibility: Visibility;
  emailNotifications: boolean;
  appNotifications: boolean;
  notifyGiftActivity: boolean;
  notifyReservationReminders: boolean;
};

export type Media = {
  id: string;
  itemId: string;
  kind: "image" | "video";
  url: string;
  posterUrl: string | null;
  alt: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  position: number;
};

export type Item = {
  id: string;
  wishlistId: string;
  name: string;
  url: string | null;
  store: string | null;
  priceCents: number | null;
  currency: string;
  description: string | null;
  whyWant: string | null;
  priority: Priority;
  category: string | null;
  tags: string[];
  notes: string | null;
  size: string | null;
  color: string | null;
  variant: string | null;
  feature: boolean;
  position: number;
  createdAt: number;
  media: Media[];
  /** Resolved for the current viewer — never leaks a buyer's identity. */
  giftState: GiftState;
  /** True only when the current viewer is the person holding the reservation. */
  reservedByViewer: boolean;
  reservation?: ViewerReservation;
};

export type ViewerReservation = {
  id: string;
  status: ReservationStatus;
  reservedAt: number;
  expiresAt: number | null;
  purchasedAt: number | null;
  note: string | null;
};

export type Wishlist = {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  coverUrl: string | null;
  accent: string;
  occasion: string | null;
  eventDate: number | null;
  visibility: Visibility;
  shareToken: string;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
  itemCount: number;
};

export type Notification = {
  id: string;
  audience: "owner" | "buyer";
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: number | null;
  createdAt: number;
};

export type Viewer = {
  userId: string | null;
  guestToken: string | null;
};
