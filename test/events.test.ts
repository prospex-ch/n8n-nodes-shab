/* Tests run under `node --test` and never ship: `files` in package.json is `dist` only. */
/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { classify } from '../dist/nodes/Shab/helpers/events.js';

interface Fixture {
	meta: { id: string; subRubric: string };
	content: Record<string, unknown>;
}

const fixtures = JSON.parse(
	readFileSync(new URL('./fixtures/publications.json', import.meta.url), 'utf8'),
) as Fixture[];

function byId(prefix: string): Fixture {
	const found = fixtures.find((publication) => publication.meta.id.startsWith(prefix));
	assert.ok(found, `no fixture starting ${prefix}`);
	return found;
}

describe('classify, against publications captured from the API', () => {
	it('reads a new registration as an incorporation', () => {
		assert.deepEqual(classify(byId('68aa542e')), ['INCORPORATION']);
	});

	it('reads a branch registration by its legal form', () => {
		assert.deepEqual(classify(byId('f225e0f2')), ['BRANCH_CREATED']);
	});

	it('reads a deletion', () => {
		assert.ok(classify(byId('fc014782')).includes('DELETED'));
	});

	it('emits in taxonomy order, beginning to end', () => {
		for (const publication of fixtures) {
			const events = classify(publication);
			const sorted = [...events].sort(
				(a, b) => classify(publication).indexOf(a) - classify(publication).indexOf(b),
			);
			assert.deepEqual(events, sorted);
		}
	});

	it('never emits a mutation event on a new registration', () => {
		for (const publication of fixtures.filter((p) => p.meta.subRubric === 'HR01')) {
			const events = classify(publication);
			assert.ok(!events.includes('NAME_CHANGED'), publication.meta.id);
			assert.ok(!events.includes('SEAT_MOVED'), publication.meta.id);
			assert.ok(!events.includes('OFFICERS_CHANGED'), publication.meta.id);
		}
	});

	it('reads entry into liquidation without calling it a rename', () => {
		const events = classify(byId('e9b5868d'));
		assert.ok(events.includes('LIQUIDATION'));
		assert.ok(!events.includes('NAME_CHANGED'));
	});

	it('leaves a seat that did not move alone', () => {
		const publication = {
			meta: { subRubric: 'HR02' },
			content: {
				commonsActual: { company: { seat: 'Locarno' } },
				commonsNew: { company: { seat: 'Locarno' } },
				// The register sets this on a street move inside the commune.
				transaction: { update: { changements: { seatChanged: true } } },
			},
		};
		assert.deepEqual(classify(publication), []);
	});

	it('reads a capital increase and ignores a decrease', () => {
		const base = {
			meta: { subRubric: 'HR02' },
			content: {
				commonsActual: { capital: [{ nominal: 100_000 }] },
				commonsNew: { capital: [{ nominal: 250_000 }] },
			},
		};
		assert.deepEqual(classify(base), ['CAPITAL_INCREASED']);

		const decrease = {
			meta: { subRubric: 'HR02' },
			content: {
				commonsActual: { capital: [{ nominal: 250_000 }] },
				commonsNew: { capital: [{ nominal: 100_000 }] },
			},
		};
		assert.deepEqual(classify(decrease), []);
	});

	it('reads an officer change from a labelled person block', () => {
		const publication = {
			meta: { subRubric: 'HR02' },
			content: {
				publicationText:
					'Muster AG, in Zug, CHE-100.000.000. Ausgeschiedene Personen und erloschene Unterschriften: Muster, Hans, von Zug, Direktor.',
			},
		};
		assert.deepEqual(classify(publication), ['OFFICERS_CHANGED']);
	});
});
