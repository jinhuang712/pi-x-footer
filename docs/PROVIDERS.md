# Provider Usage

Provider Usage is a separate, optional monitor for account-level quotas. It is cached in memory and does not block local Footer rendering or model requests.

## Supported providers

| Provider | ID | Windows |
| --- | --- | --- |
| OpenAI Codex | `openai-codex` | Relevant short-term and weekly windows when returned |
| OpenCode Go | `opencode-go` | Rolling/5h, weekly, and monthly windows when returned |
| Volcano Engine Agent Plan | `volcengine-agent-plan` | 5h, weekly, and monthly |
| Volcano Engine Coding Plan | `volcengine-coding-plan` | 5h/session, weekly, and monthly |

The monitor follows the provider and authentication used by the active Pi model. Codex CLI account data is not used as a fallback account.

## Volcano Engine setup

Install and authenticate the official CLI:

```bash
npm i -g @volcengine/ark-cli
arkcli auth login volc-sso
```

Agent Plan and Coding Plan quotas are read with the corresponding Ark CLI plan command. The model API key is not sent to Ark for this query.

## Matching and failure behavior

- Only official provider identities and origins are accepted.
- Custom and proxy origins are not queried.
- Missing subscriptions, unsupported providers, authentication failures, and network failures degrade to hidden, unavailable, or stale states.
- Cached data can remain visible as stale with a warning state.
- Raw provider responses, credentials, account IDs, and authorization headers are never rendered or persisted.

`pi-usage` can coexist with this extension, although both extensions may poll the same provider independently.

For adapter contracts, refresh policy, cache behavior, and fixtures, see [Provider Usage Specification](../specs/05-provider-usage.md).
