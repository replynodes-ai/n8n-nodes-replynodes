const UTM = 'utm_source=n8n&utm_medium=integration&utm_campaign=n8n-node';

export const links = {
	signup: `https://platform.replynodes.com/sign-up?${UTM}`,
	apiKeys: `https://platform.replynodes.com/api-keys?${UTM}`,
	docs: `https://docs.replynodes.com?${UTM}`,
	apiReference: `https://docs.replynodes.com/reference?${UTM}`,
} as const;
