import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { triggerFields } from './descriptions/TriggerDescription';
import {
	TRIGGER_MANUAL_LOOKBACK_DAYS,
	TRIGGER_UID_MANUAL_LOOKBACK_DAYS,
} from './helpers/constants';
import type { EventType } from './helpers/events';
import { toRow } from './helpers/publication';
import { requireUid, sameUid } from './helpers/uid';
import { fetchPublications } from './transport/shab';
import type { ShabPublication, ShabQuery } from './transport/shab';

/**
 * What the last poll saw.
 *
 * A date alone is not enough. SHAB revises rows and files corrections against
 * a day that has already been read, so the watermark keeps the ids seen on the
 * newest day and lets everything older go.
 */
interface Watermark {
	lastDate?: string;
	seenIds?: string[];
}

function day(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function daysAgo(count: number): string {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() - count);
	return day(date);
}

// A polling trigger has no execute(), so an agent has nothing to call. The
// property is omitted rather than set, because the type admits only `true`.
// eslint-disable-next-line @n8n/community-nodes/node-usable-as-tool
export class ShabTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SHAB Trigger',
		name: 'shabTrigger',
		icon: { light: 'file:shab.svg', dark: 'file:shab.dark.svg' },
		group: ['trigger'],
		version: [1],
		subtitle: '={{ $parameter["watch"] }}',
		description:
			'Start a workflow when the commercial register publishes an entry about a company you watch',
		defaults: { name: 'SHAB Trigger' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		// The gazette is open, so the trigger needs no credential.
		properties: triggerFields,
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const staticData = this.getWorkflowStaticData('node') as Watermark;
		const manual = this.getMode() === 'manual';

		const watch = this.getNodeParameter('watch') as string;
		const options = this.getNodeParameter('triggerOptions', {}) as IDataObject;
		const cantons = new Set((this.getNodeParameter('cantons', []) as string[]) ?? []);
		const subRubrics = new Set((this.getNodeParameter('subRubrics', []) as string[]) ?? []);
		const eventTypes = new Set((this.getNodeParameter('eventTypes', []) as EventType[]) ?? []);
		const includeRawContent = options.includeRawContent === true;

		const lookbackDays = (options.lookbackDays as number) ?? 7;

		const baseQuery: ShabQuery = {
			dateEnd: day(new Date()),
			includeContent: true,
			language: (options.language as string) || undefined,
		};

		// A first run records where it got to and emits nothing, so switching
		// the workflow on does not replay the archive.
		const firstRun = staticData.lastDate === undefined;

		// A company publishes a handful of times a year, so a manual poll over
		// the default window comes back empty and Fetch Test Event reads that
		// as a broken node. A name watch is one keyword query, cheap enough to
		// run over a year to find a sample. A UID watch reads the whole
		// register for every day in the window, so its sample window is short.
		// A watch on everything keeps the window it is given: a day of the
		// whole register is never empty.
		const manualWindow =
			watch === 'name'
				? TRIGGER_MANUAL_LOOKBACK_DAYS
				: watch === 'uids'
					? TRIGGER_UID_MANUAL_LOOKBACK_DAYS
					: lookbackDays;
		const window = manual ? Math.max(lookbackDays, manualWindow) : lookbackDays;

		baseQuery.dateStart =
			!manual && !firstRun && staticData.lastDate !== undefined
				? staticData.lastDate
				: daysAgo(window);

		// The keyword index holds company names only, so a UID cannot be
		// queried for. Every publication carries its own UID in its content
		// block, so a UID watch reads the window whole and matches there.
		const wanted: string[] = [];
		const queries: ShabQuery[] = [];

		if (watch === 'uids') {
			const raw = (this.getNodeParameter('uids') as string)
				.split(',')
				.map((entry) => entry.trim())
				.filter((entry) => entry !== '');

			for (const entry of raw) wanted.push(requireUid(entry).dotted);
			// An empty list watches nothing, rather than everything.
			if (wanted.length === 0) return null;
			queries.push(baseQuery);
		} else if (watch === 'name') {
			queries.push({ ...baseQuery, keyword: this.getNodeParameter('companyName') as string });
		} else {
			queries.push(baseQuery);
		}

		const seen = new Set<string>();
		const collected: ShabPublication[] = [];
		for (const query of queries) {
			for (const publication of await fetchPublications(this, query)) {
				if (seen.has(publication.meta.id)) continue;
				seen.add(publication.meta.id);
				collected.push(publication);
			}
		}

		const previousIds = new Set(staticData.seenIds ?? []);
		const rows: IDataObject[] = [];
		let newestDate = staticData.lastDate ?? '';
		const newestIds = new Set<string>();

		for (const publication of collected) {
			if (subRubrics.size > 0 && !subRubrics.has(publication.meta.subRubric)) continue;
			if (cantons.size > 0 && !(publication.meta.cantons ?? []).some((c) => cantons.has(c))) continue;

			const row = toRow(publication, includeRawContent);
			if (wanted.length > 0 && !wanted.some((uid) => sameUid(row.uid, uid))) continue;
			if (eventTypes.size > 0 && !row.eventTypes.some((type) => eventTypes.has(type as EventType))) {
				continue;
			}

			const date = row.publicationDate;
			if (date > newestDate) {
				newestDate = date;
				newestIds.clear();
			}
			if (date === newestDate) newestIds.add(row.id);

			if (previousIds.has(row.id)) continue;
			rows.push(row);
		}

		if (manual) {
			// One recent row, so the shape is visible while the workflow is
			// being built. The watermark is left alone.
			return rows.length === 0 ? null : [[{ json: rows[rows.length - 1] }]];
		}

		staticData.lastDate = newestDate === '' ? day(new Date()) : newestDate;
		// A poll that returned nothing for the newest day keeps the ids it
		// already had, so a later revision of one of them is still recognised.
		if (newestIds.size > 0) staticData.seenIds = [...newestIds];

		if (firstRun || rows.length === 0) return null;

		return [rows.map((json) => ({ json }))];
	}
}
