import type { INodeProperties } from 'n8n-workflow';

import { CANTONS, LANGUAGES, SUB_RUBRICS } from '../helpers/constants';
import { EVENT_TYPES } from '../helpers/events';

/**
 * n8n injects its own Poll Times property into every polling trigger, so the
 * node cannot set the interval's default. This says what to set it to, next to
 * the field that sets it.
 */
const scheduleNotice: INodeProperties = {
	displayName:
		'SHAB publishes on working days. Set Poll Times to once a day: a shorter interval returns the same rows.',
	name: 'scheduleNotice',
	type: 'notice',
	default: '',
};

export const triggerFields: INodeProperties[] = [
	scheduleNotice,
	{
		displayName: 'Watch',
		name: 'watch',
		type: 'options',
		options: [
			{
				name: 'UID List',
				value: 'uids',
				description:
					'One row per company. The gazette cannot be queried by UID, so each poll reads every publication in the lookback window and matches the UID carried in each one.',
			},
			{
				name: 'Company Name',
				value: 'name',
				description: 'Search the SHAB keyword index',
			},
			{
				name: 'Everything',
				value: 'all',
				description: 'Every HR publication, narrowed by the filters below',
			},
		],
		default: 'uids',
	},
	{
		displayName: 'UIDs',
		name: 'uids',
		type: 'string',
		required: true,
		displayOptions: { show: { watch: ['uids'] } },
		default: '',
		placeholder: 'CHE-123.456.789, CHE-987.654.321',
		description: 'Comma-separated. CHE-123.456.789, CHE123456789 and 123456789 are all accepted.',
	},
	{
		displayName: 'Company Name',
		name: 'companyName',
		type: 'string',
		required: true,
		displayOptions: { show: { watch: ['name'] } },
		default: '',
		placeholder: 'Nestlé Suisse',
		description: 'Matched against the SHAB keyword index, which holds company names only',
	},
	{
		displayName: 'Cantons',
		name: 'cantons',
		type: 'multiOptions',
		options: CANTONS,
		default: [],
		description: 'Emit only publications filed in these cantons',
	},
	{
		displayName: 'Sub-Rubrics',
		name: 'subRubrics',
		type: 'multiOptions',
		options: SUB_RUBRICS,
		default: [],
		description: 'Emit only these sub-rubrics',
	},
	{
		displayName: 'Event Types',
		name: 'eventTypes',
		type: 'multiOptions',
		options: EVENT_TYPES.map((value) => ({ name: value, value })),
		default: [],
		description: 'Emit only publications carrying at least one of these events',
	},
	{
		displayName: 'Options',
		name: 'triggerOptions',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		options: [
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
				description: 'Emit only publications written in this language',
			},
			{
				displayName: 'Lookback Days',
				name: 'lookbackDays',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 30 },
				default: 7,
				description:
					'How far back each poll reads. A window wider than the poll interval covers a missed run and the revisions SHAB files against earlier days.',
			},
		],
	},
];
