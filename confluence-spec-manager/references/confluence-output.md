# Confluence Output And Live Page Workflow

Use this reference when producing Confluence-ready content or reading/updating live Confluence pages.

## Output Formats

### Markdown

Use Markdown when the user wants easy review or manual paste into Confluence.

Guidelines:

- Use `#`, `##`, and `###` headings.
- Use tables for schemas, response codes, config, schedules, and field mappings.
- Use fenced code blocks with language hints: `json`, `sql`, `yaml`, `plantuml`, `sh`.
- Keep all prose in English unless the user asks otherwise.

### Confluence Storage XML

Use storage XML when the user wants API-ready content for Confluence Cloud REST v1 page updates.

Common fragments:

```xml
<h1>Change Log</h1>
<table>
  <tbody>
    <tr><th>Date</th><th>Updated By</th><th>Description</th><th>Status</th></tr>
    <tr><td>YYYY-MM-DD</td><td>Name/team</td><td>Initial draft</td><td>Draft</td></tr>
  </tbody>
</table>
```

Code block macro:

```xml
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">json</ac:parameter>
  <ac:plain-text-body><![CDATA[
{
  "code": 1000,
  "message": "Success"
}
]]></ac:plain-text-body>
</ac:structured-macro>
```

PlantUML should be provided as a fenced `plantuml` block in Markdown unless the user confirms the target Confluence app and macro name.

### ADF

Confluence Cloud editor pages may use Atlassian Document Format in newer APIs. If the user asks for ADF, generate a simple JSON document only when the target API is known. Otherwise, provide Markdown or storage XML and explain the conversion assumption.

## Credential Collection

Ask for credentials only when live Confluence read or edit is requested. Required inputs:

- Confluence base URL, for example `https://example.atlassian.net/wiki`
- Page URL or page ID
- Atlassian account email
- Atlassian API token
- Desired action: read, preview update, or execute update

Tell the user how to create a token:

1. Go to `https://id.atlassian.com/manage-profile/security/api-tokens`.
2. Select `Create API token`.
3. Give it a clear label, such as `codex-confluence-spec-edit`.
4. Copy the token once and provide it only for the current task.
5. Revoke or rotate the token after the task if it was pasted into a chat or terminal.

Credential rules:

- Never save tokens in files, generated pages, code, logs, or shell history.
- Prefer reading credentials from environment variables or an interactive hidden prompt.
- Redact `Authorization` headers and token-like strings from diagnostics.
- Do not include tokens in final answers.

Suggested environment variables for local commands:

```sh
CONFLUENCE_BASE_URL=https://example.atlassian.net/wiki
CONFLUENCE_EMAIL=user@example.com
CONFLUENCE_API_TOKEN=<token>
CONFLUENCE_PAGE_ID=<page-id>
```

## Read Workflow

1. Confirm the target page URL or ID.
2. Use Basic Auth with email and API token.
3. Fetch page title, version, and body.
4. Summarize only the content needed for the task.
5. Avoid storing full page bodies unless the user explicitly asks for an export.

REST v1 read shape:

```http
GET /rest/api/content/{pageId}?expand=body.storage,version
```

## Edit Workflow

Always do a preview first unless the user explicitly requests execution.

1. Fetch current page title, version, and body.
2. Prepare updated body.
3. Show a concise diff or replacement summary.
4. Ask for explicit confirmation when execution is not already clearly requested.
5. Update using current version + 1.
6. Re-read page metadata to verify the version changed.

REST v1 update shape:

```http
PUT /rest/api/content/{pageId}
Content-Type: application/json

{
  "id": "<pageId>",
  "type": "page",
  "title": "<existing or new title>",
  "version": { "number": <currentVersion + 1> },
  "body": {
    "storage": {
      "value": "<storage xml>",
      "representation": "storage"
    }
  }
}
```

Do not execute writes if page ID, current version, title, target body, or credentials are ambiguous.
