package domain

func SupportedLocale(locale string) bool {
	return locale == "en-GB" || locale == "sw-KE" || locale == "hi-IN"
}
