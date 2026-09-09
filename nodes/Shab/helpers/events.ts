/**
 * Event classification against the JSON `content` block of an HR publication.
 *
 * The identifiers match `shab-parser`'s taxonomy so a workflow can move
 * between the two without a mapping table. Three of that library's eleven
 * types are absent here: MERGER needs free-text extraction in three
 * languages, and both it and the person-level detail behind OFFICERS_CHANGED
 * sit outside what the JSON carries.
 */

import type { IDataObject } from 'n8n-workflow';

/** Emission order runs from a company's beginning to its end. */
export const EVENT_TYPES = [
	'INCORPORATION',
	'BRANCH_CREATED',
	'SEAT_MOVED',
	'ADDRESS_CHANGED',
	'NAME_CHANGED',
	'PURPOSE_CHANGED',
	'CAPITAL_INCREASED',
	'OFFICERS_CHANGED',
	'LIQUIDATION',
	'DELETED',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** The two legal forms a branch is registered under, per eCH-0097. */
const BRANCH_LEGAL_FORMS = new Set(['0111', '0151']);

/** `in Liquidation`, `en liquidation`, `in liquidazione`, and the abbreviations. */
const LIQUIDATION_RE =
	/\b(?:in liquidation|en liquidation|in liquidazione|in nachlassliquidation|in liq\.?)\b/i;

/**
 * The six labelled person-block headings, measured across the register.
 *
 * Geneva, Vaud and Neuchâtel write the same mutations as running prose and
 * publish no labelled block of any kind, so an officer change in those three
 * cantons is not detected here. `shab-parser` reads the prose form.
 */
const PERSON_BLOCK_HEADINGS = [
	'Eingetragene Personen neu oder mutierend:',
	'Ausgeschiedene Personen und erloschene Unterschriften:',
	'Inscription ou modification de personne(s):',
	'Personne(s) et signature(s) radiée(s):',
	'Nuove persone iscritte o modifiche:',
	'Persone dimissionarie e firme cancellate:',
];

/** Fribourg labels its own sections, in French and in German. */
const FRIBOURG_SECTION_RE =
	/(?:Personnes?\s+radi[ée]e?s?|Gel[öo]scht?e\s+Person(?:en?)?|Nouvelles?\s+[Pp]ersonnes?\s+inscrites?|Neu(?:e|es)?\s+[Ee]ingetrage?ne[nr]?\s+Person(?:en?)?|Personnes?\s+inscrites?\s+modifi[ée]e?s?|Person(?:en?)?\s+ge?[äa]ndert)\s*:/;

/** The register's own dissolution flags, under `transaction.update.changements`. */
const DISSOLUTION_PATHS = [
	['statusChanged', 'liquidation', 'dissolution', 'nonExceptional'],
	['statusChanged', 'liquidation', 'dissolution', 'or731b'],
	['statusChanged', 'liquidation', 'dissolution', 'hregv153b'],
	// A bankruptcy opening dissolves the company as a voluntary decision does,
	// and the register files it under its own branch.
	['statusChanged', 'bankruptcy', 'dissolution'],
];

function at(source: unknown, path: string[]): unknown {
	let cursor = source;
	for (const key of path) {
		if (cursor === null || typeof cursor !== 'object') return undefined;
		cursor = (cursor as IDataObject)[key];
	}
	return cursor;
}

function isTrue(source: unknown, path: string[]): boolean {
	return at(source, path) === true;
}

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/** The highest nominal amount in a capital block, or 0 when there is none. */
function nominal(commons: unknown): number {
	const capital = at(commons, ['capital']);
	if (!Array.isArray(capital)) return 0;

	const amounts = capital
		.map((entry) => Number((entry as IDataObject)?.nominal))
		.filter((amount) => Number.isFinite(amount));

	return amounts.length === 0 ? 0 : Math.max(...amounts);
}

/**
 * An address reduced to its sorted tokens.
 *
 * The register re-parses an address it has not changed: `street` "Route de la
 * Gare 1, case postale" with `houseNumber` "100" becomes `street` "Route de la
 * Gare", `houseNumber` "1" and a post-office box of 100, and `addressChanged`
 * is set on the publication that does it. The tokens are the same either way.
 */
function addressTokens(address: unknown): string {
	if (address === null || typeof address !== 'object') return '';

	const fields = [
		'street',
		'houseNumber',
		'postOfficeBoxNumber',
		'postOfficeBoxText',
		'addressLine1',
		'addressLine2',
		'swissZipCode',
		'foreignZipCode',
		'town',
		'country',
	];

	const raw = fields
		.map((field) => (address as IDataObject)[field])
		.filter((value) => typeof value === 'string' || typeof value === 'number')
		.join(' ')
		.toLowerCase();

	return raw
		.split(/[^0-9a-zà-öø-ÿ]+/)
		.filter((token) => token !== '')
		.sort()
		.join(' ');
}

/** A name with any liquidation qualifier removed, for comparing the name itself. */
function withoutLiquidation(name: string): string {
	return name.replace(LIQUIDATION_RE, '').replace(/[\s,]+$/, '').trim();
}

/**
 * Classify one publication.
 *
 * Two of the register's own change flags are deliberately not trusted.
 * `seatChanged` is set on a street-address move inside the same commune, so
 * SEAT_MOVED reads the old and new seats instead. `nameChanged` is left false
 * on most renames the register nonetheless publishes, so NAME_CHANGED reads
 * the old and new names.
 */
export function classify(publication: {
	meta?: { subRubric?: string };
	content?: IDataObject | null;
}): EventType[] {
	const subRubric = publication.meta?.subRubric ?? '';
	const content = publication.content ?? {};
	const actual = at(content, ['commonsActual']);
	const brandNew = at(content, ['commonsNew']);
	const changements = at(content, ['transaction', 'update', 'changements']);
	const publicationText = text(at(content, ['publicationText']));

	const found = new Set<EventType>();

	const priorName = text(at(actual, ['company', 'name']));
	const newName = text(at(brandNew, ['company', 'name']));

	if (subRubric === 'HR01') {
		const legalForm = text(at(brandNew, ['company', 'legalForm']));
		found.add(BRANCH_LEGAL_FORMS.has(legalForm) ? 'BRANCH_CREATED' : 'INCORPORATION');
	}

	if (subRubric === 'HR02') {
		const priorSeat = text(at(actual, ['company', 'seat']));
		const newSeat = text(at(brandNew, ['company', 'seat']));
		if (priorSeat && newSeat && priorSeat !== newSeat) found.add('SEAT_MOVED');

		const priorAddress = addressTokens(at(actual, ['company', 'address']));
		const newAddress = addressTokens(at(brandNew, ['company', 'address']));
		if (isTrue(changements, ['addressChanged']) && priorAddress !== newAddress) {
			found.add('ADDRESS_CHANGED');
		}

		// A name whose only change is gaining or losing the liquidation
		// qualifier states the liquidation, and LIQUIDATION already says it.
		if (
			priorName &&
			newName &&
			priorName !== newName &&
			withoutLiquidation(priorName) !== withoutLiquidation(newName)
		) {
			found.add('NAME_CHANGED');
		}

		const priorPurpose = text(at(actual, ['purpose']));
		const newPurpose = text(at(brandNew, ['purpose']));
		if (isTrue(changements, ['purposeChanged']) || (priorPurpose && newPurpose && priorPurpose !== newPurpose)) {
			found.add('PURPOSE_CHANGED');
		}

		if (nominal(brandNew) > nominal(actual)) found.add('CAPITAL_INCREASED');

		// Detection only. The names, roles and signature rights behind the
		// change stay in `publicationText` for a parser to read.
		if (
			PERSON_BLOCK_HEADINGS.some((heading) => publicationText.includes(heading)) ||
			FRIBOURG_SECTION_RE.test(publicationText)
		) {
			found.add('OFFICERS_CHANGED');
		}
	}

	if (subRubric === 'HR03') found.add('DELETED');

	// Entry into liquidation, never the standing fact of being in it: either
	// the register sets a dissolution flag, or the legal name picks up a
	// qualifier it did not carry before.
	const dissolved = DISSOLUTION_PATHS.some((path) => isTrue(changements, path));
	const entered =
		priorName !== '' &&
		newName !== '' &&
		!LIQUIDATION_RE.test(priorName) &&
		LIQUIDATION_RE.test(newName);

	if (dissolved || entered) found.add('LIQUIDATION');

	return EVENT_TYPES.filter((eventType) => found.has(eventType));
}
