import assert from 'node:assert/strict';
import test from 'node:test';
import { executeReplyNodes } from '../../nodes/ReplyNodes/execute';
import { fakeContext, httpError } from '../helpers/context.cts';

test('free JSON operation calls ReplyNodes without credentials and pairs items', async () => {
	const { context, calls } = fakeContext({
		items: [
			{ resource: 'brand', operation: 'getBrand', domain: 'stripe.com' },
			{ resource: 'brand', operation: 'getBrand', domain: 'n8n.io' },
		],
		respond: (request) => ({ domain: String(request.url).slice(1), name: 'Brand' }),
	});

	const [output] = await executeReplyNodes.call(context);

	assert.deepEqual(
		calls.map((c) => [c.helper, c.request.baseURL, c.request.url]),
		[
			['httpRequest', 'https://brand.replynodes.com', '/stripe.com'],
			['httpRequest', 'https://brand.replynodes.com', '/n8n.io'],
		],
	);
	assert.deepEqual(output, [
		{ json: { domain: 'stripe.com', name: 'Brand' }, pairedItem: { item: 0 } },
		{ json: { domain: 'n8n.io', name: 'Brand' }, pairedItem: { item: 1 } },
	]);
});

test('free operations never send the key, even when a credential is set', async () => {
	const { context, calls } = fakeContext({
		withCredential: true,
		items: [{ resource: 'web', operation: 'urlToMarkdown', url: 'https://example.com' }],
		respond: () => '# Example',
	});

	const [output] = await executeReplyNodes.call(context);

	assert.equal(calls[0].helper, 'httpRequest');
	assert.deepEqual(output[0].json, { url: 'https://example.com/', markdown: '# Example' });
});

test('optional-key operation runs anonymously without a credential', async () => {
	const { context, calls } = fakeContext({
		items: [{ resource: 'web', operation: 'search', text: 'n8n' }],
		respond: () => ({ data: { data: [] }, meta: {} }),
	});

	await executeReplyNodes.call(context);

	assert.equal(calls[0].helper, 'httpRequest');
});

test('optional-key and keyed operations use the credential when one is set', async () => {
	const { context, calls } = fakeContext({
		withCredential: true,
		items: [
			{ resource: 'web', operation: 'search', text: 'n8n' },
			{ resource: 'brand', operation: 'getFonts', domainOrUrl: 'stripe.com' },
		],
		respond: () => ({ data: {} }),
	});

	await executeReplyNodes.call(context);

	assert.deepEqual(
		calls.map((c) => [c.helper, c.credential]),
		[
			['httpRequestWithAuthentication', 'replyNodesApi'],
			['httpRequestWithAuthentication', 'replyNodesApi'],
		],
	);
});

test('keyed operation without a credential fails before calling the API', async () => {
	const { context, calls } = fakeContext({
		items: [{ resource: 'web', operation: 'crawlSite', url: 'https://example.com' }],
		respond: () => ({}),
	});

	await assert.rejects(
		executeReplyNodes.call(context),
		(error: Error & { description?: string }) => {
			assert.match(error.message, /needs a ReplyNodes API key/);
			assert.match(String(error.description), /utm_source=n8n/);
			return true;
		},
	);
	assert.equal(calls.length, 0);
});

test('logo image becomes n8n binary data with mime type and file name', async () => {
	const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
	const { context, binaries } = fakeContext({
		items: [
			{
				resource: 'brand',
				operation: 'getLogoImage',
				domain: 'stripe.com',
				binaryPropertyName: 'logo',
			},
		],
		respond: () => ({
			body: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
			headers: { 'content-type': 'image/png', 'x-replynodes-logo-fallback': 'logo' },
			statusCode: 200,
		}),
	});

	const [output] = await executeReplyNodes.call(context);

	assert.equal(binaries.length, 1);
	assert.deepEqual(binaries[0].buffer, png);
	assert.equal(binaries[0].fileName, 'stripe.com.png');
	assert.equal(binaries[0].mimeType, 'image/png');
	assert.deepEqual(output[0].json, {
		domain: 'stripe.com',
		fileName: 'stripe.com.png',
		mimeType: 'image/png',
		source: 'logo',
	});
	assert.ok(output[0].binary?.logo);
	assert.deepEqual(output[0].pairedItem, { item: 0 });
});

