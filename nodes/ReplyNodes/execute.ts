import {
	NodeApiError,
	NodeOperationError,
	type IBinaryData,
	type IDataObject,
	type IExecuteFunctions,
	type INode,
	type INodeExecutionData,
	type JsonObject,
} from 'n8n-workflow';
import { links } from './links';
import { findOperation, type OperationDefinition } from './operations';
import {
	BINARY_PROPERTY_PARAMETER,
	BODY_JSON_PARAMETER,
	OPTIONS_PARAMETER,
	QUERY_JSON_PARAMETER,
} from './properties';
import { buildRequest, emptyInput, resolveFieldValues, type RequestInput } from './request';

export const CREDENTIAL_NAME = 'replyNodesApi';

const IMAGE_EXTENSIONS: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/avif': 'avif',
	'image/svg+xml': 'svg',
	'image/x-icon': 'ico',
	'image/vnd.microsoft.icon': 'ico',
};

export async function executeReplyNodes(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const output: INodeExecutionData[] = [];
	const hasCredential = Boolean(this.getNode().credentials?.[CREDENTIAL_NAME]);

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			const operation = resolveOperation.call(this, itemIndex);
			if (operation.auth === 'required' && !hasCredential) {
				throw new NodeOperationError(
					this.getNode(),
					`${operation.name} needs a ReplyNodes API key`,
					{
						itemIndex,
						description: `Create a free key at ${links.signup} and select it in the ReplyNodes credential field. Get Brand, Get Logo Image, and URL to Markdown work without a key.`,
					},
				);
			}

			const input = readInput.call(this, operation, itemIndex);
			const request = buildRequest(this.getNode(), operation, input);
			const response =
				hasCredential && operation.auth !== 'none'
					? await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL_NAME, request)
					: await this.helpers.httpRequest(request);

			output.push(await toOutputItem.call(this, operation, input, response, itemIndex));
		} catch (error) {
			const nodeError = toNodeError(this.getNode(), error, itemIndex, hasCredential);
			if (this.continueOnFail()) {
				output.push({
					json: { error: nodeError.message, description: nodeError.description ?? null },
					pairedItem: { item: itemIndex },
				});
				continue;
			}
			throw nodeError;
		}
	}

	return [output];
}

function resolveOperation(this: IExecuteFunctions, itemIndex: number): OperationDefinition {
	const resource = this.getNodeParameter('resource', itemIndex) as string;
	const value = this.getNodeParameter('operation', itemIndex) as string;
	const operation = findOperation(resource, value);
	if (!operation) {
		throw new NodeOperationError(this.getNode(), `Unknown operation "${resource}/${value}"`, {
			itemIndex,
		});
	}
	return operation;
}

function readInput(
	this: IExecuteFunctions,
	operation: OperationDefinition,
	itemIndex: number,
): RequestInput {
	if (operation.fields && operation.fields.length > 0) {
		const options = this.getNodeParameter(OPTIONS_PARAMETER, itemIndex, {}) as IDataObject;
		const values: Record<string, unknown> = {};
		for (const field of operation.fields) {
			values[field.name] = field.required
				? this.getNodeParameter(field.name, itemIndex, '')
				: options[field.name];
		}
		return resolveFieldValues(this.getNode(), operation, values);
	}

	const input = emptyInput();
	if (operation.requestKind === 'query') {
		input.query = readJsonObject.call(this, QUERY_JSON_PARAMETER, itemIndex);
	} else if (operation.requestKind === 'body') {
		input.body = readJsonObject.call(this, BODY_JSON_PARAMETER, itemIndex);
	}
	return input;
}

function readJsonObject(this: IExecuteFunctions, name: string, itemIndex: number): IDataObject {
	const value = this.getNodeParameter(name, itemIndex, {}) as unknown;
	const parsed = parseJsonObject(value);
	if (!parsed) {
		throw new NodeOperationError(this.getNode(), `${name} must be a JSON object`, { itemIndex });
	}
	return parsed;
}

export function parseJsonObject(value: unknown): IDataObject | undefined {
	let candidate = value;
	if (typeof value === 'string') {
		if (value.trim() === '') return {};
		try {
			candidate = JSON.parse(value);
		} catch {
			return undefined;
		}
	}
	if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
		return candidate as IDataObject;
	}
	return undefined;
}

async function toOutputItem(
	this: IExecuteFunctions,
	operation: OperationDefinition,
	input: RequestInput,
	response: unknown,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const pairedItem = { item: itemIndex };

	if (operation.responseKind === 'text') {
		return {
			json: { url: input.pathParameters.target ?? null, markdown: String(response ?? '') },
			pairedItem,
		};
	}

	if (operation.responseKind === 'binary') {
		const full = (response ?? {}) as { body?: unknown; headers?: IDataObject };
		const headers = full.headers ?? {};
		const mimeType = String(headers['content-type'] ?? '')
			.split(';')[0]
			.trim()
			.toLowerCase();
		if (!mimeType.startsWith('image/')) {
			throw new NodeOperationError(
				this.getNode(),
				`Expected an image but ReplyNodes returned "${mimeType || 'no content type'}"`,
				{ itemIndex },
			);
		}
		const domain = input.pathParameters.domain ?? 'logo';
		const extension = IMAGE_EXTENSIONS[mimeType] ?? mimeType.slice('image/'.length);
		const fileName = `${domain}.${extension}`;
		const binaryProperty = this.getNodeParameter(
			BINARY_PROPERTY_PARAMETER,
			itemIndex,
			'data',
		) as string;
		const binary: IBinaryData = await this.helpers.prepareBinaryData(
			toBuffer(full.body) ?? Buffer.alloc(0),
			fileName,
			mimeType,
		);
		return {
			json: {
				domain,
				fileName,
				mimeType,
				source: (headers['x-replynodes-logo-fallback'] as string | undefined) ?? null,
			},
			binary: { [binaryProperty]: binary },
			pairedItem,
		};
	}

	if (response && typeof response === 'object' && !Array.isArray(response)) {
		return { json: response as IDataObject, pairedItem };
	}
	return { json: { data: response as IDataObject[] }, pairedItem };
}

