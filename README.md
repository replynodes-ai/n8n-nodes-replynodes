# ReplyNodes for n8n

Give your n8n workflows and AI agents clean web data. Turn any URL into Markdown, get a company's logo, colors, and fonts from its domain, and search, scrape, map, or crawl the web.

**URL to Markdown, Get Brand, and Get Logo Image are free and need no API key or signup.** Install the node and run them right away.

[ReplyNodes](https://replynodes.com?utm_source=n8n&utm_medium=integration&utm_campaign=n8n-readme) is a read-only web data API built for AI agents.

## Install

On n8n Cloud or a self-hosted instance:

1. Go to **Settings > Community Nodes**.
2. Click **Install**.
3. Enter `@replynodes/n8n-nodes-replynodes` and confirm.

The **ReplyNodes** node then shows up in the node panel. See n8n's [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) for details.

## Credentials

You don't need a credential for the free operations. Leave the credential field empty and run them.

For the other operations, or for higher daily limits:

1. [Create a free ReplyNodes account](https://platform.replynodes.com/sign-up?utm_source=n8n&utm_medium=integration&utm_campaign=n8n-readme). A free credit grant comes with your first API key.
2. Copy an API key from [your API keys page](https://platform.replynodes.com/api-keys?utm_source=n8n&utm_medium=integration&utm_campaign=n8n-readme).
3. In n8n, open the ReplyNodes node, choose **Create new credential**, and paste the key.

The key is only sent to `api.replynodes.com`. n8n tests it against a status endpoint that uses no credits.

## Operations

| Resource | Operation | What you get | API key |
| --- | --- | --- | --- |
| Web | URL to Markdown | The main content of a page as clean Markdown | Not needed (100 free calls a day) |
| Brand | Get Brand | Name, description, logos, colors, fonts, and social links for a domain | Not needed (20 free calls a day) |
| Brand | Get Logo Image | The logo as an image file (n8n binary data) | Not needed |
| Brand | Get Logo Kit | Logo, favicon, and social image URLs as JSON | Optional (free daily allowance without one) |
| Web | Search | Ranked web results with title, URL, and snippet | Optional (free daily allowance without one) |
| Web | Scrape | One page as Markdown plus metadata, links, and images | Optional (free daily allowance without one) |
| Brand | Get Fonts | Font families and where they are used | Required |
| Brand | Get Styleguide | Colors, typography, spacing, and component styles | Required |
| Brand | Search Brands | Companies matching a name, with domain and logo | Required |
| Web | Map Site | All the URLs of a website | Required |
| Web | Crawl Site | The content of up to 50 pages, following links from a start URL | Required |

Free limits are per caller per UTC day. When you hit one, the node tells you when it resets and how to get a key. Keyed operations use credits from your ReplyNodes account. See the [ReplyNodes docs](https://docs.replynodes.com?utm_source=n8n&utm_medium=integration&utm_campaign=n8n-readme) for current pricing.

Domain fields accept either `stripe.com` or a full URL like `https://stripe.com/pricing`. URL fields add `https://` if you leave it out.

## Examples

Copy a workflow below and paste it into an empty n8n canvas (Ctrl+V or Cmd+V).

### 1. Read a web page as Markdown

Manual Trigger, then URL to Markdown. The output has `url` and `markdown` fields, ready to pass to an LLM node.

```json
{
  "nodes": [
    { "parameters": {}, "name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0] },
    {
      "parameters": { "resource": "web", "operation": "urlToMarkdown", "url": "https://docs.n8n.io" },
      "name": "URL to Markdown", "type": "@replynodes/n8n-nodes-replynodes.replyNodes", "typeVersion": 1, "position": [220, 0]
    }
  ],
  "connections": { "Start": { "main": [[{ "node": "URL to Markdown", "type": "main", "index": 0 }]] } }
}
```

### 2. Look up a company's brand and logo

Get Brand returns colors, fonts, and logo URLs. Get Logo Image returns the logo file itself, which you can upload to Google Drive, Slack, or a CMS.

```json
{
  "nodes": [
    { "parameters": {}, "name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0] },
    {
      "parameters": { "resource": "brand", "operation": "getBrand", "domain": "stripe.com" },
      "name": "Get Brand", "type": "@replynodes/n8n-nodes-replynodes.replyNodes", "typeVersion": 1, "position": [220, -100]
    },
    {
      "parameters": { "resource": "brand", "operation": "getLogoImage", "domain": "stripe.com" },
      "name": "Get Logo Image", "type": "@replynodes/n8n-nodes-replynodes.replyNodes", "typeVersion": 1, "position": [220, 100]
    }
  ],
  "connections": {
    "Start": { "main": [[
      { "node": "Get Brand", "type": "main", "index": 0 },
      { "node": "Get Logo Image", "type": "main", "index": 0 }
    ]] }
  }
}
```

### 3. Search the web, then read the top result

Search returns ranked results. The second node reads the first result's URL as Markdown.

```json
{
  "nodes": [
    { "parameters": {}, "name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0] },
    {
      "parameters": { "resource": "web", "operation": "search", "text": "n8n community nodes", "options": { "limit": 3 } },
      "name": "Search", "type": "@replynodes/n8n-nodes-replynodes.replyNodes", "typeVersion": 1, "position": [220, 0]
    },
    {
      "parameters": { "resource": "web", "operation": "urlToMarkdown", "url": "={{ $json.data.data[0].url }}" },
      "name": "Read Top Result", "type": "@replynodes/n8n-nodes-replynodes.replyNodes", "typeVersion": 1, "position": [440, 0]
    }
  ],
  "connections": {
    "Start": { "main": [[{ "node": "Search", "type": "main", "index": 0 }]] },
    "Search": { "main": [[{ "node": "Read Top Result", "type": "main", "index": 0 }]] }
  }
}
```

## Use it as an AI Agent tool

The node works as a tool for n8n's **AI Agent** node, so your agent can read pages, look up brands, and search the web on its own.

1. Add an **AI Agent** node and connect a chat model.
2. Under **Tools**, click **+** and search for **ReplyNodes**.
3. Pick an operation, such as URL to Markdown. To let the agent fill a field, click the sparkle icon next to it (**Let the model define this parameter**).
4. Add one ReplyNodes tool per operation the agent should have.

Every operation has a description that tells the agent what it returns and whether it needs an API key.

**Self-hosted n8n 1.x:** older versions only show community nodes as AI tools when n8n runs with this environment variable. Current n8n 2.x versions don't need it.

```sh
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

Get Logo Image returns a file, which AI agents can't read. Use Get Brand or Get Logo Kit as tools instead.

## Errors and limits

- **Free daily limit reached (429):** the error says when the limit resets (UTC midnight). Add an API key for higher limits.
- **Temporarily unavailable (5xx):** usually brief. Turn on **Retry On Fail** in the node settings.
- **Invalid domain or URL:** fails before any request is sent.
- Turn on **Continue On Fail** to keep processing the other items. Failed items get an `error` field.

## Privacy

The node only calls ReplyNodes hosts (`md.`, `brand.`, `img.`, and `api.replynodes.com`), and only when your workflow runs an operation. Each request includes an `x-replynodes-source: n8n` header and the node version, so ReplyNodes can count usage from n8n. It sends no other telemetry or identifiers.

## Development

See [`agents.md`](agents.md) for setup, tests, and lint.

A Zapier integration is planned separately.

## License

[MIT](LICENSE)
