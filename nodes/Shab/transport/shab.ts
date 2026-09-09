import type { IDataObject, IExecuteFunctions, IPollFunctions, JsonObject } from 'n8n-workflow';
import { NodeApiError, sleep } from 'n8n-workflow';

import {
	SHAB_BASE_URL,
	SHAB_MAX_ATTEMPTS,
	SHAB_MAX_PAGE_SIZE,
	SHAB_MIN_INTERVAL_MS,
	SHAB_TIMEOUT_MS,
	USER_AGENT,
} from '../helpers/constants';

export type ShabContext = IExecuteFunctions | IPollFunctions;

export interface ShabMeta extends IDataObject {
	id: string;
	publicationNumber: string;
	publicationState: string;
	publicationDate: string;
	rubric: string;
	subRubric: string;
	language: string;
	cantons: string[] | null;
	title: Record<string, string> | null;
}

export interface ShabPublication extends IDataObject {
	meta: ShabMeta;
	content: IDataObject | null;
}

export interface ShabQuery {
	dateStart?: string;
	dateEnd?: string;
	keyword?: string;
	language?: string;
	includeCancelled?: boolean;
	includeContent?: boolean;
	/** Stop paging once this many publications have come back. */
	limit?: number;
}

let lastRequestAt = 0;

async function throttle(): Promise<void> {
	const elapsed = Date.now() - lastRequestAt;
	if (lastRequestAt > 0 && elapsed < SHAB_MIN_INTERVAL_MS) {
		await sleep(SHAB_MIN_INTERVAL_MS - elapsed);
	}
	lastRequestAt = Date.now();
}

function statusOf(error: unknown): number | undefined {
	const candidate = error as { httpCode?: string; statusCode?: number; response?: { status?: number } };
	const raw = candidate?.statusCode ?? candidate?.response?.status ?? Number(candidate?.httpCode);
	return Number.isFinite(raw) ? Number(raw) : undefined;
}

interface ShabPage {
	content: ShabPublication[];
	total: number;
}

async function requestPage(
	context: ShabContext,
	query: ShabQuery,
	page: number,
	size: number,
): Promise<ShabPage> {
	// `publicationStates` carries the filter and also switches the `total`
	// field on: the response omits it when the parameter is absent. Comma
	// separated, because the bracketed array form axios would otherwise emit
	// is dropped by the server.
	const states = query.includeCancelled === true ? 'PUBLISHED,CANCELLED' : 'PUBLISHED';

	const qs: IDataObject = {
		tenant: 'shab',
		rubrics: 'HR',
		publicationStates: states,
		includeContent: query.includeContent !== false,
		'pageRequest.page': page,
		'pageRequest.size': size,
		// A total order, unlike publicationDate, which leaves the hundreds of
		// rows sharing a day in an arbitrary order.
		'pageRequest.sortOrders': 'publicationNumber ASC',
	};

	if (query.dateStart) qs['publicationDate.start'] = query.dateStart;
	if (query.dateEnd) qs['publicationDate.end'] = query.dateEnd;
	if (query.keyword) qs.keyword = query.keyword;
	// Singular. `languages` is accepted and silently ignored.
	if (query.language) qs.language = query.language;

	let lastError: unknown;
	for (let attempt = 0; attempt < SHAB_MAX_ATTEMPTS; attempt++) {
		await throttle();
		try {
			const body = (await context.helpers.httpRequest({
				method: 'GET',
				url: `${SHAB_BASE_URL}/publications`,
				qs,
				json: true,
				timeout: SHAB_TIMEOUT_MS,
				headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
			})) as { content?: ShabPublication[]; total?: number };

			return { content: body.content ?? [], total: body.total ?? 0 };
		} catch (error) {
			const status = statusOf(error);
			const retryable = status === undefined || status === 429 || status >= 500;
			if (!retryable || attempt + 1 === SHAB_MAX_ATTEMPTS) {
				throw new NodeApiError(context.getNode(), error as JsonObject);
			}
			lastError = error;
			await sleep(Math.min(0.5 * 2 ** attempt, 30) * 1000);
		}
	}

	throw new NodeApiError(context.getNode(), lastError as JsonObject);
}

/**
 * Collapse revisions of the same publication.
 *
 * SHAB republishes a row under the same id when it is corrected or withdrawn.
 * A cancellation is the later word on the same act, so it wins.
 */
export function dedupe(publications: ShabPublication[]): ShabPublication[] {
	const byId = new Map<string, ShabPublication>();

	for (const publication of publications) {
		const id = publication.meta?.id;
		if (!id) continue;

		const existing = byId.get(id);
		if (existing === undefined) {
			byId.set(id, publication);
			continue;
		}
		if (
			publication.meta.publicationState === 'CANCELLED' &&
			existing.meta.publicationState !== 'CANCELLED'
		) {
			byId.set(id, publication);
		}
	}

	return [...byId.values()];
}

/**
 * Two limits shape how a result set is read.
 *
 * The server refuses a search offset above 10,000, so no single query reaches
 * past five pages of 2,000. Worse, the index moves while it is being paged: the
 * register writes continuously, and reading a 10-day range page by page lost
 * between 0.8% and 1.6% of its rows, a different set each run, under every sort
 * order on offer.
 *
 * So a range is never paged. It is halved until it fits in one request, which
 * is a single consistent read. Only a single day holding more than 2,000
 * publications falls back to paging, and the register has never published one.
 */
const MAX_OFFSET = 10_000;

function addDays(day: string, count: number): string {
	const date = new Date(`${day}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + count);
	return date.toISOString().slice(0, 10);
}

function midpoint(start: string, end: string): string {
	const from = Date.parse(`${start}T00:00:00.000Z`);
	const to = Date.parse(`${end}T00:00:00.000Z`);
	return addDays(start, Math.floor(Math.floor((to - from) / 86_400_000) / 2));
}

/** Fetch every HR publication matching the query. */
export async function fetchPublications(
	context: ShabContext,
	query: ShabQuery,
): Promise<ShabPublication[]> {
	const collected: ShabPublication[] = [];
	await collect(context, query, collected);
	return dedupe(collected);
}

async function collect(
	context: ShabContext,
	query: ShabQuery,
	into: ShabPublication[],
): Promise<void> {
	if (query.limit !== undefined && into.length >= query.limit) return;

	// One row without its content, to size the range before reading it.
	const probe = await requestPage(context, { ...query, includeContent: false }, 0, 1);
	if (probe.total === 0) return;

	const splittable =
		query.dateStart !== undefined && query.dateEnd !== undefined && query.dateStart < query.dateEnd;

	if (probe.total > SHAB_MAX_PAGE_SIZE && splittable) {
		const middle = midpoint(query.dateStart as string, query.dateEnd as string);
		await collect(context, { ...query, dateEnd: middle }, into);
		await collect(context, { ...query, dateStart: addDays(middle, 1) }, into);
		return;
	}

	const size = Math.min(query.limit ?? SHAB_MAX_PAGE_SIZE, SHAB_MAX_PAGE_SIZE);
	let page = 0;
	let fetched = 0;

	for (;;) {
		const result = await requestPage(context, query, page, size);
		into.push(...result.content);
		fetched += result.content.length;

		if (result.content.length === 0) return;
		if (fetched >= result.total) return;
		if (query.limit !== undefined && into.length >= query.limit) return;

		page += 1;
		if (page * size >= MAX_OFFSET) return;
	}
}

/** The public page for one publication, which is what a reader wants in an alert. */
export function sourceUrl(publication: ShabPublication): string {
	return `https://www.shab.ch/#!/search/publications/detail/${publication.meta.id}`;
}
