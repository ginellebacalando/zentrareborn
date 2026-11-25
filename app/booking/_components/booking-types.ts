/** Published catalog data the booking page needs, prepared on the server. */
export type BookingPackage = {
  id: string;
  name: string;
  price: number;
  paxIncluded: number;
  excessPaxFee: number;
  reservationFee: number;
  checkInTime: string | null;
  checkOutTime: string | null;
  inclusions: string[];
};

export type BookingCategory = {
  slug: string;
  /** Matches the event keys in Zeni's pre-filled links (wedding, debut, …). */
  key: string;
  name: string;
  imageUrl: string | null;
  packages: BookingPackage[];
};

export type BookingAvailability = { booked: string[]; inquired: string[] };

/** Starting choices read from the page link; empty strings mean "not chosen". */
export type BookingInitialChoices = {
  category: string;
  /** A package id, 'custom', or ''. */
  packageId: string;
  date: string;
  startTime: string;
  endTime: string;
  guests: string;
  fromZeni: boolean;
};
