import assert from 'node:assert/strict';
import test from 'node:test';
import type { INodeProperties } from 'n8n-workflow';
import { ReplyNodesApi } from '../../credentials/ReplyNodesApi.credentials';
import { ReplyNodes } from '../../nodes/ReplyNodes/ReplyNodes.node.ts';
import {
	API_BASE_URL,
	operations,
	type OperationDefinition,
} from '../../nodes/ReplyNodes/operations';
import { buildProperties } from '../../nodes/ReplyNodes/properties';

test('operation values are unique per resource', () => {
	const keys = operations.map((op) => `${op.resource}/${op.value}`);
	assert.equal(new Set(keys).size, keys.length);
});

test('every path placeholder has a path parameter and a field that fills it', () => {
	for (const op of operations) {
		const placeholders = [...op.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
		assert.deepEqual(
			placeholders,
			(op.pathParameters ?? []).map((p) => p.name),
			`${op.value} path parameters`,
		);
		for (const name of placeholders) {
			assert.ok(
				op.fields?.some((f) => f.required && f.sendAs.in === 'path' && f.sendAs.key === name),
				`${op.value} has a required field for {${name}}`,
			);
		}
	}
});

test('only API host operations can use a key', () => {
	for (const op of operations) {
		if (op.baseURL === API_BASE_URL) {
			assert.notEqual(op.auth, 'none', `${op.value} on the API host`);
		} else {
			assert.equal(op.auth, 'none', `${op.value} on a free host`);
		}
	}
});

test('descriptions tell AI agents whether a key is needed', () => {
	for (const op of operations) {
		const expected = {
			none: /Free, no API key needed\.$/,
			optional: /Works without an API key up to a daily limit\.$/,
			required: /Requires a ReplyNodes API key\.$/,
		}[op.auth];
		assert.match(op.description, expected, op.value);
	}
});

test('node description is version 1, usable as a tool, with an optional credential', () => {
	const { description } = new ReplyNodes();
	assert.equal(description.version, 1);
	assert.equal(description.usableAsTool, true);
	assert.deepEqual(description.credentials, [{ name: 'replyNodesApi', required: false }]);
});

test('operation options are sorted and cover the whole table', () => {
	const selectors = buildProperties().filter((p) => p.name === 'operation');
	const listed = selectors.flatMap((p) =>
		(p.options ?? []).map((o) => (o as { value: string }).value),
	);
	assert.deepEqual([...listed].sort(), operations.map((op) => op.value).sort());
	for (const selector of selectors) {
		const names = (selector.options ?? []).map((o) => (o as { name: string }).name);
		assert.deepEqual(
			names,
			[...names].sort((a, b) => a.localeCompare(b)),
		);
	}
});

test('typed fields: required ones on the node, optional ones under Options', () => {
	const properties = buildProperties();
	const shownFor = (p: INodeProperties, value: string) =>
		(p.displayOptions?.show?.operation as string[] | undefined)?.includes(value);

	const search = properties.filter((p) => shownFor(p, 'search'));
	assert.deepEqual(
		search.map((p) => p.name),
		['text', 'options'],
	);
	const optionNames = (search[1].options ?? []).map((o) => (o as INodeProperties).name);
	assert.deepEqual(optionNames, ['engines', 'language', 'limit', 'page', 'timeRange']);

	const crawl = properties.filter((p) => shownFor(p, 'crawlSite'));
	assert.equal(crawl[0].type, 'notice');

	const logo = properties.filter((p) => shownFor(p, 'getLogoImage'));
	assert.ok(logo.some((p) => p.name === 'binaryPropertyName'));
});

test('operations without typed fields fall back to a pre-filled JSON input', () => {
	const jsonOnly: OperationDefinition = {
		resource: 'web',
		name: 'Raw Query',
		value: 'rawQuery',
		action: 'Raw query',
		description: 'Test operation. Requires a ReplyNodes API key.',
		method: 'GET',
		baseURL: API_BASE_URL,
		path: '/v1/test',
		requestKind: 'query',
		auth: 'required',
		responseKind: 'json',
		example: { text: 'hello' },
	};
	const json = buildProperties([jsonOnly]).find((p) => p.name === 'queryParameters');
	assert.ok(json);
	assert.equal(json.type, 'json');
	assert.deepEqual(JSON.parse(String(json.default)), { text: 'hello' });
});

test('credential sends a Bearer key and tests it against a no-quota endpoint', () => {
	const credential = new ReplyNodesApi();
	assert.equal(credential.name, 'replyNodesApi');
	assert.equal(credential.properties.length, 1);
	assert.equal(credential.properties[0].typeOptions?.password, true);
	assert.deepEqual(credential.authenticate.properties.headers, {
		Authorization: '=Bearer {{$credentials.apiKey}}',
	});
	assert.equal(credential.test.request.baseURL, 'https://api.replynodes.com');
	assert.equal(credential.test.request.url, '/v1/agent/status');
	assert.equal(
		(credential.test.request.headers as Record<string, string>)['x-replynodes-source'],
		'n8n',
	);
});
