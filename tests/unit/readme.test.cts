import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { findOperation } from '../../nodes/ReplyNodes/operations';

const NODE_TYPES = new Set([
	'@replynodes/n8n-nodes-replynodes.replyNodes',
	'@replynodes/n8n-nodes-replynodes.replyNodesTool',
]);

interface WorkflowNode {
	name: string;
	type: string;
	typeVersion: number;
	parameters: Record<string, unknown>;
}

function workflowSources(): string[] {
	const readme = readFileSync('README.md', 'utf8');
	const examples = [...readme.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);
	assert.ok(examples.length >= 3, 'at least three README examples');
	const recipes = readdirSync('recipes')
		.filter((f) => f.endsWith('.json'))
		.map((f) => readFileSync(`recipes/${f}`, 'utf8'));
	assert.ok(recipes.length >= 3, 'at least three recipes');
	return [...examples, ...recipes];
}

test('README examples and recipes use real operations with their required fields', () => {
	for (const block of workflowSources()) {
		const workflow = JSON.parse(block) as {
			nodes: WorkflowNode[];
			connections: Record<string, Record<string, Array<Array<{ node: string }>>>>;
		};
		const names = new Set(workflow.nodes.map((n) => n.name));
		for (const [from, outputs] of Object.entries(workflow.connections)) {
			assert.ok(names.has(from), `connection from unknown node ${from}`);
			for (const target of Object.values(outputs).flat(2)) {
				assert.ok(names.has(target.node), `connection to unknown node ${target.node}`);
			}
		}
		for (const node of workflow.nodes.filter((n) => NODE_TYPES.has(n.type))) {
			assert.equal(node.typeVersion, 1);
			const { resource, operation } = node.parameters as { resource: string; operation: string };
			const definition = findOperation(resource, operation);
			assert.ok(definition, `${node.name}: unknown operation ${resource}/${operation}`);
			for (const field of (definition.fields ?? []).filter((f) => f.required)) {
				assert.ok(node.parameters[field.name], `${node.name}: missing ${field.name}`);
			}
		}
	}
});
