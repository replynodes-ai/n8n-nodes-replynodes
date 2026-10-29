import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { findOperation, type OperationDefinition } from '../../nodes/ReplyNodes/operations';
import {
	NODE_PACKAGE_VERSION,
	SOURCE_HEADER,
	SOURCE_VERSION_HEADER,
	buildRequest,
	normalizeDomain,
	normalizeUrl,
	resolveFieldValues,
} from '../../nodes/ReplyNodes/request';
import { testNode } from '../helpers/context.cts';

function op(resource: string, value: string): OperationDefinition {
	const operation = findOperation(resource, value);
	assert.ok(operation, `${resource}/${value} exists`);
	return operation;
}

function build(resource: string, value: string, values: Record<string, unknown>) {
	const operation = op(resource, value);
	return buildRequest(testNode, operation, resolveFieldValues(testNode, operation, values));
}

test('each free operation targets its own subdomain', () => {
	assert.equal(
		build('brand', 'getBrand', { domain: 'stripe.com' }).baseURL,
		'https://brand.replynodes.com',
	);
	assert.equal(
		build('brand', 'getLogoImage', { domain: 'stripe.com' }).baseURL,
		'https://img.replynodes.com',
	);
	assert.equal(
		build('web', 'urlToMarkdown', { url: 'https://example.com' }).baseURL,
		'https://md.replynodes.com',
	);
});

test('keyed and optional-key operations target the API host', () => {
	for (const [resource, value] of [
		['brand', 'getLogoKit'],
		['brand', 'getFonts'],
		['web', 'search'],
		['web', 'crawlSite'],
	]) {
		assert.equal(op(resource, value).baseURL, 'https://api.replynodes.com');
	}
});

test('brand domain is a single encoded path segment', () => {
	const request = build('brand', 'getBrand', { domain: 'https://WWW.Stripe.com/about?x=1' });
	assert.equal(request.url, '/www.stripe.com');
	assert.equal(request.qs, undefined);
	assert.equal(request.json, true);
});

test('markdown target keeps its path and query unencoded', () => {
	const request = build('web', 'urlToMarkdown', {
		url: 'https://example.com/docs?topic=agents&page=2#intro',
	});
	assert.equal(request.url, '/https://example.com/docs?topic=agents&page=2');
	assert.equal(request.encoding, 'text');
	assert.equal(request.json, false);
});

test('markdown target adds https and percent-encodes spaces and non-ASCII', () => {
	const request = build('web', 'urlToMarkdown', { url: 'example.com/a b/café' });
	assert.equal(request.url, '/https://example.com/a%20b/caf%C3%A9');
});

test('markdown options travel as headers', () => {
	const operation = op('web', 'urlToMarkdown');
	const request = buildRequest(
		testNode,
		operation,
		resolveFieldValues(testNode, operation, {
			url: 'https://example.com',
			format: 'frontmatter',
			includeSelectors: 'article',
			excludeSelectors: '',
		}),
	);
	const headers = request.headers as Record<string, string>;
	assert.equal(headers['X-Format'], 'frontmatter');
	assert.equal(headers['X-Include-Selectors'], 'article');
	assert.equal('X-Exclude-Selectors' in headers, false);
});

test('query parameters are mapped to API names and empty values are dropped', () => {
	const request = build('web', 'search', { text: ' n8n ', limit: 5, site: '', start: 0 });
	assert.equal(request.url, '/v1/web/search');
	assert.deepEqual(request.qs, { text: 'n8n', limit: 5, start: 0 });

	const crawl = build('web', 'crawlSite', { url: 'example.com', maxPages: 20, maxDepth: 2 });
	assert.deepEqual(crawl.qs, { url: 'https://example.com/', max_pages: 20, max_depth: 2 });
});

test('domain or URL field picks the matching query parameter', () => {
	assert.deepEqual(build('brand', 'getFonts', { domainOrUrl: 'Stripe.com' }).qs, {
		domain: 'stripe.com',
	});
	assert.deepEqual(build('brand', 'getFonts', { domainOrUrl: 'https://stripe.com/pricing' }).qs, {
		url: 'https://stripe.com/pricing',
	});
});

test('every request carries the source headers and never an Authorization header', () => {
	const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
	assert.equal(NODE_PACKAGE_VERSION, packageJson.version);
	for (const request of [
		build('brand', 'getBrand', { domain: 'stripe.com' }),
		build('brand', 'getLogoImage', { domain: 'stripe.com' }),
		build('web', 'urlToMarkdown', { url: 'https://example.com' }),
		build('web', 'search', { text: 'n8n' }),
	]) {
		const headers = request.headers as Record<string, string>;
		assert.equal(headers[SOURCE_HEADER], 'n8n');
		assert.equal(headers[SOURCE_VERSION_HEADER], packageJson.version);
		assert.equal(
			Object.keys(headers).some((h) => h.toLowerCase() === 'authorization'),
			false,
		);
	}
});

test('Accept header matches the response kind', () => {
	const accept = (r: { headers?: unknown }) => (r.headers as Record<string, string>).Accept;
	assert.equal(accept(build('brand', 'getBrand', { domain: 'stripe.com' })), 'application/json');
	assert.match(
		accept(build('web', 'urlToMarkdown', { url: 'https://example.com' })),
		/^text\/markdown/,
	);
	const image = build('brand', 'getLogoImage', { domain: 'stripe.com' });
	assert.equal(accept(image), 'image/*');
	assert.equal(image.encoding, 'arraybuffer');
	assert.equal(image.returnFullResponse, true);
});

test('invalid input is rejected before any request is built', () => {
	assert.throws(() => normalizeDomain(testNode, 'not a domain'), /not a valid domain/);
	assert.throws(() => normalizeDomain(testNode, 'localhost'), /not a valid domain/);
	assert.throws(() => normalizeUrl(testNode, 'ftp://example.com'), /http or https/);
	assert.throws(
		() => normalizeUrl(testNode, 'https://user:pw@example.com'),
		/username or password/,
	);
	assert.throws(() => build('brand', 'getBrand', { domain: '' }), /Domain is required/);
	assert.throws(() => build('web', 'search', { text: 'x', limit: 'many' }), /must be a number/);
});
