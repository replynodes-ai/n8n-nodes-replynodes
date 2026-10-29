/**
 * Manual smoke test: calls the three free ReplyNodes endpoints once each, using the node's own
 * request builder, and prints what came back. Not run in CI. Usage: npm run smoke
 */
import type { IDataObject, INode } from 'n8n-workflow';
import { findOperation } from '../nodes/ReplyNodes/operations';
import { buildRequest, resolveFieldValues } from '../nodes/ReplyNodes/request';

const node: INode = {
	id: 'smoke',
	name: 'ReplyNodes',
	type: 'smoke',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

const checks: Array<[string, string, IDataObject, (res: Response, body: Buffer) => string]> = [
	[
		'brand',
		'getBrand',
		{ domain: 'replynodes.com' },
		(res, body) => {
			const json = JSON.parse(body.toString('utf8')) as IDataObject;
			if (json.domain !== 'replynodes.com') throw new Error('unexpected brand payload');
			return `name=${String(json.name)}`;
		},
	],
	[
		'brand',
		'getLogoImage',
		{ domain: 'replynodes.com' },
		(res, body) => {
			const type = res.headers.get('content-type') ?? '';
			if (!type.startsWith('image/')) throw new Error(`content-type ${type}`);
			return `${type}, ${body.byteLength} bytes`;
		},
	],
	[
		'web',
		'urlToMarkdown',
		{ url: 'https://example.com' },
		(res, body) => {
			const text = body.toString('utf8').trim();
			if (text.length === 0) throw new Error('empty markdown');
			return `${text.length} chars`;
		},
	],
];

async function main() {
	let failed = 0;
	for (const [resource, value, values, verify] of checks) {
		const operation = findOperation(resource, value);
		if (!operation) throw new Error(`unknown operation ${resource}/${value}`);
		const request = buildRequest(node, operation, resolveFieldValues(node, operation, values));
		const url = new URL(`${request.baseURL}${request.url}`);
		for (const [k, v] of Object.entries(request.qs ?? {})) url.searchParams.set(k, String(v));
		try {
			const res = await fetch(url, { headers: request.headers as Record<string, string> });
			const body = Buffer.from(await res.arrayBuffer());
			if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.toString('utf8').slice(0, 200)}`);
			const remaining = res.headers.get('x-ratelimit-remaining');
			console.log(
				`ok   ${value}: ${verify(res, body)}${remaining ? `, ${remaining} left today` : ''}`,
			);
		} catch (error) {
			failed++;
			console.log(`FAIL ${value}: ${(error as Error).message}`);
		}
	}
	process.exitCode = failed > 0 ? 1 : 0;
}

void main();
