/** Shared constants: the host, pacing, and the fixed option lists. */

import { version } from '../../../package.json';

/** The canonical Amtsblattportal host. `www.shab.ch/api/v1` mirrors it. */
export const SHAB_BASE_URL = 'https://amtsblattportal.ch/api/v1';

export const SHAB_MIN_INTERVAL_MS = 1_000;
export const SHAB_MAX_ATTEMPTS = 4;
export const SHAB_TIMEOUT_MS = 30_000;
export const SHAB_MAX_PAGE_SIZE = 2_000;

/**
 * How far a manual poll reads back on a keyword watch.
 *
 * A single company publishes a handful of times a year, so the default window
 * comes back empty and Fetch Test Event reads that as a broken node. A name
 * watch is one keyword query, cheap enough to run over a year.
 */
export const TRIGGER_MANUAL_LOOKBACK_DAYS = 365;

/**
 * How far a manual poll reads back on a UID watch.
 *
 * A UID is not in the keyword index, so a UID watch reads every HR publication
 * in the window and matches locally. That is a few thousand rows a week, so the
 * sample window has to stay short enough to finish while someone waits.
 */
export const TRIGGER_UID_MANUAL_LOOKBACK_DAYS = 30;

/** The 26 cantons, keyed by the two-letter code the gazette publishes. */
export const CANTONS: Array<{ name: string; value: string }> = [
	{ name: 'Aargau', value: 'AG' },
	{ name: 'Appenzell Ausserrhoden', value: 'AR' },
	{ name: 'Appenzell Innerrhoden', value: 'AI' },
	{ name: 'Basel-Landschaft', value: 'BL' },
	{ name: 'Basel-Stadt', value: 'BS' },
	{ name: 'Bern', value: 'BE' },
	{ name: 'Fribourg', value: 'FR' },
	{ name: 'Geneva', value: 'GE' },
	{ name: 'Glarus', value: 'GL' },
	{ name: 'Graubünden', value: 'GR' },
	{ name: 'Jura', value: 'JU' },
	{ name: 'Lucerne', value: 'LU' },
	{ name: 'Neuchâtel', value: 'NE' },
	{ name: 'Nidwalden', value: 'NW' },
	{ name: 'Obwalden', value: 'OW' },
	{ name: 'Schaffhausen', value: 'SH' },
	{ name: 'Schwyz', value: 'SZ' },
	{ name: 'Solothurn', value: 'SO' },
	{ name: 'St. Gallen', value: 'SG' },
	{ name: 'Thurgau', value: 'TG' },
	{ name: 'Ticino', value: 'TI' },
	{ name: 'Uri', value: 'UR' },
	{ name: 'Valais', value: 'VS' },
	{ name: 'Vaud', value: 'VD' },
	{ name: 'Zug', value: 'ZG' },
	{ name: 'Zürich', value: 'ZH' },
];

/** The three commercial-register sub-rubrics. */
export const SUB_RUBRICS: Array<{ name: string; value: string; description: string }> = [
	{ name: 'HR01 New Registrations', value: 'HR01', description: 'A company entered the register' },
	{ name: 'HR02 Mutations', value: 'HR02', description: 'An existing entry changed' },
	{ name: 'HR03 Deletions', value: 'HR03', description: 'A company left the register' },
];

export const LANGUAGES: Array<{ name: string; value: string }> = [
	{ name: 'German', value: 'de' },
	{ name: 'French', value: 'fr' },
	{ name: 'Italian', value: 'it' },
];

/** Sent on every request so an operator reading their logs knows who to contact. */
export const USER_AGENT = `n8n-nodes-shab/${version} (+https://github.com/prospex-ch/n8n-nodes-shab)`;
