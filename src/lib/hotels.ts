// Partner hotels shared by IIM Shillong (Partner_Hotel_details.pdf). Rates in INR per night as quoted to the institute.
import laPateng from "@/assets/hotels/la-pateng.webp.asset.json";
import saiomPhoto from "@/assets/hotels/saiom.webp.asset.json";
import ph_mocahm from "@/assets/hotels/mocahm.jpg.asset.json";
import ph_comfort_inn from "@/assets/hotels/comfort-inn.jpg.asset.json";
import ph_dameki from "@/assets/hotels/dameki.jpg.asset.json";
import ph_hill_sides from "@/assets/hotels/hill-sides.jpg.asset.json";
import ph_srs from "@/assets/hotels/srs.jpg.asset.json";
import ph_unique from "@/assets/hotels/unique.jpg.asset.json";
import ph_zostel from "@/assets/hotels/zostel.jpg.asset.json";
import ph_traveller_inn from "@/assets/hotels/traveller-inn.jpg.asset.json";
import indianaPhoto from "@/assets/hotels/indiana.webp.asset.json";

export type Room = { type: string; rate?: string; from?: number; count?: number };
export type Hotel = {
  id: string;
  name: string;
  address: string;
  area: string;
  km: number;
  kmLabel: string;
  phones: string[];
  email?: string;
  listings: string[];
  rooms: Room[];
  photo?: string;
  /** Where the photo came from, credited under it. */
  photoSource?: { label: string; url: string };
  /** Verified booking / official pages (label → URL). */
  links?: { label: string; url: string }[];
  note?: string;
};

const h = (x: Hotel) => x;

