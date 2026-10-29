import {
	NodeOperationError,
	type IDataObject,
	type IHttpRequestOptions,
	type INode,
} from 'n8n-workflow';
import { version as packageVersion } from '../../package.json';
import type { OperationDefinition, OperationField } from './operations';

/** Sent on every request so ReplyNodes can count n8n usage. Carries no user or instance identifier. */
export const SOURCE_HEADER = 'x-replynodes-source';
export const SOURCE_VERSION_HEADER = 'x-replynodes-source-version';
export const SOURCE_VALUE = 'n8n';
export const NODE_PACKAGE_VERSION: string = packageVersion;

const ACCEPT_BY_RESPONSE_KIND = {
	json: 'application/json',
	text: 'text/markdown, text/plain;q=0.9',
	binary: 'image/*',
} as const;

const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export interface RequestInput {
	pathParameters: Record<string, string>;
	query: IDataObject;
	headers: Record<string, string>;
	body?: IDataObject;
}

export function emptyInput(): RequestInput {
	return { pathParameters: {}, query: {}, headers: {} };
}

/** Maps typed field values onto path, query, and header inputs, normalizing domains and URLs. */
export function resolveFieldValues(
	node: INode,
	operation: OperationDefinition,
	values: Record<string, unknown>,
): RequestInput {
	const input = emptyInput();
	for (const field of operation.fields ?? []) {
		const raw = values[field.name];
		if (raw === undefined || raw === null || raw === '') {
			if (field.required) {
				throw new NodeOperationError(node, `${field.displayName} is required`);
			}
			continue;
		}
		const { key, value } = formatFieldValue(node, field, raw);
		if (field.sendAs.in === 'path') {
			input.pathParameters[key] = String(value);
		} else if (field.sendAs.in === 'header') {
			input.headers[key] = String(value);
		} else {
			input.query[key] = value;
		}
	}
	return input;
}

export function buildRequest(
	node: INode,
	operation: OperationDefinition,
	input: RequestInput,
): IHttpRequestOptions {
	const headers: IDataObject = {
		...input.headers,
		Accept: ACCEPT_BY_RESPONSE_KIND[operation.responseKind],
		[SOURCE_HEADER]: SOURCE_VALUE,
		[SOURCE_VERSION_HEADER]: NODE_PACKAGE_VERSION,
	};
	const request: IHttpRequestOptions = {
		method: operation.method,
		baseURL: operation.baseURL,
		url: fillPath(node, operation, input.pathParameters),
		headers,
	};

	const query = withoutEmptyValues(input.query);
	if (Object.keys(query).length > 0) {
		request.qs = query;
	}
	if (input.body && Object.keys(input.body).length > 0) {
		request.body = input.body;
		headers['Content-Type'] = 'application/json';
	}

	if (operation.responseKind === 'json') {
		request.json = true;
	} else if (operation.responseKind === 'text') {
		request.encoding = 'text';
		request.json = false;
	} else {
		request.encoding = 'arraybuffer';
		request.json = false;
		request.returnFullResponse = true;
	}

	return request;
}

export function normalizeDomain(node: INode, value: string): string {
	const trimmed = value.trim().toLowerCase();
	let host = trimmed;
	if (/^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) || /[/?#:@]/.test(trimmed)) {
		host = parseHttpUrl(node, trimmed).hostname;
	}
	host = host.replace(/\.$/, '');
	if (!DOMAIN_PATTERN.test(host)) {
		throw new NodeOperationError(
			node,
			`"${value}" is not a valid domain. Use a domain like stripe.com.`,
		);
	}
	return host;
}

export function normalizeUrl(node: INode, value: string): string {
	const url = parseHttpUrl(node, value.trim());
	url.hash = '';
	return url.href;
}

function formatFieldValue(
	node: INode,
	field: OperationField,
	raw: unknown,
): { key: string; value: string | number } {
	if (field.type === 'number') {
		const value = Number(raw);
		if (!Number.isFinite(value)) {
			throw new NodeOperationError(node, `${field.displayName} must be a number`);
		}
		return { key: field.sendAs.key, value };
	}
	const text = String(raw);
	switch (field.format) {
		case 'domain':
			return { key: field.sendAs.key, value: normalizeDomain(node, text) };
		case 'url':
			return { key: field.sendAs.key, value: normalizeUrl(node, text) };
		case 'domainOrUrl':
			return looksLikeBareDomain(text)
				? { key: field.sendAs.key, value: normalizeDomain(node, text) }
				: { key: field.sendAs.urlKey ?? field.sendAs.key, value: normalizeUrl(node, text) };
		default:
			return { key: field.sendAs.key, value: text.trim() };
	}
}

function looksLikeBareDomain(value: string): boolean {
	return !/[/?#:@]/.test(value.trim());
}

function parseHttpUrl(node: INode, value: string): URL {
	const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
	let url: URL;
	try {
		url = new URL(withScheme);
	} catch {
		throw new NodeOperationError(node, `"${value}" is not a valid URL`);
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new NodeOperationError(node, `"${value}" must be an http or https URL`);
	}
	if (url.username || url.password) {
		throw new NodeOperationError(node, `"${value}" must not contain a username or password`);
	}
	return url;
}

function fillPath(
	node: INode,
	operation: OperationDefinition,
	pathParameters: Record<string, string>,
): string {
	const rawNames = new Set(
		(operation.pathParameters ?? []).filter((p) => p.raw).map((p) => p.name),
	);
	return operation.path.replace(/\{([^}]+)\}/g, (_placeholder, name: string) => {
		const value = pathParameters[name];
		if (!value) {
			throw new NodeOperationError(node, `Missing value for "${name}"`);
		}
		return rawNames.has(name) ? value : encodeURIComponent(value);
	});
}

function withoutEmptyValues(query: IDataObject): IDataObject {
	return Object.fromEntries(
		Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
	);
}
