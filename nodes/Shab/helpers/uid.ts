/**
 * Swiss UID parsing.
 *
 * Three input forms are accepted, because all three appear in the wild: the
 * official dotted form the gazette writes in `company.uid`, the compact form
 * the register stores internally, and the nine bare digits people paste out of
 * a spreadsheet column that lost its prefix.
 */

/** A UID in both forms the rest of the node needs. */
export interface ParsedUid {
	/** `CHE123456789`, the compact form, used here only to compare two UIDs. */
	compact: string;
	/** `CHE-123.456.789`, the official form, and the one SHAB writes in `company.uid`. */
	dotted: string;
}

const DIGITS_RE = /^(?:CHE)?[-\s]?(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})$/i;

/**
 * Parse a UID, or return `null` when the input is not one.
 *
 * The check digit is deliberately not verified: the registers publish UIDs
 * that fail it, and rejecting those would drop real companies.
 */
export function parseUid(input: string): ParsedUid | null {
	const match = DIGITS_RE.exec((input ?? '').trim());
	if (match === null) return null;

	const [, a, b, c] = match;
	return { compact: `CHE${a}${b}${c}`, dotted: `CHE-${a}.${b}.${c}` };
}

/** Parse a UID or throw a message naming the three accepted forms. */
export function requireUid(input: string): ParsedUid {
	const parsed = parseUid(input);
	if (parsed === null) {
		throw new Error(
			`"${input}" is not a Swiss UID. Accepted forms: CHE-123.456.789, CHE123456789, 123456789.`,
		);
	}
	return parsed;
}

/** Whether two UIDs in any accepted form denote the same company. */
export function sameUid(left: string | null | undefined, right: string | null | undefined): boolean {
	if (!left || !right) return false;
	const a = parseUid(left);
	const b = parseUid(right);
	return a !== null && b !== null && a.compact === b.compact;
}