export const HOTELS: Hotel[] = [
  h({ id: "mocahm", photo: ph_mocahm.url, photoSource: { label: "Trip.com", url: "https://in.trip.com/hotels/shillong-hotel-detail-109716387/mocahm-inn/" }, links: [{ label: "Trip.com", url: "https://in.trip.com/hotels/shillong-hotel-detail-109716387/mocahm-inn/" }, { label: "Klook", url: "https://www.klook.com/en-AE/hotels/detail/1676234-mocahm-inn/" }], name: "MOCAHM Inn", address: "Wah Heh, Mawpat, Shillong 793012", area: "Mawpat", km: 6.4, kmLabel: "6.4 km", phones: ["9362704992"], email: "mocahminn@gmail.com", listings: ["MakeMyTrip"], rooms: [{ type: "Deluxe, single", from: 2000, count: 6 }, { type: "Deluxe, double", from: 3000, count: 6 }] }),
  h({ id: "sojourn", name: "Sojourn Guest House", address: "Near Sharon Memorial HR. Sec. School, Mawdiangdiang 793018", area: "Mawdiangdiang", km: 2.8, kmLabel: "2.8 km", phones: ["9366986968", "7085743904"], email: "sojournsavoury@gmail.com", listings: ["Goibibo", "MakeMyTrip"], rooms: [{ type: "Double", rate: "2,000–2,500", from: 2000, count: 14 }, { type: "Triple", from: 3000, count: 4 }] }),
  h({ id: "blue-mount", name: "Blue Mount Hotel", address: "Mawdiangdiang, Meghalaya 793018", area: "Mawdiangdiang", km: 4.1, kmLabel: "4.1 km", phones: ["8191900044", "8191900082"], email: "hotel-blue-mount-nx-1-shillong-mgtdc-4@hotelsgds.com", listings: ["Google Hotels"], rooms: [{ type: "Double", rate: "3,000–3,500", from: 3000, count: 6 }] }),
  h({ id: "lush-green", name: "Lush Green Residency", address: "NEIGRIHMS, Mawdiangdiang, Shillong 793018", area: "NEIGRIHMS", km: 4, kmLabel: "4 km", phones: ["7005190152", "8798383758"], email: "lushgreen2024@gmail.com", listings: [], rooms: [{ type: "Double", from: 2000, count: 8 }] }),
  h({ id: "dameki", photo: ph_dameki.url, photoSource: { label: "Wanderlog", url: "https://wanderlog.com/place/details/11662230/dameki-guest-house" }, name: "Dameki Guest House", address: "Near NEIGRIHMS Hospital, Wahkhap, Mawpat 793018", area: "NEIGRIHMS", km: 5.1, kmLabel: "5.1 km", phones: ["9856089226"], email: "sunitakharlukhi0901@gmail.com", listings: ["Google Hotels"], rooms: [{ type: "Double", count: 28 }] }),
  h({ id: "leikyrpad", name: "Leikyrpad Orchid Resort", address: "Mawkasiang, New Shillong", area: "Mawkasiang", km: 2.5, kmLabel: "2–3 km", phones: ["7085887961"], email: "rsdtravelshillong@gmail.com", listings: [], rooms: [{ type: "Log-hut cottage", rate: "7,865 incl. tax", from: 7865, count: 20 }] }),
  h({ id: "hill-sides", photo: ph_hill_sides.url, photoSource: { label: "OYO", url: "https://www.oyorooms.com/243440/" }, name: "Hill Sides Residency", address: "Diengiong, Shillong 793018", area: "Diengiong", km: 3.7, kmLabel: "3.7 km", phones: ["7085229487"], email: "hillsideshillong@gmail.com", listings: [], rooms: [{ type: "Single", from: 2500, count: 4 }, { type: "Double", from: 3000, count: 3 }, { type: "Triple", from: 3500, count: 2 }, { type: "Family (4 bed)", from: 4000, count: 1 }] }),
  h({ id: "miracle-spring", name: "Miracle Spring", address: "Mawdiangdiang, Shillong 793018", area: "Mawdiangdiang", km: 3.9, kmLabel: "3.9 km", phones: ["9148338820"], email: "contact@miraclesprings.co.in", listings: ["Google Hotels"], rooms: [{ type: "Double", from: 2500, count: 12 }, { type: "Triple", from: 3000, count: 8 }, { type: "Family", from: 4000, count: 2 }] }),
  h({ id: "lyne-dari", name: "Lyne-Dari Inn", address: "NEIGRIHMS, Shillong 793018", area: "NEIGRIHMS", km: 3.6, kmLabel: "3.6 km", phones: ["9362314023"], listings: ["Google Hotels"], rooms: [{ type: "Single", from: 1500, count: 2 }, { type: "Double", from: 2500, count: 14 }, { type: "Family", from: 3500, count: 3 }] }),
  h({ id: "traveller-inn", photo: ph_traveller_inn.url, photoSource: { label: "Tripadvisor", url: "https://www.tripadvisor.ca/Hotel_Review-g503702-d19926099-Reviews-Travellers_Inn_Shillong-Shillong_East_Khasi_Hills_District_Meghalaya.html" }, links: [{ label: "Tripadvisor", url: "https://www.tripadvisor.ca/Hotel_Review-g503702-d19926099-Reviews-Travellers_Inn_Shillong-Shillong_East_Khasi_Hills_District_Meghalaya.html" }], name: "Traveller Inn", address: "3, R. R. Colony, Rynjah, Shillong 793006", area: "Rynjah", km: 8.6, kmLabel: "8.6 km", phones: ["9612852030", "9366187935"], email: "travellersinnshl@gmail.com", listings: [], note: "Ask for Supriya Chetri on 9366187935.", rooms: [{ type: "Double", rate: "2,300 + tax, 2,500 with breakfast", from: 2300, count: 25 }, { type: "Triple", rate: "3,100 + tax, 3,400 with breakfast", from: 3100, count: 6 }, { type: "Family", rate: "3,900 + tax, 4,300 with breakfast", from: 3900, count: 2 }] }),
  h({ id: "indiana-hills", photo: indianaPhoto.url, links: [{ label: "Official site", url: "https://indianahills.com/" }, { label: "MakeMyTrip", url: "https://www.makemytrip.com/hotels/photos-of-indiana_hills-details-shillong.html" }, { label: "EaseMyTrip", url: "https://www.easemytrip.com/hotels/indiana-hills-8311443/" }], name: "Indiana Hills Boutique Hotel", address: "Evellyne Ride Rd, near Nongrim Hills petrol pump, Rynjah 793003", area: "Rynjah", km: 10, kmLabel: "10 km", phones: ["6909647393", "9089647393"], email: "bookings.indianahills@gmail.com", listings: ["Official site", "Agoda"], rooms: [{ type: "Double", rate: "4,500 + tax", from: 4500, count: 2 }] }),
  h({ id: "la-pateng", name: "La Pateng", address: "Demseiñ-Ïong, Shillong 793001", area: "City centre", km: 10.1, kmLabel: "10.1 km", phones: ["6009818943"], email: "info@lapateng.com", listings: ["MakeMyTrip", "Goibibo", "Official site"], photo: laPateng.url, rooms: [{ type: "Standard", rate: "5,500 + tax", from: 5500, count: 7 }, { type: "Deluxe", rate: "6,500 + tax", from: 6500, count: 24 }, { type: "Business suite", rate: "10,500 + tax", from: 10500, count: 2 }, { type: "Family suite", rate: "12,500 + tax", from: 12500, count: 2 }] }),
  h({ id: "zostel", photo: ph_zostel.url, photoSource: { label: "Zostel", url: "https://www.zostel.com/destination/shillong/stay/zostel-shillong-shlh305" }, links: [{ label: "Book on Zostel", url: "https://www.zostel.com/zostel/shillong/zostel-shillong-shlh305/" }], name: "Zostel Shillong", address: "Pine Villa, Golf Club, Lumshyiap, Shillong 793019", area: "Golf Club", km: 12, kmLabel: "11–13 km", phones: ["9612808981"], email: "shillong@zostel.com", listings: ["MakeMyTrip", "Google Hotels"], rooms: [{ type: "Dorm, 6 beds", rate: "949 + tax", from: 949, count: 5 }, { type: "Dorm, 4 beds", rate: "849 + tax", from: 849, count: 4 }] }),
  h({ id: "saiom", photo: saiomPhoto.url, links: [{ label: "Official site", url: "https://hotel.thesaiom.com/" }, { label: "MakeMyTrip", url: "https://www.makemytrip.com/hotels/the_saiom_hotel-details-shillong.html" }], name: "The Saiom Hotel", address: "Near Samkhamti petrol pump, Urkaliar, Shillong 793011", area: "Urkaliar", km: 8.9, kmLabel: "8.9 km", phones: ["6001710151"], email: "thesaiomhotels@gmail.com", listings: ["MakeMyTrip"], rooms: [{ type: "Deluxe", rate: "3,500 incl. tax", from: 3500, count: 4 }, { type: "Executive", rate: "4,400 incl. tax", from: 4400, count: 10 }, { type: "Family", rate: "6,500 incl. tax", from: 6500, count: 2 }] }),
  h({ id: "comfort-inn", photo: ph_comfort_inn.url, photoSource: { label: "Tripadvisor", url: "https://www.tripadvisor.in/Hotel_Review-g503702-d28804628-Reviews-Hotel_O_Rynjah_Formerly_Comfort_Inn-Shillong_East_Khasi_Hills_District_Meghalaya.html" }, name: "Comfort Inn Guest House", address: "Near Patanjali Store, R. R. Colony, Rynjah 793006", area: "Rynjah", km: 9.7, kmLabel: "9.7 km", phones: ["8787845482"], email: "sanjaydas301978@gmail.com", listings: [], rooms: [{ type: "Double", from: 2200, count: 12 }, { type: "Triple", from: 2800, count: 6 }] }),
  h({ id: "unique", photo: ph_unique.url, photoSource: { label: "Booking.com", url: "https://www.booking.com/hotel/in/oyo-unique-residency.html" }, name: "Unique Residency", address: "Lapalang, Shillong", area: "Lapalang", km: 9.8, kmLabel: "9.8 km", phones: ["8787845482"], email: "sanjaydas301978@gmail.com", listings: [], rooms: [{ type: "Double", count: 2 }, { type: "4-bedded", count: 17 }] }),
  h({ id: "srs", photo: ph_srs.url, photoSource: { label: "Booking.com", url: "https://www.booking.com/hotel/in/collection-o-laban-shillong.html" }, name: "S R S Residency", address: "Laban, Shillong", area: "Laban", km: 14.8, kmLabel: "14.8 km", phones: ["8787845482"], email: "sanjaydas301978@gmail.com", listings: [], rooms: [{ type: "Double", count: 9 }, { type: "4-bedded", count: 3 }] }),
  h({ id: "royal-green", name: "Hotel Royal Green", address: "Ishyrwat, Shillong 793018", area: "Ishyrwat", km: 6.1, kmLabel: "6.1 km", phones: ["7005896416"], email: "balarilangnongpluh@gmail.com", listings: [], rooms: [{ type: "Single to 4-bedded", count: 24 }] }),
  h({ id: "countryside", name: "Countryside View", address: "Mawdiangdiang, Mawkasiang 793018", area: "Mawkasiang", km: 3.7, kmLabel: "3.7 km", phones: ["9856035248"], listings: [], rooms: [{ type: "Guest house rooms", count: 6 }] }),
  h({ id: "makarios", name: "Makarios Hotel", address: "Mawdiangdiang, Mawkasiang 793018", area: "Mawkasiang", km: 2.9, kmLabel: "2.9 km", phones: ["7085635003"], listings: ["Booking.com"], rooms: [{ type: "Double", rate: "1,500 with TV, 1,800 without", from: 1500, count: 6 }] }),
  h({ id: "mebamon", name: "Mebamon Guest House", address: "Wahkhap, NEIGRIHMS Circle Rd, Shillong 793018", area: "NEIGRIHMS", km: 5.1, kmLabel: "5.1 km", phones: ["9362703628"], listings: [], rooms: [{ type: "Double (big)", from: 2000, count: 5 }, { type: "Double (small)", from: 1000, count: 7 }] }),
];

