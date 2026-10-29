import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { links } from './links';
import { operations, resources, type OperationDefinition, type OperationField } from './operations';

export const BINARY_PROPERTY_PARAMETER = 'binaryPropertyName';
export const OPTIONS_PARAMETER = 'options';
export const QUERY_JSON_PARAMETER = 'queryParameters';
export const BODY_JSON_PARAMETER = 'requestBody';

const DEFAULT_OPERATION: Record<string, string> = {
	brand: 'getBrand',
	web: 'urlToMarkdown',
};

export function buildProperties(
	definitions: OperationDefinition[] = operations,
): INodeProperties[] {
	const usedResources = resources.filter((r) => definitions.some((op) => op.resource === r.value));
	const defaultResource: string = usedResources[0]?.value ?? '';
	return [
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			options: [...usedResources],
			default: defaultResource,
		},
		...usedResources.map((r) => operationSelector(r.value, definitions)),
		...definitions.flatMap(operationInputs),
	];
}

function operationSelector(resource: string, definitions: OperationDefinition[]): INodeProperties {
	const forResource = definitions.filter((op) => op.resource === resource);
	const defaultOperation = DEFAULT_OPERATION[resource] ?? forResource[0].value;
	const options: INodePropertyOptions[] = forResource
		.map((op) => ({
			name: op.name,
			value: op.value,
			action: op.action,
			description: op.description,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options,
		default: defaultOperation,
	};
}

function operationInputs(operation: OperationDefinition): INodeProperties[] {
	const displayOptions = {
		show: { resource: [operation.resource], operation: [operation.value] },
	};
	const properties: INodeProperties[] = [];

	if (operation.auth === 'required') {
		properties.push({
			displayName: `This operation needs a ReplyNodes API key. <a href="${links.signup}" target="_blank">Get a free key</a>, then add it as a ReplyNodes credential.`,
			name: 'apiKeyNotice',
			type: 'notice',
			default: '',
			displayOptions,
		});
	}

	if (operation.fields && operation.fields.length > 0) {
		const required = operation.fields.filter((f) => f.required);
		const optional = operation.fields.filter((f) => !f.required);
		properties.push(...required.map((f) => ({ ...fieldProperty(f), displayOptions })));
		if (optional.length > 0) {
			properties.push({
				displayName: 'Options',
				name: OPTIONS_PARAMETER,
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions,
				options: optional
					.map(fieldProperty)
					.sort((a, b) => a.displayName.localeCompare(b.displayName)),
			});
		}
	} else if (operation.requestKind === 'query' || operation.requestKind === 'body') {
		const isQuery = operation.requestKind === 'query';
		properties.push({
			displayName: isQuery ? 'Query Parameters' : 'Request Body',
			name: isQuery ? QUERY_JSON_PARAMETER : BODY_JSON_PARAMETER,
			type: 'json',
			default: JSON.stringify(operation.example ?? {}, null, 2),
			displayOptions,
			description: isQuery
				? 'JSON object sent as the query string'
				: 'JSON object sent as the request body',
		});
	}

	if (operation.responseKind === 'binary') {
		properties.push({
			displayName: 'Put Output File in Field',
			name: BINARY_PROPERTY_PARAMETER,
			type: 'string',
			required: true,
			default: 'data',
			displayOptions,
			hint: 'The name of the output binary field to put the file in',
		});
	}

	return properties;
}

function fieldProperty(field: OperationField): INodeProperties {
	const property: INodeProperties = {
		displayName: field.displayName,
		name: field.name,
		type: field.type,
		default: field.default,
		description: field.description,
	};
	if (field.required) property.required = true;
	if (field.placeholder) property.placeholder = field.placeholder;
	if (field.options) property.options = field.options;
	if (field.typeOptions) property.typeOptions = { ...field.typeOptions };
	return property;
}