function toBuffer(body: unknown): Buffer | undefined {
	if (Buffer.isBuffer(body)) return body;
	if (body instanceof ArrayBuffer) return Buffer.from(body);
	if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	if (typeof body === 'string') return Buffer.from(body, 'binary');
	return undefined;
}

interface HttpFailure {
	status?: number;
	headers: IDataObject;
	apiError: { code?: string; message?: string; requestId?: string; retryAfter?: number };
}

/** Pulls status, headers, and the ReplyNodes `error` object out of whatever shape the n8n HTTP helper threw. */
export function readHttpFailure(error: unknown): HttpFailure {
	const candidates: unknown[] = [];
	let current: unknown = error;
	for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
		candidates.push(current);
		const node = current as IDataObject;
		current = node.cause ?? node.errorResponse;
	}

	let status: number | undefined;
	let headers: IDataObject = {};
	let body: unknown;
	for (const candidate of candidates) {
		const node = candidate as IDataObject;
		const response = node.response as IDataObject | undefined;
		status ??= toStatus(response?.status) ?? toStatus(node.httpCode) ?? toStatus(node.statusCode);
		if (response?.headers && Object.keys(headers).length === 0) {
			headers = response.headers as IDataObject;
		}
		body ??= response?.data ?? response?.body;
	}

	const parsedBody = parseBody(body);
	const apiError = (parsedBody?.error ?? {}) as IDataObject;
	const nextAction = (apiError.next_action ?? {}) as IDataObject;
	return {
		status,
		headers,
		apiError: {
			code: typeof apiError.code === 'string' ? apiError.code : undefined,
			message: typeof apiError.message === 'string' ? apiError.message : undefined,
			requestId: typeof apiError.request_id === 'string' ? apiError.request_id : undefined,
			retryAfter:
				typeof nextAction.retry_after_seconds === 'number'
					? nextAction.retry_after_seconds
					: undefined,
		},
	};
}

export function toNodeError(
	node: INode,
	error: unknown,
	itemIndex: number,
	hasCredential: boolean,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeOperationError) {
		return error.context.itemIndex === undefined
			? new NodeOperationError(node, error.message, {
					itemIndex,
					description: error.description ?? undefined,
				})
			: error;
	}

	const { status, headers, apiError } = readHttpFailure(error);
	const reference = apiError.requestId ? ` (request ID ${apiError.requestId})` : '';
	let message: string;
	let description: string;

	if (status === 429) {
		const reset = formatReset(headers['x-ratelimit-reset'], apiError.retryAfter);
		if (hasCredential) {
			message = 'ReplyNodes rate limit reached';
			description = `Try again ${reset}, or check your plan and usage at ${links.apiKeys}.`;
		} else {
			message = 'ReplyNodes free daily limit reached';
			description = `The free limit resets ${reset}. For higher limits, create a free API key at ${links.signup} and add it as a ReplyNodes credential.`;
		}
	} else if (status === 401 || status === 403) {
		message = hasCredential
			? 'ReplyNodes rejected the API key'
			: 'ReplyNodes requires an API key for this request';
		description = `Check or create a key at ${links.apiKeys}.`;
	} else if (status === 402) {
		message = 'Not enough ReplyNodes credits';
		description = `Add credits or change your plan at ${links.apiKeys}.`;
	} else if (status !== undefined && status >= 500) {
		message = `ReplyNodes is temporarily unavailable (HTTP ${status})`;
		description =
			'This is usually brief. Try again in a minute, or turn on "Retry On Fail" in the node settings.';
	} else if (status !== undefined) {
		message = `ReplyNodes request failed (HTTP ${status})`;
		description = apiError.message ?? 'Check the node parameters and try again.';
	} else {
		message = 'Could not reach ReplyNodes';
		description = error instanceof Error ? error.message : String(error);
	}

	return new NodeApiError(node, toJsonObject(error), {
		itemIndex,
		message,
		description: `${description}${reference}`,
		...(status !== undefined ? { httpCode: String(status) } : {}),
	});
}

function toJsonObject(error: unknown): JsonObject {
	if (error && typeof error === 'object') return error as JsonObject;
	return { message: String(error) };
}

function toStatus(value: unknown): number | undefined {
	const status = Number(value);
	return Number.isInteger(status) && status >= 100 && status < 600 ? status : undefined;
}

function parseBody(body: unknown): IDataObject | undefined {
	let text: string | undefined;
	if (Buffer.isBuffer(body)) text = body.toString('utf8');
	else if (body instanceof ArrayBuffer) text = Buffer.from(body).toString('utf8');
	else if (typeof body === 'string') text = body;
	else if (body && typeof body === 'object') return body as IDataObject;
	if (text === undefined) return undefined;
	try {
		const parsed = JSON.parse(text) as unknown;
		return parsed && typeof parsed === 'object' ? (parsed as IDataObject) : undefined;
	} catch {
		return undefined;
	}
}

function formatReset(resetHeader: unknown, retryAfterSeconds?: number): string {
	const resetUnix = Number(resetHeader);
	if (Number.isFinite(resetUnix) && resetUnix > 0) {
		return `at ${new Date(resetUnix * 1000).toISOString()} (UTC midnight)`;
	}
	if (retryAfterSeconds !== undefined) {
		return `in about ${Math.ceil(retryAfterSeconds / 60)} minutes`;
	}
	return 'at the next UTC midnight';
}
