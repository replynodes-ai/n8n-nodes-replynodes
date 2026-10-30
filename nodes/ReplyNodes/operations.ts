import type { IDataObject, IHttpRequestMethods } from 'n8n-workflow';

export const API_BASE_URL = 'https://api.replynodes.com';
export const MARKDOWN_BASE_URL = 'https://md.replynodes.com';
export const BRAND_BASE_URL = 'https://brand.replynodes.com';
export const LOGO_IMAGE_BASE_URL = 'https://img.replynodes.com';

export const resources = [
	{ name: 'Brand', value: 'brand' },
	{ name: 'Web', value: 'web' },
] as const;

export type Resource = (typeof resources)[number]['value'];

/** How inputs travel when an operation has no typed `fields`: none, a JSON query object, or a JSON body. */
export type RequestKind = 'none' | 'query' | 'body';

/**
 * none: never sends a key (free hosts).
 * optional: works without a key on the anonymous daily allowance; sends the key when a credential is set.
 * required: fails fast without a credential.
 */
export type AuthMode = 'none' | 'optional' | 'required';

export type ResponseKind = 'json' | 'text' | 'binary';

/**
 * domain: bare domain, normalized from a URL if needed.
 * url: absolute http(s) URL; `https://` is added when missing.
 * domainOrUrl: sent as `sendAs.key` when it looks like a bare domain, otherwise as `sendAs.urlKey`.
 */
export type FieldFormat = 'domain' | 'url' | 'domainOrUrl';

export interface OperationField {
	displayName: string;
	name: string;
	type: 'string' | 'number' | 'options';
	description: string;
	/** Required fields are shown on the node; optional ones are grouped under "Options". */
	required?: boolean;
	default: string | number;
	placeholder?: string;
	options?: Array<{ name: string; value: string }>;
	typeOptions?: { minValue?: number; maxValue?: number };
	format?: FieldFormat;
	sendAs: { in: 'query' | 'path' | 'header'; key: string; urlKey?: string };
}

export interface PathParameter {
	name: string;
	/** Insert the value unencoded. The Markdown host takes the whole target URL as its path. */
	raw?: boolean;
}

export interface OperationDefinition {
	resource: Resource;
	name: string;
	value: string;
	action: string;
	description: string;
	method: IHttpRequestMethods;
	baseURL: string;
	path: string;
	requestKind: RequestKind;
	auth: AuthMode;
	responseKind: ResponseKind;
	example?: IDataObject;
	pathParameters?: PathParameter[];
	fields?: OperationField[];
}

const domainField: OperationField = {
	displayName: 'Domain',
	name: 'domain',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'stripe.com',
	description:
		'Company domain, for example stripe.com. A full URL is also accepted and reduced to its domain.',
	format: 'domain',
	sendAs: { in: 'query', key: 'domain' },
};

const domainOrUrlField: OperationField = {
	displayName: 'Domain or URL',
	name: 'domainOrUrl',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'stripe.com',
	description:
		'A bare domain such as stripe.com analyzes the whole site. A full URL analyzes that one page.',
	format: 'domainOrUrl',
	sendAs: { in: 'query', key: 'domain', urlKey: 'url' },
};

const pageUrlField: OperationField = {
	displayName: 'URL',
	name: 'url',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'https://example.com',
	description: 'Public web page URL. https:// is added if you leave it out.',
	format: 'url',
	sendAs: { in: 'query', key: 'url' },
};

