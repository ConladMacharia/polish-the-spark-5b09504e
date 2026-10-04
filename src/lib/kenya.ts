// Lists used by the location and specialist-request forms.

export const KENYA_COUNTIES = [
  "Baringo",
  "Bomet",
  "Bungoma",
  "Busia",
  "Elgeyo-Marakwet",
  "Embu",
  "Garissa",
  "Homa Bay",
  "Isiolo",
  "Kajiado",
  "Kakamega",
  "Kericho",
  "Kiambu",
  "Kilifi",
  "Kirinyaga",
  "Kisii",
  "Kisumu",
  "Kitui",
  "Kwale",
  "Laikipia",
  "Lamu",
  "Machakos",
  "Makueni",
  "Mandera",
  "Marsabit",
  "Meru",
  "Migori",
  "Mombasa",
  "Murang'a",
  "Nairobi",
  "Nakuru",
  "Nandi",
  "Narok",
  "Nyamira",
  "Nyandarua",
  "Nyeri",
  "Samburu",
  "Siaya",
  "Taita-Taveta",
  "Tana River",
  "Tharaka-Nithi",
  "Trans-Nzoia",
  "Turkana",
  "Uasin Gishu",
  "Vihiga",
  "Wajir",
  "West Pokot",
] as const;

export const SPECIALIST_NEEDS = [
  { value: "occupational_therapy", label: "Occupational therapy" },
  { value: "physiotherapy", label: "Physiotherapy" },
  { value: "speech_swallowing", label: "Speech and swallowing" },
  { value: "mobility_seating", label: "Mobility aids and seating" },
  { value: "splints_orthotics", label: "Hand splints / orthotics" },
] as const;

export const FUNDERS = [
  { value: "self", label: "My family pays" },
  { value: "county", label: "County programme" },
  { value: "ngo", label: "NGO / charity programme" },
] as const;

export const needLabel = (value: string) =>
  SPECIALIST_NEEDS.find((n) => n.value === value)?.label ?? value;

export const PROFESSIONS = [
  { value: "occupational_therapist", label: "Occupational therapist" },
  { value: "physiotherapist", label: "Physiotherapist" },
  { value: "speech_language_therapist", label: "Speech and language therapist" },
  { value: "orthotist", label: "Orthotist" },
] as const;

export const professionLabel = (value: string | null | undefined) =>
  PROFESSIONS.find((p) => p.value === value)?.label ?? "Therapist";

/**
 * Approximate centre (usually the county headquarters) of each county.
 * Used only to estimate how far a therapist is from a child; it is NOT an
 * exact address, so distances are shown as "about".
 */
export const COUNTY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  Baringo: { lat: 0.4919, lng: 35.743 },
  Bomet: { lat: -0.7813, lng: 35.3416 },
  Bungoma: { lat: 0.5635, lng: 34.5606 },
  Busia: { lat: 0.4608, lng: 34.1115 },
  "Elgeyo-Marakwet": { lat: 0.6703, lng: 35.5081 },
  Embu: { lat: -0.5389, lng: 37.4596 },
  Garissa: { lat: -0.4532, lng: 39.6461 },
  "Homa Bay": { lat: -0.5273, lng: 34.4571 },
  Isiolo: { lat: 0.3546, lng: 37.5822 },
  Kajiado: { lat: -1.8523, lng: 36.782 },
  Kakamega: { lat: 0.2827, lng: 34.7519 },
  Kericho: { lat: -0.3689, lng: 35.2863 },
  Kiambu: { lat: -1.1714, lng: 36.8356 },
  Kilifi: { lat: -3.6305, lng: 39.8499 },
  Kirinyaga: { lat: -0.4989, lng: 37.2803 },
  Kisii: { lat: -0.6817, lng: 34.7667 },
  Kisumu: { lat: -0.0917, lng: 34.768 },
  Kitui: { lat: -1.3667, lng: 38.0106 },
  Kwale: { lat: -4.1737, lng: 39.4521 },
  Laikipia: { lat: 0.007, lng: 37.0722 },
  Lamu: { lat: -2.2696, lng: 40.902 },
  Machakos: { lat: -1.5177, lng: 37.2634 },
  Makueni: { lat: -1.7804, lng: 37.6288 },
  Mandera: { lat: 3.9366, lng: 41.867 },
  Marsabit: { lat: 2.3284, lng: 37.9899 },
  Meru: { lat: 0.0467, lng: 37.6559 },
  Migori: { lat: -1.0634, lng: 34.4731 },
  Mombasa: { lat: -4.0435, lng: 39.6682 },
  "Murang'a": { lat: -0.721, lng: 37.1526 },
  Nairobi: { lat: -1.2864, lng: 36.8172 },
  Nakuru: { lat: -0.3031, lng: 36.08 },
  Nandi: { lat: 0.2022, lng: 35.105 },
  Narok: { lat: -1.0783, lng: 35.8601 },
  Nyamira: { lat: -0.5633, lng: 34.9358 },
  Nyandarua: { lat: -0.27, lng: 36.38 },
  Nyeri: { lat: -0.4201, lng: 36.9476 },
  Samburu: { lat: 1.0966, lng: 36.699 },
  Siaya: { lat: 0.0607, lng: 34.2881 },
  "Taita-Taveta": { lat: -3.396, lng: 38.556 },
  "Tana River": { lat: -1.5, lng: 40.03 },
  "Tharaka-Nithi": { lat: -0.3333, lng: 37.65 },
  "Trans-Nzoia": { lat: 1.0191, lng: 35.002 },
  Turkana: { lat: 3.1191, lng: 35.5973 },
  "Uasin Gishu": { lat: 0.5143, lng: 35.2698 },
  Vihiga: { lat: 0.0833, lng: 34.7167 },
  Wajir: { lat: 1.7471, lng: 40.0573 },
  "West Pokot": { lat: 1.2389, lng: 35.1119 },
};

/** Straight-line distance in km between two points on the map. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
