import {
	NodeConnectionTypes,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { CREDENTIAL_NAME, executeReplyNodes } from './execute';
import { links } from './links';
import { buildProperties } from './properties';

export class ReplyNodes implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ReplyNodes',
		name: 'replyNodes',
		icon: { light: 'file:replynodes.svg', dark: 'file:replynodes.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Turn URLs into Markdown, get brand data and logos from a domain, and search, scrape, map, or crawl the web',
		documentationUrl: links.docs,
		defaults: { name: 'ReplyNodes' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: CREDENTIAL_NAME, required: false }],
		properties: buildProperties(),
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return executeReplyNodes.call(this);
	}
}
