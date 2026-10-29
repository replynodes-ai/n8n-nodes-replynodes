import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INode,
} from 'n8n-workflow';

export const testNode: INode = {
	id: 'test-node',
	name: 'ReplyNodes',
	type: '@replynodes/n8n-nodes-replynodes.replyNodes',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

export interface Call {
	helper: 'httpRequest' | 'httpRequestWithAuthentication';
	credential?: string;
	request: IHttpRequestOptions;
}

interface ContextOptions {
	/** One parameter set per input item. */
	items: IDataObject[];
	withCredential?: boolean;
	continueOnFail?: boolean;
	respond: (request: IHttpRequestOptions, index: number) => unknown;
}

export function fakeContext(options: ContextOptions) {
	const calls: Call[] = [];
	const binaries: Array<{ buffer: Buffer; fileName?: string; mimeType?: string }> = [];
	const node: INode = {
		...testNode,
		...(options.withCredential
			? { credentials: { replyNodesApi: { id: 'cred-1', name: 'ReplyNodes account' } } }
			: {}),
	};

	const answer = async (call: Call) => {
		calls.push(call);
		const result = options.respond(call.request, calls.length - 1);
		if (result instanceof Error) throw result;
		return result;
	};

	const context = {
		getInputData: () => options.items.map(() => ({ json: {} })),
		getNode: () => node,
		continueOnFail: () => options.continueOnFail ?? false,
		getNodeParameter: (name: string, itemIndex: number, fallback?: unknown) => {
			const value = options.items[itemIndex][name];
			return value === undefined ? fallback : value;
		},
		helpers: {
			httpRequest: async (request: IHttpRequestOptions) =>
				answer({ helper: 'httpRequest', request }),
			httpRequestWithAuthentication: async (credential: string, request: IHttpRequestOptions) =>
				answer({ helper: 'httpRequestWithAuthentication', credential, request }),
			prepareBinaryData: async (
				buffer: Buffer,
				fileName?: string,
				mimeType?: string,
			): Promise<IBinaryData> => {
				binaries.push({ buffer, fileName, mimeType });
				return { data: buffer.toString('base64'), mimeType: mimeType ?? '', fileName };
			},
		},
	};

	return { context: context as unknown as IExecuteFunctions, calls, binaries };
}

/** Shape of the error the n8n HTTP helpers throw on a non-2xx response. */
export function httpError(status: number, data: unknown, headers: IDataObject = {}): Error {
	const error = new Error(`Request failed with status code ${status}`) as Error & IDataObject;
	error.response = { status, data, headers } as IDataObject;
	return error;
}
