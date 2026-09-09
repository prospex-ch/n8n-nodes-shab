import type { IDataObject } from 'n8n-workflow';

import { classify } from './events';
import type { ShabPublication } from '../transport/shab';
import { sourceUrl } from '../transport/shab';
import { parseUid } from './uid';

/** One flattened publication row, plus the raw content when the user asked for it. */
export interface PublicationRow extends IDataObject {
	id: string;
	publicationNumber: string;
	publicationDate: string;
	publicationState: string;
	subRubric: string;
	language: string;
	cantons: string[];
	title: IDataObject | null;
	uid: string | null;
	companyName: string | null;
	eventTypes: string[];
	sourceUrl: string;
}

function pick(source: unknown, path: string[]): unknown {
	let cursor = source;
	for (const key of path) {
		if (cursor === null || typeof cursor !== 'object') return undefined;
		cursor = (cursor as IDataObject)[key];
	}
	return cursor;
}

/**
 * The UID a publication is about.
 *
 * HR01 carries only `commonsNew`, HR03 only `commonsActual`, HR02 both with
 * the same UID in each.
 */
export function publicationUid(publication: ShabPublication): string | null {
	for (const block of ['commonsActual', 'commonsNew']) {
		const raw = pick(publication.content, [block, 'company', 'uid']);
		if (typeof raw === 'string') {
			const parsed = parseUid(raw);
			if (parsed !== null) return parsed.dotted;
		}
	}
	return null;
}

export function publicationCompanyName(publication: ShabPublication): string | null {
	for (const block of ['commonsActual', 'commonsNew']) {
		const raw = pick(publication.content, [block, 'company', 'name']);
		if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
	}
	return null;
}

export function toRow(publication: ShabPublication, includeRawContent: boolean): PublicationRow {
	const { meta } = publication;

	const row: PublicationRow = {
		id: meta.id,
		publicationNumber: meta.publicationNumber,
		// The API returns midnight UTC; the day is the part that carries meaning.
		publicationDate: (meta.publicationDate ?? '').slice(0, 10),
		publicationState: meta.publicationState,
		subRubric: meta.subRubric,
		language: meta.language,
		cantons: meta.cantons ?? [],
		title: (meta.title as IDataObject) ?? null,
		uid: publicationUid(publication),
		companyName: publicationCompanyName(publication),
		eventTypes: classify(publication),
		sourceUrl: sourceUrl(publication),
	};

	if (includeRawContent) row.content = publication.content;

	return row;
}
