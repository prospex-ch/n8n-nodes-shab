import type { INodeProperties } from 'n8n-workflow';

import { CANTONS, LANGUAGES, SUB_RUBRICS } from '../helpers/constants';
import { EVENT_TYPES } from '../helpers/events';

export const publicationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['publication'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Read commercial-register publications from SHAB',
				action: 'Get many publications',
			},
		],
		default: 'getAll',
	},
];

export const publicationFields: INodeProperties[] = [
	{
		displayName: 'Filter By',
		name: 'filterBy',
		type: 'options',
		displayOptions: { show: { resource: ['publication'], operation: ['getAll'] } },
		options: [
			{
				name: 'UID',
				value: 'uid',
				description:
					'Keep only publications whose own content block carries this UID. The gazette cannot be queried by UID, so this reads every publication in the date range: keep the range short.',
			},
			{ name: 'Company Name', value: 'name', description: 'Search the SHAB keyword index' },
			{ name: 'Date Range Only', value: 'all', description: 'Every HR publication in the range' },
		],
		default: 'uid',
	},
	{
		displayName: 'UID',
		name: 'uid',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['publication'], operation: ['getAll'], filterBy: ['uid'] } },
		default: '',
		placeholder: 'CHE-123.456.789',
		description:
			'CHE-123.456.789, CHE123456789 and 123456789 are all accepted. Matched against the UID in each publication\'s content block, after the whole date range has been read.',
	},
	{
		displayName: 'Company Name',
		name: 'companyName',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['publication'], operation: ['getAll'], filterBy: ['name'] } },
		default: '',
		placeholder: 'Nestlé Suisse',
		description: 'Matched against the SHAB keyword index, which holds company names only',
	},
	{
		displayName: 'Start Date',
		name: 'startDate',
		type: 'dateTime',
		required: true,
		displayOptions: { show: { resource: ['publication'], operation: ['getAll'] } },
		default: '',
		description: 'Earliest publication date to return',
	},
	{
		displayName: 'End Date',
		name: 'endDate',
		type: 'dateTime',
		displayOptions: { show: { resource: ['publication'], operation: ['getAll'] } },
		default: '',
		description: 'Latest publication date to return. Defaults to today.',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		displayOptions: { show: { resource: ['publication'], operation: ['getAll'] } },
		default: 50,
		description: 'Max number of results to return',
	},
	{
		displayName: 'Options',
		name: 'publicationOptions',
		type: 'collection',
		placeholder: 'Add option',
		displayOptions: { show: { resource: ['publication'], operation: ['getAll'] } },
		default: {},
		options: [
			{
				displayName: 'Cantons',
				name: 'cantons',
				type: 'multiOptions',
				options: CANTONS,
				default: [],
				description: 'Keep only publications filed in these cantons. Applied after the request.',
			},
			{
				displayName: 'Event Types',
				name: 'eventTypes',
				type: 'multiOptions',
				options: EVENT_TYPES.map((value) => ({ name: value, value })),
				default: [],
				description: 'Keep only publications carrying at least one of these events',
			},
			{
				displayName: 'Include Cancelled',
				name: 'includeCancelled',
				type: 'boolean',
				default: false,
				description: 'Whether to include publications the register has withdrawn',
			},
			{
				displayName: 'Include Raw Content',
				name: 'includeRawContent',
				type: 'boolean',
				default: false,
				description: 'Whether to attach the full structured content block to every row',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'options',
				options: LANGUAGES,
				default: '',
				description: 'Keep only publications written in this language',
			},
			{
				displayName: 'Sub-Rubrics',
				name: 'subRubrics',
				type: 'multiOptions',
				options: SUB_RUBRICS,
				default: [],
				description: 'Keep only these sub-rubrics. Applied after the request.',
			},
		],
	},
];