test('a non-image logo response is reported as an error', async () => {
	const { context } = fakeContext({
		items: [{ resource: 'brand', operation: 'getLogoImage', domain: 'stripe.com' }],
		respond: () => ({ body: Buffer.from('<html>'), headers: { 'content-type': 'text/html' } }),
	});

	await assert.rejects(executeReplyNodes.call(context), /Expected an image/);
});

test('anonymous 429 explains the daily reset and how to get a key', async () => {
	const { context } = fakeContext({
		items: [{ resource: 'brand', operation: 'getBrand', domain: 'stripe.com' }],
		respond: () =>
			httpError(
				429,
				{ error: { code: 'anonymous_limit_reached', request_id: 'req-1' } },
				{ 'x-ratelimit-reset': '1793318400' },
			),
	});

	await assert.rejects(
		executeReplyNodes.call(context),
		(error: Error & { description?: string; httpCode?: string }) => {
			assert.equal(error.message, 'ReplyNodes free daily limit reached');
			assert.equal(error.httpCode, '429');
			assert.match(String(error.description), /2026-10-30T00:00:00\.000Z/);
			assert.match(String(error.description), /sign-up\?utm_source=n8n/);
			assert.match(String(error.description), /req-1/);
			return true;
		},
	);
});

test('5xx gives a retry hint', async () => {
	const { context } = fakeContext({
		items: [{ resource: 'web', operation: 'urlToMarkdown', url: 'https://example.com' }],
		respond: () => httpError(503, Buffer.from('{"error":{"code":"degraded"}}')),
	});

	await assert.rejects(
		executeReplyNodes.call(context),
		(error: Error & { description?: string }) => {
			assert.equal(error.message, 'ReplyNodes is temporarily unavailable (HTTP 503)');
			assert.match(String(error.description), /Retry On Fail/);
			return true;
		},
	);
});

test('4xx surfaces the API message', async () => {
	const { context } = fakeContext({
		items: [{ resource: 'brand', operation: 'getBrand', domain: 'stripe.com' }],
		respond: () =>
			httpError(400, { error: { code: 'invalid_request', message: 'The request is malformed.' } }),
	});

	await assert.rejects(
		executeReplyNodes.call(context),
		(error: Error & { description?: string }) => {
			assert.equal(error.message, 'ReplyNodes request failed (HTTP 400)');
			assert.match(String(error.description), /The request is malformed/);
			return true;
		},
	);
});

test('continueOnFail keeps going and reports the error on the failed item', async () => {
	const { context, calls } = fakeContext({
		continueOnFail: true,
		items: [
			{ resource: 'brand', operation: 'getBrand', domain: 'not a domain' },
			{ resource: 'web', operation: 'mapSite', url: 'https://example.com' },
			{ resource: 'brand', operation: 'getBrand', domain: 'stripe.com' },
		],
		respond: () => ({ domain: 'stripe.com' }),
	});

	const [output] = await executeReplyNodes.call(context);

	assert.equal(calls.length, 1);
	assert.equal(output.length, 3);
	assert.match(String(output[0].json.error), /not a valid domain/);
	assert.deepEqual(output[0].pairedItem, { item: 0 });
	assert.match(String(output[1].json.error), /needs a ReplyNodes API key/);
	assert.deepEqual(output[2], { json: { domain: 'stripe.com' }, pairedItem: { item: 2 } });
});

test('errors without continueOnFail carry the failing item index', async () => {
	const { context } = fakeContext({
		items: [
			{ resource: 'brand', operation: 'getBrand', domain: 'stripe.com' },
			{ resource: 'brand', operation: 'getBrand', domain: 'bad domain' },
		],
		respond: () => ({}),
	});

	await assert.rejects(
		executeReplyNodes.call(context),
		(error: Error & { context?: { itemIndex?: number } }) => {
			assert.equal(error.context?.itemIndex, 1);
			return true;
		},
	);
});