export const operations: OperationDefinition[] = [
	{
		resource: 'brand',
		name: 'Get Brand',
		value: 'getBrand',
		action: 'Get brand data for a domain',
		description:
			'Get the public brand profile of a company from its domain: name, description, logos, colors, fonts, and social links. Free, no API key needed.',
		method: 'GET',
		baseURL: BRAND_BASE_URL,
		path: '/{domain}',
		requestKind: 'none',
		auth: 'none',
		responseKind: 'json',
		pathParameters: [{ name: 'domain' }],
		example: { domain: 'stripe.com' },
		fields: [{ ...domainField, sendAs: { in: 'path', key: 'domain' } }],
	},
	{
		resource: 'brand',
		name: 'Get Logo Image',
		value: 'getLogoImage',
		action: 'Get a logo image for a domain',
		description:
			"Download a company's logo as an image file from its domain. Falls back to the favicon or a placeholder when no logo is found. Free, no API key needed.",
		method: 'GET',
		baseURL: LOGO_IMAGE_BASE_URL,
		path: '/{domain}',
		requestKind: 'none',
		auth: 'none',
		responseKind: 'binary',
		pathParameters: [{ name: 'domain' }],
		example: { domain: 'stripe.com' },
		fields: [{ ...domainField, sendAs: { in: 'path', key: 'domain' } }],
	},
	{
		resource: 'brand',
		name: 'Get Logo Kit',
		value: 'getLogoKit',
		action: 'Get logo URLs for a domain',
		description:
			'Get the logo kit of a company as JSON: primary logo URL, logo variants, favicon, and social preview image. Works without an API key up to a daily limit.',
		method: 'GET',
		baseURL: API_BASE_URL,
		path: '/v1/brand/logo',
		requestKind: 'query',
		auth: 'optional',
		responseKind: 'json',
		example: { domain: 'stripe.com' },
		fields: [domainField],
	},
	{
		resource: 'brand',
		name: 'Get Fonts',
		value: 'getFonts',
		action: 'Get the fonts of a website',
		description:
			'Get the typography of a website: font families, weights, and where each font is used. Requires a ReplyNodes API key.',
		method: 'GET',
		baseURL: API_BASE_URL,
		path: '/v1/brand/fonts',
		requestKind: 'query',
		auth: 'required',
		responseKind: 'json',
		example: { domain: 'stripe.com' },
		fields: [domainOrUrlField],
	},
	{
		resource: 'brand',
		name: 'Get Styleguide',
		value: 'getStyleguide',
		action: 'Get the styleguide of a website',
		description:
			'Get the design system of a website: colors, typography, spacing, and component styles. Requires a ReplyNodes API key.',
		method: 'GET',
		baseURL: API_BASE_URL,
		path: '/v1/brand/styleguide',
		requestKind: 'query',
		auth: 'required',
		responseKind: 'json',
		example: { domain: 'stripe.com' },
		fields: [domainOrUrlField],
	},
	{
		resource: 'brand',
		name: 'Search Brands',
		value: 'searchBrands',
		action: 'Search brands by name',
		description:
			'Find companies by name or domain. Returns up to 10 matches with domain, name, and logo. Use it to find the domain for a company name. Requires a ReplyNodes API key.',
		method: 'GET',
		baseURL: API_BASE_URL,
		path: '/v1/brand/search',
		requestKind: 'query',
		auth: 'required',
		responseKind: 'json',
		example: { query: 'stripe' },
		fields: [
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'stripe',
				description: 'Brand name or domain to search for',
				sendAs: { in: 'query', key: 'query' },
			},
			{
				displayName: 'Max Results',
				name: 'maxResults',
				type: 'number',
				default: 10,
				typeOptions: { minValue: 1, maxValue: 10 },
				description: 'Max number of results to return',
				sendAs: { in: 'query', key: 'limit' },
			},
		],
	},
	{
		resource: 'web',
		name: 'URL to Markdown',
		value: 'urlToMarkdown',
		action: 'Convert a URL to markdown',
		description:
			'Read a public web page and return its main content as clean Markdown, ready for an LLM. Free, no API key needed.',
		method: 'GET',
		baseURL: MARKDOWN_BASE_URL,
		path: '/{target}',
		requestKind: 'none',
		auth: 'none',
		responseKind: 'text',
		pathParameters: [{ name: 'target', raw: true }],
		example: { url: 'https://example.com' },
		fields: [
			{ ...pageUrlField, sendAs: { in: 'path', key: 'target' } },
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				default: 'markdown',
				options: [
					{ name: 'Markdown', value: 'markdown' },
					{ name: 'Markdown With Front Matter', value: 'frontmatter' },
				],
				description: 'Front matter adds a YAML block with the page title, URL, and other metadata',
				sendAs: { in: 'header', key: 'X-Format' },
			},
			{
				displayName: 'Include Selectors',
				name: 'includeSelectors',
				type: 'string',
				default: '',
				placeholder: 'article,.post-body',
				description: 'Comma-separated CSS selectors to keep (up to 10)',
				sendAs: { in: 'header', key: 'X-Include-Selectors' },
			},
			{
				displayName: 'Exclude Selectors',
				name: 'excludeSelectors',
				type: 'string',
				default: '',
				placeholder: 'nav,footer,.sidebar',
				description: 'Comma-separated CSS selectors to remove (up to 10)',
				sendAs: { in: 'header', key: 'X-Exclude-Selectors' },
			},
		],
	},
	{
		resource: 'web',
		name: 'Search',
		value: 'search',
		action: 'Search the web',
		description:
			'Search the public web (English only) and return ranked results with title, URL, and snippet. Works without an API key up to a daily limit.',
		method: 'GET',
		baseURL: API_BASE_URL,
		path: '/v1/web/search',
		requestKind: 'query',
		auth: 'optional',
		responseKind: 'json',
		example: { text: 'n8n workflow automation' },
		fields: [
			{
				displayName: 'Query',
				name: 'text',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'best open source workflow automation',
				description: 'What to search for (1 to 512 characters)',
				sendAs: { in: 'query', key: 'q' },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: { minValue: 1, maxValue: 50 },
				description: 'Max number of results to return',
				sendAs: { in: 'query', key: 'limit' },
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				typeOptions: { minValue: 1, maxValue: 2 },
				description: 'Result page. The API supports pages 1 and 2.',
				sendAs: { in: 'query', key: 'page' },
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'options',
				default: 'en-US',
				options: [
					{ name: 'English (UK)', value: 'en-GB' },
					{ name: 'English (US)', value: 'en-US' },
				],
				description: 'Language of the results. The API searches in English only.',
				sendAs: { in: 'query', key: 'language' },
			},
			{
				displayName: 'Recency',
				name: 'timeRange',
				type: 'options',
				default: '',
				options: [
					{ name: 'Any Time', value: '' },
					{ name: 'Past Week', value: 'week' },
				],
				description: 'Only return results from this time range',
				sendAs: { in: 'query', key: 'time_range' },
			},
			{
				displayName: 'Engines',
				name: 'engines',
				type: 'string',
				default: '',
				placeholder: 'brave,bing',
				description: 'Comma-separated list of search engines to use. Supported: brave, bing.',
				sendAs: { in: 'query', key: 'engines' },
			},
		],
	},
	{
		resource: 'web',
		name: 'Scrape',
		value: 'scrape',
		action: 'Scrape a web page',
		description:
			'Fetch one web page and return clean Markdown plus metadata, links, and images as JSON. Works without an API key up to a daily limit.',
		method: 'GET',
		baseURL: API_BASE_URL,
		path: '/v1/webcontext/scrape',
		requestKind: 'query',
		auth: 'optional',
		responseKind: 'json',
		example: { url: 'https://example.com' },
		fields: [
			pageUrlField,
			{
				displayName: 'Max Characters',
				name: 'maxChars',
				type: 'number',
				default: 50000,
				typeOptions: { minValue: 1, maxValue: 1048576 },
				description: 'Cut the Markdown after this many characters',
				sendAs: { in: 'query', key: 'max_chars' },
			},
			{
				displayName: 'Include Selectors',
				name: 'includeSelectors',
				type: 'string',
				default: '',
				placeholder: 'article,.content',
				description: 'Comma-separated CSS selectors to keep',
				sendAs: { in: 'query', key: 'include_selectors' },
			},
			{
				displayName: 'Exclude Selectors',
				name: 'excludeSelectors',
				type: 'string',
				default: '',
				placeholder: 'nav,footer,.sidebar',
				description: 'Comma-separated CSS selectors to remove',
				sendAs: { in: 'query', key: 'exclude_selectors' },
			},
		],
	},
	{
		resource: 'web',
		name: 'Map Site',
		value: 'mapSite',
		action: 'List the URLs of a website',
		description:
			'Discover the URLs that belong to a website without fetching their content. Use it before scraping or crawling. Requires a ReplyNodes API key.',
		method: 'GET',
		baseURL: API_BASE_URL,
		path: '/v1/webcontext/map',
		requestKind: 'query',
		auth: 'required',
		responseKind: 'json',
		example: { url: 'https://example.com' },
		fields: [pageUrlField],
	},
	{
		resource: 'web',
		name: 'Crawl Site',
		value: 'crawlSite',
		action: 'Crawl a website',
		description:
			'Follow same-site links from a start URL and return the content of each page found (up to 50 pages). Requires a ReplyNodes API key.',
		method: 'GET',
		baseURL: API_BASE_URL,
		path: '/v1/webcontext/crawl',
		requestKind: 'query',
		auth: 'required',
		responseKind: 'json',
		example: { url: 'https://example.com' },
		fields: [
			pageUrlField,
			{
				displayName: 'Max Pages',
				name: 'maxPages',
				type: 'number',
				default: 10,
				typeOptions: { minValue: 1, maxValue: 50 },
				description: 'Max number of pages to crawl',
				sendAs: { in: 'query', key: 'max_pages' },
			},
			{
				displayName: 'Max Depth',
				name: 'maxDepth',
				type: 'number',
				default: 1,
				typeOptions: { minValue: 1, maxValue: 3 },
				description: 'How many links deep to follow from the start URL',
				sendAs: { in: 'query', key: 'max_depth' },
			},
		],
	},
];

export function findOperation(resource: string, value: string): OperationDefinition | undefined {
	return operations.find((op) => op.resource === resource && op.value === value);
}
