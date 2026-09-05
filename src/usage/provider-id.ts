/**
 * pi's built-in catalog stores some provider identities under their
 * display-name form (the OpenCode Go model family is keyed as `OpenCode Go`)
 * while adapter ids and the user configuration use the canonical dash-form id
 * (`opencode-go`). Canonicalize to a shared lowercase dash form so both
 * spellings select the same usage adapter.
 */
export function canonicalProviderId(id: string | undefined): string {
	if (!id) return "";
	return id.trim().toLowerCase().replace(/\s+/g, "-");
}
