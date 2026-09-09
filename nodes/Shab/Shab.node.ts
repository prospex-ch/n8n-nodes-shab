import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { publicationFields, publicationOperations } from './descriptions/PublicationDescription';
import type { EventType } from './helpers/events';
import { toRow } from './helpers/publication';
import { requireUid, sameUid } from './helpers/uid';
import { fetchPublications } from './transport/shab';
import type { ShabQuery } from './transport/shab';

/** A date parameter as SHAB wants it: a bare day. */
function asDay(value: string | undefined, fallback?: string): string | undefined {
	if (!value) return fallback;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return fallback;
	return parsed.toISOString().slice(0, 10);
}

export class Shab implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SHAB',
		name: 'shab',
		icon: { light: 'file:shab.svg', dark: 'file:shab.dark.svg' },
		group: ['input'],
		version: [1],
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Read commercial-register publications from the Swiss Official Gazette of Commerce',
		defaults: { name: 'SHAB' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		// The gazette is open: every endpoint this node calls answers
		// unauthenticated, so the package ships no credential.
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Publication', value: 'publication' }],
				default: 'publication',
			},
			...publicationOperations,
			...publicationFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returned: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'publication' && operation === 'getAll') {
					const rows = await publications.call(this, i);
					for (const row of rows) returned.push({ json: row, pairedItem: i });
					continue;
				}

				throw new NodeOperationError(
					this.getNode(),
					`Unknown operation "${operation}" on resource "${resource}"`,
					{ itemIndex: i },
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returned.push({ json: { error: (error as Error).message }, pairedItem: i });
					continue;
				}
				// The transport layer already raises NodeApiError and NodeOperationError.
				// Either constructor hands back an instance of its own class untouched,
				// so the item index is stamped first and the wrap below only rebuilds
				// errors that arrive raw.
				if (error instanceof NodeApiError || error instanceof NodeOperationError) {
					error.context.itemIndex = i;
				}
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject);
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returned];
	}
}

/** Publication → Get Many, split out because it carries the whole filter stack. */
async function publications(this: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	const filterBy = this.getNodeParameter('filterBy', i) as string;
	const limit = this.getNodeParameter('limit', i) as number;
	const options = this.getNodeParameter('publicationOptions', i, {}) as IDataObject;

	const query: ShabQuery = {
		dateStart: asDay(this.getNodeParameter('startDate', i) as string),
		dateEnd: asDay(this.getNodeParameter('endDate', i, '') as string, new Date().toISOString().slice(0, 10)),
		includeCancelled: options.includeCancelled === true,
		includeContent: true,
		language: (options.language as string) || undefined,
	};

	// The keyword index holds company names only, so a UID cannot be queried
	// for. Every publication carries its own UID in its content block, so a UID
	// filter reads the date range and matches there. Narrow the range: this
	// reads the whole register for every day it covers.
	let uidFilter: string | null = null;
	if (filterBy === 'uid') {
		uidFilter = requireUid(this.getNodeParameter('uid', i) as string).dotted;
	} else if (filterBy === 'name') {
		query.keyword = this.getNodeParameter('companyName', i) as string;
	}

	const cantons = new Set((options.cantons as string[]) ?? []);
	const subRubrics = new Set((options.subRubrics as string[]) ?? []);
	const eventTypes = new Set((options.eventTypes as EventType[]) ?? []);
	const includeRawContent = options.includeRawContent === true;

	// Every filter below runs on rows the API already sent, so the limit can
	// only stop the paging when none of them is set.
	const filtersLocally =
		uidFilter !== null || cantons.size > 0 || subRubrics.size > 0 || eventTypes.size > 0;
	if (!filtersLocally) query.limit = limit;

	const publicationList = await fetchPublications(this, query);
	const rows: IDataObject[] = [];

	for (const publication of publicationList) {
		// `subRubrics` and `cantons` are accepted by the API and ignored by it.
		if (subRubrics.size > 0 && !subRubrics.has(publication.meta.subRubric)) continue;
		if (cantons.size > 0 && !(publication.meta.cantons ?? []).some((c) => cantons.has(c))) continue;

		const row = toRow(publication, includeRawContent);
		if (uidFilter !== null && !sameUid(row.uid, uidFilter)) continue;
		if (eventTypes.size > 0 && !row.eventTypes.some((type) => eventTypes.has(type as EventType))) {
			continue;
		}

		rows.push(row);
		if (rows.length >= limit) break;
	}

	return rows;
}
