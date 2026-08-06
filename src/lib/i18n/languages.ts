export type LanguageCode = string;

export interface LanguageDef {
  code: LanguageCode;
  name: string;
  native: string;
  /** Voice/locale used for speech synthesis (no TTS voices exist for most of these). */
  voice: "sw-KE" | "en-US";
}

export const LANGUAGES: LanguageDef[] = [
  { code: "en", name: "English", native: "English", voice: "en-US" },
  { code: "sw", name: "Swahili", native: "Kiswahili", voice: "sw-KE" },
  { code: "ki", name: "Gikuyu", native: "Gĩkũyũ", voice: "sw-KE" },
  { code: "luy", name: "Luhya", native: "Oluluhya", voice: "sw-KE" },
  { code: "luo", name: "Luo", native: "Dholuo", voice: "sw-KE" },
  { code: "kam", name: "Kamba", native: "Kĩkamba", voice: "sw-KE" },
  { code: "kln", name: "Kalenjin", native: "Kalenjin", voice: "sw-KE" },
  { code: "kis", name: "Kisii", native: "Ekegusii", voice: "sw-KE" },
  { code: "mer", name: "Meru", native: "Kĩmĩrũ", voice: "sw-KE" },
  { code: "emb", name: "Embu", native: "Kĩembu", voice: "sw-KE" },
  { code: "mij", name: "Mijikenda", native: "Kimijikenda", voice: "sw-KE" },
  { code: "dig", name: "Digo", native: "Chidigo", voice: "sw-KE" },
  { code: "dug", name: "Duruma", native: "Chiduruma", voice: "sw-KE" },
  { code: "nyf", name: "Giryama", native: "Kigiryama", voice: "sw-KE" },
  { code: "swk", name: "Bajuni", native: "Kibajuni", voice: "sw-KE" },
  { code: "pkm", name: "Pokomo", native: "Kipokomo", voice: "sw-KE" },
  { code: "dav", name: "Taita", native: "Kidawida", voice: "sw-KE" },
  { code: "seg", name: "Segeju", native: "Kisegeju", voice: "sw-KE" },
  { code: "tur", name: "Turkana", native: "Ng’aturkana", voice: "sw-KE" },
  { code: "mas", name: "Maasai", native: "Maa", voice: "sw-KE" },
  { code: "saq", name: "Samburu", native: "Sampur", voice: "sw-KE" },
  { code: "pko", name: "Pokot", native: "Pökoot", voice: "sw-KE" },
  { code: "teo", name: "Teso", native: "Ateso", voice: "sw-KE" },
  { code: "kuj", name: "Kuria", native: "Igikuria", voice: "sw-KE" },
  { code: "sqm", name: "Suba", native: "Olusuba", voice: "sw-KE" },
  { code: "som", name: "Somali", native: "Soomaali", voice: "en-US" },
  { code: "gax", name: "Borana", native: "Boraana", voice: "sw-KE" },
  { code: "rel", name: "Rendille", native: "Rendille", voice: "sw-KE" },
  { code: "gbz", name: "Gabbra", native: "Gabra", voice: "sw-KE" },
  { code: "orc", name: "Orma", native: "Orma", voice: "sw-KE" },
  { code: "sgc", name: "Kipsigis", native: "Kipsigis", voice: "sw-KE" },
  { code: "niq", name: "Nandi", native: "Nandi", voice: "sw-KE" },
  { code: "enb", name: "Marakwet", native: "Markweeta", voice: "sw-KE" },
  { code: "tug", name: "Tugen", native: "Tugen", voice: "sw-KE" },
  { code: "spy", name: "Sabaot", native: "Sabaot", voice: "sw-KE" },
  { code: "ter", name: "Terik", native: "Terik", voice: "sw-KE" },
  { code: "oki", name: "Ogiek", native: "Ogiek", voice: "sw-KE" },
  { code: "sgw", name: "Sengwer", native: "Sengwer", voice: "sw-KE" },
  { code: "elm", name: "El Molo", native: "El Molo", voice: "sw-KE" },
  { code: "yaa", name: "Yaaku", native: "Yaakunte", voice: "sw-KE" },
  { code: "dah", name: "Dahalo", native: "Dahalo", voice: "sw-KE" },
  { code: "bon", name: "Boni / Aweer", native: "Aweer", voice: "sw-KE" },
  { code: "nub", name: "Nubi", native: "Ki-Nubi", voice: "sw-KE" },
  { code: "swa-sign", name: "Kenyan Sign Language", native: "KSL", voice: "en-US" },
];

/** Languages with reviewed, hand-written translations. */
export const CURATED_LANGUAGES = ["en", "sw", "ki"];

export function getLanguage(code: string): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** Maps a UI language onto the DB `preferred_language` enum (en | sw | ki). */
export function toDbLanguage(code: string): "en" | "sw" | "ki" {
  if (code === "en" || code === "sw" || code === "ki") return code;
  return getLanguage(code).voice === "en-US" ? "en" : "sw";
}

export const LANGUAGE_STORAGE_KEY = "neuroBridgeLanguage";
