/* Tests run under `node --test` and never ship: `files` in package.json is `dist` only. */
/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ShabTrigger } from '../dist/nodes/Shab/ShabTrigger.node.js';

function publication(id: string, date: string, state = 'PUBLISHED') {
	return {
		meta: {
			id,
			publicationNumber: `HR02-${id}`,
			publicationState: state,
			publicationDate: `${date}T00:00:00.000Z`,
			rubric: 'HR',
			subRubric: 'HR02',
			language: 'de',
			cantons: ['ZH'],
			title: { de: 'Mutation' },
		},
		content: {
			commonsActual: { company: { name: 'Muster AG', uid: 'CHE-100.000.000', seat: 'Zürich' } },
			commonsNew: { company: { name: 'Muster AG', uid: 'CHE-100.000.000', seat: 'Winterthur' } },
		},
	};
}

/**
 * A poll context serving one fixed result set.
 *
 * The transport sizes a date range with a one-row probe before reading it, so
 * the fake answers `pageRequest.size === 1` with the count and one row, and
 * every other request with the whole set.
 */
function pollContext(
	rows: ReturnType<typeof publication>[],
	staticData: Record<string, unknown>,
	mode = 'trigger',
	overrides: Record<string, unknown> = {},
) {
	const requests: Array<Record<string, unknown>> = [];
	return {
		staticData,
		requests,
		getMode: () => mode,
		getNode: () => ({ name: 'Trigger', type: 'shabTrigger', typeVersion: 1 }),
		getWorkflowStaticData: () => staticData,
		getNodeParameter: (name: string, fallback?: unknown) => {
			const values: Record<string, unknown> = {
				watch: 'all',
				cantons: [],
				subRubrics: [],
				eventTypes: [],
				triggerOptions: {},
				...overrides,
			};
			return name in values ? values[name] : fallback;
		},
		helpers: {
			httpRequest: async (options: { qs: Record<string, unknown> }) => {
				requests.push(options.qs);
				const probe = options.qs['pageRequest.size'] === 1;
				return { content: probe ? rows.slice(0, 1) : rows, total: rows.length };
			},
		},
	};
}

const trigger = new ShabTrigger();

describe('trigger watermark', () => {
	it('records where it got to on the first run and emits nothing', async () => {
		const staticData: Record<string, unknown> = {};
		const ctx = pollContext([publication('a', '2026-08-25')], staticData);

		// @ts-expect-error the fake carries only what poll() touches
		const result = await trigger.poll.call(ctx);

		assert.equal(result, null);
		assert.equal(staticData.lastDate, '2026-08-25');
		assert.deepEqual(staticData.seenIds, ['a']);
	});

	it('emits a publication it has not seen', async () => {
		const staticData: Record<string, unknown> = { lastDate: '2026-08-25', seenIds: ['a'] };
		const ctx = pollContext(
			[publication('a', '2026-08-25'), publication('b', '2026-08-26')],
			staticData,
		);

		// @ts-expect-error the fake carries only what poll() touches
		const result = await trigger.poll.call(ctx);

		assert.equal(result?.[0].length, 1);
		assert.equal(result?.[0][0].json.id, 'b');
		assert.equal(staticData.lastDate, '2026-08-26');
		assert.deepEqual(staticData.seenIds, ['b']);
	});

	it('emits nothing on a second poll that returns the same rows', async () => {
		const staticData: Record<string, unknown> = { lastDate: '2026-08-26', seenIds: ['b'] };
		const ctx = pollContext([publication('b', '2026-08-26')], staticData);

		// @ts-expect-error the fake carries only what poll() touches
		assert.equal(await trigger.poll.call(ctx), null);
	});

	it('emits a revision the register filed against a day it already read', async () => {
		const staticData: Record<string, unknown> = { lastDate: '2026-08-26', seenIds: ['b'] };
		const ctx = pollContext(
			[publication('b', '2026-08-26'), publication('c', '2026-08-26')],
			staticData,
		);

		// @ts-expect-error the fake carries only what poll() touches
		const result = await trigger.poll.call(ctx);

		assert.equal(result?.[0].length, 1);
		assert.equal(result?.[0][0].json.id, 'c');
		assert.deepEqual((staticData.seenIds as string[]).sort(), ['b', 'c']);
	});

	it('returns one item in manual mode and leaves the watermark alone', async () => {
		const staticData: Record<string, unknown> = { lastDate: '2026-08-20', seenIds: [] };
		const ctx = pollContext(
			[publication('a', '2026-08-25'), publication('b', '2026-08-26')],
			staticData,
			'manual',
		);

		// @ts-expect-error the fake carries only what poll() touches
		const result = await trigger.poll.call(ctx);

		assert.equal(result?.[0].length, 1);
		assert.equal(staticData.lastDate, '2026-08-20');
	});
});

describe('trigger UID watch', () => {
	it('matches the UID in the publication, without asking the gazette for it', async () => {
		const staticData: Record<string, unknown> = { lastDate: '2026-08-25', seenIds: [] };
		const ctx = pollContext([publication('a', '2026-08-26')], staticData, 'trigger', {
			watch: 'uids',
			uids: 'CHE-100.000.000',
		});

		// @ts-expect-error the fake carries only what poll() touches
		const result = await trigger.poll.call(ctx);

		assert.equal(result?.[0].length, 1);
		assert.equal(result?.[0][0].json.uid, 'CHE-100.000.000');
		// The keyword index holds names only, so a UID watch never sends one.
		assert.ok(ctx.requests.every((qs) => qs.keyword === undefined));
	});

	it('accepts the compact and bare forms of the same UID', async () => {
		for (const uids of ['CHE100000000', '100000000', ' che-100.000.000 ']) {
			const staticData: Record<string, unknown> = { lastDate: '2026-08-25', seenIds: [] };
			const ctx = pollContext([publication('a', '2026-08-26')], staticData, 'trigger', {
				watch: 'uids',
				uids,
			});

			// @ts-expect-error the fake carries only what poll() touches
			assert.equal((await trigger.poll.call(ctx))?.[0].length, 1, uids);
		}
	});

	it('drops a publication about another company', async () => {
		const staticData: Record<string, unknown> = { lastDate: '2026-08-25', seenIds: [] };
		const ctx = pollContext([publication('a', '2026-08-26')], staticData, 'trigger', {
			watch: 'uids',
			uids: 'CHE-999.999.999',
		});

		// @ts-expect-error the fake carries only what poll() touches
		assert.equal(await trigger.poll.call(ctx), null);
	});

	it('watches nothing, rather than everything, on an empty list', async () => {
		const staticData: Record<string, unknown> = { lastDate: '2026-08-25', seenIds: [] };
		const ctx = pollContext([publication('a', '2026-08-26')], staticData, 'trigger', {
			watch: 'uids',
			uids: '  ,  ',
		});

		// @ts-expect-error the fake carries only what poll() touches
		assert.equal(await trigger.poll.call(ctx), null);
		assert.equal(ctx.requests.length, 0);
	});

	it('rejects a malformed UID before any request goes out', async () => {
		const staticData: Record<string, unknown> = { lastDate: '2026-08-25', seenIds: [] };
		const ctx = pollContext([publication('a', '2026-08-26')], staticData, 'trigger', {
			watch: 'uids',
			uids: 'Nestlé AG',
		});

		// @ts-expect-error the fake carries only what poll() touches
		await assert.rejects(trigger.poll.call(ctx), /CHE-123\.456\.789/);
		assert.equal(ctx.requests.length, 0);
	});
});
