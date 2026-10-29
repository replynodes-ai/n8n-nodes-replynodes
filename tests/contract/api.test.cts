import assert from 'node:assert/strict';
import test from 'node:test';
import { API_BASE_URL, operations } from '../../nodes/ReplyNodes/operations';

const CAPABILITIES_URL =
	process.env.REPLYNODES_CAPABILITIES_URL ?? 'https://api.replynodes.com/v1/capabilities';

/** Operations on hosts that the machine-readable API definition does not describe yet. */
const NOT_IN_SPEC = new Set(['getLogoImage']);

/**
 * The definition lists the Markdown route as /md/{target} under the md host, but that host serves
 * it at /{target} (documented in llms.txt and on the host itself). Match it to the listed path.
 */
const SPEC_PATH: Record<string, string> = { urlToMarkdown: '/md/{target}' };

interface Parameter {
	$ref?: string;
	name?: string;
	in?: string;
	required?: boolean;
}

interface SpecOperation {
	parameters?: Parameter[];
	security?: Array<Record<string, string[]>>;
}

interface Capabilities {
	data: {
		document: {
			servers?: Array<{ url: string }>;
			paths: Record<string, { servers?: Array<{ url: string }>; get?: SpecOperation }>;
			components?: { parameters?: Record<string, Parameter> };
		};
		callable_routes: Array<{
			route: string;
			method: string;
			callable: boolean;
			auth_required: boolean;
		}>;
	};
}

test('every operation matches the live ReplyNodes API definition', async () => {
	const response = await fetch(CAPABILITIES_URL, { headers: { Accept: 'application/json' } });
	assert.equal(response.ok, true, `capabilities download failed with HTTP ${response.status}`);
	const { document, callable_routes: routes } = ((await response.json()) as Capabilities).data;
	const defaultServer = document.servers?.[0]?.url;

	for (const op of operations) {
		const label = `${op.resource}/${op.value} (${op.method} ${op.baseURL}${op.path})`;
		const pathItem = document.paths[SPEC_PATH[op.value] ?? op.path];

		if (NOT_IN_SPEC.has(op.value)) {
			const documentedElsewhere = Object.values(document.paths).some((item) =>
				item.servers?.some((s) => s.url === op.baseURL),
			);
			assert.equal(
				documentedElsewhere,
				false,
				`${label} is now in the API definition: remove it from NOT_IN_SPEC so it is checked`,
			);
			continue;
		}

		assert.ok(pathItem, `${label}: path missing from the API definition`);
		const specOp = pathItem[op.method.toLowerCase() as 'get'];
		assert.ok(specOp, `${label}: method missing from the API definition`);

		const server = pathItem.servers?.[0]?.url ?? defaultServer;
		assert.equal(server, op.baseURL, `${label}: host drifted`);

		const parameters = (specOp.parameters ?? []).map((p) => resolve(p, document.components));
		const documented = new Set(parameters.map((p) => `${p.in}:${p.name?.toLowerCase()}`));

		for (const field of op.fields ?? []) {
			const keys = [field.sendAs.key, field.sendAs.urlKey].filter((k): k is string => Boolean(k));
			for (const key of keys) {
				assert.ok(
					documented.has(`${field.sendAs.in}:${key.toLowerCase()}`),
					`${label}: ${field.sendAs.in} parameter "${key}" is not documented`,
				);
			}
		}

		for (const parameter of parameters.filter((p) => p.required && p.in !== 'header')) {
			assert.ok(
				op.fields?.some(
					(f) => f.required && f.sendAs.in === parameter.in && f.sendAs.key === parameter.name,
				),
				`${label}: required ${parameter.in} parameter "${parameter.name}" has no required field`,
			);
		}

		const needsKey = (specOp.security ?? []).some((s) => Object.keys(s).length > 0);
		if (op.auth === 'required') {
			assert.equal(needsKey, true, `${label}: marked as keyed but the API allows anonymous calls`);
		} else {
			assert.equal(needsKey, false, `${label}: the API now requires a key`);
		}

		if (op.baseURL === API_BASE_URL) {
			const route = routes.find((r) => r.route === op.path && r.method === op.method);
			assert.ok(route, `${label}: not in callable_routes`);
			assert.equal(route.callable, true, `${label}: not callable`);
			assert.equal(route.auth_required, op.auth === 'required', `${label}: auth_required drifted`);
		}
	}
});

function resolve(
	parameter: Parameter,
	components: { parameters?: Record<string, Parameter> } | undefined,
): Parameter {
	if (!parameter.$ref) return parameter;
	const name = parameter.$ref.split('/').at(-1) ?? '';
	return components?.parameters?.[name] ?? parameter;
}
