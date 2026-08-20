"use client";

import { createContext, useContext } from "react";

export type ListContextValue = {
  signedIn: boolean;
  allowGuests: boolean;
  ownerName: string;
  ownerFirstName: string;
  reservationDays: number | null;
  listTitle: string;
  listHref: string;
  ground: "studio" | "gallery";
};

const ListContext = createContext<ListContextValue>({
  signedIn: false,
  allowGuests: true,
  ownerName: "them",
  ownerFirstName: "them",
  reservationDays: 7,
  listTitle: "",
  listHref: "/",
  ground: "gallery",
});

export function ListProvider({
  value,
  children,
}: {
  value: ListContextValue;
  children: React.ReactNode;
}) {
  return <ListContext.Provider value={value}>{children}</ListContext.Provider>;
}

export function useList() {
  return useContext(ListContext);
}
