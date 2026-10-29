import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';
import { links } from '../nodes/ReplyNodes/links';
import {
	NODE_PACKAGE_VERSION,
	SOURCE_HEADER,
	SOURCE_VALUE,
	SOURCE_VERSION_HEADER,
} from '../nodes/ReplyNodes/request';

export class ReplyNodesApi implements ICredentialType {
	name = 'replyNodesApi';

	displayName = 'ReplyNodes API';

	documentationUrl =
		'https://platform.replynodes.com/api-keys?utm_source=n8n&utm_medium=integration&utm_campaign=n8n-node';

	icon = { light: 'file:replynodes.svg', dark: 'file:replynodes.dark.svg' } as const;

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'rn_live_...',
			description: `Your ReplyNodes API key. Create one for free at ${links.apiKeys}.`,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.replynodes.com',
			url: '/v1/agent/status',
			method: 'GET',
			headers: {
				[SOURCE_HEADER]: SOURCE_VALUE,
				[SOURCE_VERSION_HEADER]: NODE_PACKAGE_VERSION,
			},
		},
	};
}