export type HotelFilter = "all" | "near" | "budget" | "family";
export type HotelSort = "distance" | "price";

/** Cheapest quoted nightly rate, or null when the institute list has no rate. */
export function fromRate(hotel: Hotel): number | null {
  const r = hotel.rooms.map((x) => x.from).filter((x): x is number => typeof x === "number");
  return r.length ? Math.min(...r) : null;
}

export function roomCount(hotel: Hotel) {
  return hotel.rooms.reduce((n, r) => n + (r.count ?? 0), 0);
}

const isFamily = (r: Room) => /triple|family|4|dorm/i.test(r.type);

export function filterHotels(list: Hotel[], f: HotelFilter, q: string, sort: HotelSort): Hotel[] {
  const s = q.trim().toLowerCase();
  const out = list.filter((x) => {
    if (f === "near" && x.km > 4.5) return false;
    if (f === "budget") { const p = fromRate(x); if (p === null || p > 2500) return false; }
    if (f === "family" && !x.rooms.some(isFamily)) return false;
    if (s && !`${x.name} ${x.area} ${x.address} ${x.rooms.map((r) => r.type).join(" ")}`.toLowerCase().includes(s)) return false;
    return true;
  });
  return out.sort((a, b) =>
    sort === "price" ? (fromRate(a) ?? Infinity) - (fromRate(b) ?? Infinity) || a.km - b.km : a.km - b.km,
  );
}

export const telHref = (p: string) => `tel:+91${p}`;
export const waHref = (p: string, name: string) =>
  `https://wa.me/91${p}?text=${encodeURIComponent(`Hello ${name}, I'm attending the 11th Pan-IIM WMC at IIM Shillong (27–29 Nov 2026). Are rooms available?`)}`;
export const mailHref = (e: string, name: string) =>
  `mailto:${e}?subject=${encodeURIComponent(`Room enquiry, 11th Pan-IIM WMC, 27–29 Nov 2026`)}&body=${encodeURIComponent(`Hello ${name},\n\nI'm attending the 11th Pan-IIM WMC at IIM Shillong. Could you share availability for `)}`;
export const mapsHref = (x: Hotel) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${x.name} Shillong`)}`;
export const listingHref = (x: Hotel, site: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${x.name} Shillong ${site === "Official site" ? "official website" : site}`)}`;
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
