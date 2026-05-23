// Common locales offered in the UI. The Project's actual locales are
// resolved at runtime from the DB — this list is just the catalog the
// dropdowns pick from.
export const LOCALES = [
	{ code: "en", name: "English" },
	{ code: "fr", name: "Français" },
	{ code: "es", name: "Español" },
	{ code: "de", name: "Deutsch" },
	{ code: "it", name: "Italiano" },
	{ code: "pt", name: "Português" },
	{ code: "nl", name: "Nederlands" },
	{ code: "ru", name: "Русский" },
	{ code: "ja", name: "日本語" },
	{ code: "zh", name: "中文" },
	{ code: "ko", name: "한국어" },
	{ code: "ar", name: "العربية" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];

export function localeName(code: string): string {
	return LOCALES.find((l) => l.code === code)?.name ?? code;
}
