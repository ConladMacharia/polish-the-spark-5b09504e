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
