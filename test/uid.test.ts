/* Tests run under `node --test` and never ship: `files` in package.json is `dist` only. */
/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseUid, requireUid, sameUid } from '../dist/nodes/Shab/helpers/uid.js';

describe('parseUid', () => {
	it('accepts the three forms that appear in the wild', () => {
		for (const input of ['CHE-105.909.036', 'CHE105909036', '105909036', 'che105909036']) {
			assert.deepEqual(parseUid(input), {
				compact: 'CHE105909036',
				dotted: 'CHE-105.909.036',
			});
		}
	});

	it('tolerates surrounding whitespace', () => {
		assert.equal(parseUid('  CHE-105.909.036 ')?.compact, 'CHE105909036');
	});

	it('rejects anything else', () => {
		for (const input of ['', 'CHE-105.909.03', 'CHE1059090367', 'Nestlé AG', 'CH17030010013']) {
			assert.equal(parseUid(input), null, input);
		}
	});
});

describe('requireUid', () => {
	it('names the accepted forms when it throws', () => {
		assert.throws(() => requireUid('not-a-uid'), /CHE-123\.456\.789/);
	});
});

describe('sameUid', () => {
	it('compares across forms', () => {
		assert.equal(sameUid('CHE-105.909.036', 'CHE105909036'), true);
		assert.equal(sameUid('CHE-105.909.036', 'CHE-105.909.037'), false);
		assert.equal(sameUid(null, 'CHE105909036'), false);
	});
});
