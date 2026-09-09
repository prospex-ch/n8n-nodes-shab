/* Tests run under `node --test` and never ship: `files` in package.json is `dist` only. */
/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dedupe, fetchPublications } from '../dist/nodes/Shab/transport/shab.js';

function row(id: string, date: string, state = 'PUBLISHED') {
	return {
		meta: {
			id,
			publicationNumber: `HR02-${id}`,
			publicationState: state,
			publicationDate: `${date}T00:00:00.000Z`,
			subRubric: 'HR02',
		},
		content: {},
	};
}

/**
 * A faithful stand-in: it answers exactly the rows the requested range covers,
 * honours `pageRequest.size`, and reports the range's true total.
 */
function server(rows: ReturnType<typeof row>[]) {
	const requests: Array<{ start?: string; end?: string; size: number; page: number }> = [];
	const context = {
		getNode: () => ({ name: 'n', type: 't', typeVersion: 1 }),
		helpers: {
			httpRequest: async (options: { qs: Record<string, unknown> }) => {
				const start = options.qs['publicationDate.start'] as string | undefined;
				const end = options.qs['publicationDate.end'] as string | undefined;
				const size = Number(options.qs['pageRequest.size']);
				const page = Number(options.qs['pageRequest.page']);
				requests.push({ start, end, size, page });

				const matching = rows.filter((r) => {
					const day = r.meta.publicationDate.slice(0, 10);
					return (!start || day >= start) && (!end || day <= end);
				});
				return {
					content: matching.slice(page * size, (page + 1) * size),
					total: matching.length,
				};
			},
		},
	};
	return { context, requests };
}

/** `count` rows spread evenly over `days` consecutive days from 2026-08-01. */
function spread(days: number, count: number) {
	return Array.from({ length: count }, (_, i) => {
		const day = new Date(Date.UTC(2026, 7, 1 + (i % days))).toISOString().slice(0, 10);
		return row(`p${i}`, day);
	});
}

describe('fetchPublications', () => {
	it('reads a range that fits in one request without splitting it', async () => {
		const { context, requests } = server(spread(2, 2));

		// @ts-expect-error the fake carries only what the transport touches
		const rows = await fetchPublications(context, {
			dateStart: '2026-08-01',
			dateEnd: '2026-08-02',
		});

		assert.equal(rows.length, 2);
		// One probe plus one read.
		assert.equal(requests.length, 2);
		assert.equal(requests[0].size, 1);
	});

	it('halves a range too large for one request, and returns all of it', async () => {
		const all = spread(16, 5_000);
		const { context, requests } = server(all);

		// @ts-expect-error the fake carries only what the transport touches
		const rows = await fetchPublications(context, {
			dateStart: '2026-08-01',
			dateEnd: '2026-08-16',
		});

		assert.equal(rows.length, 5_000);
		assert.equal(new Set(rows.map((r) => r.meta.id)).size, 5_000);
		// It split, and never asked for a second page of any range.
		assert.ok(requests.some((r) => r.start !== '2026-08-01' || r.end !== '2026-08-16'));
		assert.ok(requests.every((r) => r.page === 0));
	});

	it('stops once the limit is reached', async () => {
		const { context } = server(spread(16, 5_000));

		// @ts-expect-error the fake carries only what the transport touches
		const rows = await fetchPublications(context, {
			dateStart: '2026-08-01',
			dateEnd: '2026-08-16',
			limit: 10,
		});

		assert.ok(rows.length >= 10);
		assert.ok(rows.length < 5_000);
	});
});

describe('dedupe', () => {
	it('lets a cancellation win over the publication it withdraws', () => {
		const rows = [row('a', '2026-08-01'), row('a', '2026-08-01', 'CANCELLED')];

		// @ts-expect-error the fake carries only what dedupe touches
		assert.equal(dedupe(rows).length, 1);
		// @ts-expect-error the fake carries only what dedupe touches
		assert.equal(dedupe(rows)[0].meta.publicationState, 'CANCELLED');
		// @ts-expect-error the fake carries only what dedupe touches
		assert.equal(dedupe([...rows].reverse())[0].meta.publicationState, 'CANCELLED');
	});
});
