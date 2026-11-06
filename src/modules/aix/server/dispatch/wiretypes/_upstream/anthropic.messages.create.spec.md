<!--
  Upstream snapshot - DO NOT EDIT - run _upstream/sync.sh to refresh
  Source: https://platform.claude.com/docs/en/api/messages/create.md
  Synced: 2026-11-06
  Consumed by: anthropic.wiretypes.ts, anthropic.parser.ts, anthropic.messageCreate.ts, anthropic.transform-fileInline.ts
-->

---
title: Create a Message
url: https://platform.claude.com/docs/en/api/messages/create
---

# Create a Message

**POST** `/v1/messages`

Send a structured list of input messages with text and/or image content, and the model will generate the next message in the conversation.

The Messages API can be used for either single queries or stateless multi-turn conversations.

Learn more about the Messages API in our [user guide](https://platform.claude.com/docs/en/get-started?sdk_languages=http)

## Headers

- `"anthropic-version": optional string`

  The version of the Claude API you want to use.

  Read more about versioning and our version history [here](https://platform.claude.com/docs/en/api/versioning?sdk_languages=http).

- `"anthropic-user-profile-id": optional string`

  The user profile ID to attribute this request to. Use when acting on behalf of a party other than your organization.

- `"anthropic-workspace-id": optional string`

  Optional header to select the Workspace for this request. The value is a Workspace ID (for example, `wrkspc_011CZkZaBF1tNoB5wlCeusgy`).

  Only needed for credentials that can act on more than one Workspace. A credential that belongs to a specific Workspace may omit it; if sent, it must match that Workspace.

## Body parameters

- `max_tokens: number`

  The maximum number of tokens to generate before stopping.

  Note that our models may stop _before_ reaching this maximum. This parameter only specifies the absolute maximum number of tokens to generate.

  Set to `0` to populate the [prompt cache](https://platform.claude.com/docs/en/build-with-claude/prompt-caching?sdk_languages=http#pre-warming-the-cache) without generating a response.

  Different models have different maximum values for this parameter.  See [models](https://platform.claude.com/docs/en/about-claude/models/overview?sdk_languages=http) for details.

  minimum: 0

- `messages: array of MessageParam`

  Input messages.

  Our models are trained to operate on alternating `user` and `assistant` conversational turns. When creating a new `Message`, you specify the prior conversational turns with the `messages` parameter, and the model then generates the next `Message` in the conversation. Consecutive `user` or `assistant` turns in your request will be combined into a single turn.

  Each input message must be an object with a `role` and `content`. You can specify a single `user`-role message, or you can include multiple `user` and `assistant` messages.

  If the final message uses the `assistant` role, the response content will continue immediately from the content in that message. This can be used to constrain part of the model's response. This is called prefill. On models that don't support prefill, creating a message that ends with a partial `assistant` response returns a 400 error. See [Prefill not supported](https://platform.claude.com/docs/en/api/errors?sdk_languages=http#prefill-not-supported).

  Example with a single `user` message:

  ```json
  [{"role": "user", "content": "Hello, Claude"}]
  ```

  Example with multiple conversational turns:

  ```json
  [
    {"role": "user", "content": "Hello there."},
    {"role": "assistant", "content": "Hi, I'm Claude. How can I help you?"},
    {"role": "user", "content": "Can you explain LLMs in plain English?"},
  ]
  ```

  Example with a partially-filled response from Claude, for models that support prefill:

  ```json
  [
    {"role": "user", "content": "What's the Greek name for Sun? (A) Sol (B) Helios (C) Sun"},
    {"role": "assistant", "content": "The best answer is ("},
  ]
  ```

  Each input message `content` may be either a single `string` or an array of content blocks, where each block has a specific `type`. Using a `string` for `content` is shorthand for an array of one content block of type `"text"`. The following input messages are equivalent:

  ```json
  {"role": "user", "content": "Hello, Claude"}
  ```

  ```json
  {"role": "user", "content": [{"type": "text", "text": "Hello, Claude"}]}
  ```

  See [input examples](https://platform.claude.com/docs/en/build-with-claude/working-with-messages?sdk_languages=http).

  Note that if you want to include a [system prompt](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices?sdk_languages=http#give-claude-a-role), you can use the top-level `system` parameter.

  There is a limit of 100,000 messages in a single request.

  - `UserMessageParam object`

    - `content: MessageContentParam`

      - `string`

      - `array of ContentBlockParam`

        - `TextBlockParam object`

          - `type: "text"`

          - `text: string`

            minLength: 1

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

            - `type: "ephemeral"`

            - `ttl: optional "5m" or "1h"`

              The time-to-live for the cache control breakpoint.

              This may be one the following values:

              - `5m`: 5 minutes
              - `1h`: 1 hour

              Defaults to `5m`. See [prompt caching pricing](https://platform.claude.com/docs/en/build-with-claude/prompt-caching?sdk_languages=http) for details.

              - `"5m"`

              - `"1h"`

          - `citations: optional array of TextCitationParam or null`

            - `CitationCharLocationParam object`

              - `type: "char_location"`

              - `cited_text: string`

              - `document_index: number`

                minimum: 0

              - `document_title: string or null`

                minLength: 1, maxLength: 500

              - `end_char_index: number`

              - `start_char_index: number`

                minimum: 0

            - `CitationPageLocationParam object`

              - `type: "page_location"`

              - `cited_text: string`

              - `document_index: number`

                minimum: 0

              - `document_title: string or null`

                minLength: 1, maxLength: 500

              - `end_page_number: number`

              - `start_page_number: number`

                minimum: 1

            - `CitationContentBlockLocationParam object`

              - `type: "content_block_location"`

              - `cited_text: string`

                The full text of the cited block range, concatenated.

                Always equals the contents of `content[start_block_index:end_block_index]` joined together. The text block is the minimal citable unit; this field is never a substring of a single block. Not counted toward output tokens, and not counted toward input tokens when sent back in subsequent turns.

              - `document_index: number`

                minimum: 0

              - `document_title: string or null`

                minLength: 1, maxLength: 500

              - `end_block_index: number`

                Exclusive 0-based end index of the cited block range in the source's `content` array.

                Always greater than `start_block_index`; a single-block citation has `end_block_index = start_block_index + 1`.

              - `start_block_index: number`

                0-based index of the first cited block in the source's `content` array.

                minimum: 0

            - `CitationWebSearchResultLocationParam object`

              - `type: "web_search_result_location"`

              - `cited_text: string`

              - `encrypted_index: string`

              - `title: string or null`

                minLength: 1, maxLength: 512

              - `url: string`

                minLength: 1

            - `CitationSearchResultLocationParam object`

              - `type: "search_result_location"`

              - `cited_text: string`

                The full text of the cited block range, concatenated.

                Always equals the contents of `content[start_block_index:end_block_index]` joined together. The text block is the minimal citable unit; this field is never a substring of a single block. Not counted toward output tokens, and not counted toward input tokens when sent back in subsequent turns.

              - `end_block_index: number`

                Exclusive 0-based end index of the cited block range in the source's `content` array.

                Always greater than `start_block_index`; a single-block citation has `end_block_index = start_block_index + 1`.

              - `search_result_index: number`

                0-based index of the cited search result among all `search_result` content blocks in the request, in the order they appear across messages and tool results.

                Counted separately from `document_index`; server-side web search results are not included in this count.

                minimum: 0

              - `source: string`

              - `start_block_index: number`

                0-based index of the first cited block in the source's `content` array.

                minimum: 0

              - `title: string or null`

        - `ImageBlockParam object`

          - `type: "image"`

          - `source: Base64ImageSource or URLImageSource or FileImageSource`

            - `Base64ImageSource object`

              - `type: "base64"`

              - `data: string`

                format: byte

              - `media_type: "image/jpeg" or "image/png" or "image/gif" or "image/webp"`

                - `"image/jpeg"`

                - `"image/png"`

                - `"image/gif"`

                - `"image/webp"`

            - `URLImageSource object`

              - `type: "url"`

              - `url: string`

            - `FileImageSource object`

              - `type: "file"`

              - `file_id: string`

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

          - `transformations: optional ImageTransformationsParam or null`

            Configures the transformations the server applies to this image before the model observes it. Each key names a condition the server transforms images for; its value selects the transformation applied. Omitted keys keep their default behavior, and an empty object is equivalent to omitting the field.

            - `oversized_image: optional "downsize" or "error"`

              What the server does when this image exceeds the model's maximum image size. `"downsize"` (the default) scales the image down to fit, which changes the dimensions the model observes without telling you. `"error"` instead rejects the request with a 400 error naming the image's dimensions and the largest dimensions that fit, so you can scale the image deliberately — your image is never silently scaled down.

              - `"downsize"`

              - `"error"`

        - `DocumentBlockParam object`

          - `type: "document"`

          - `source: Base64PDFSource or PlainTextSource or ContentBlockSource or 2 more`

            - `Base64PDFSource object`

              - `type: "base64"`

              - `data: string`

                format: byte

              - `media_type: "application/pdf"`

            - `PlainTextSource object`

              - `type: "text"`

              - `data: string`

              - `media_type: "text/plain"`

            - `ContentBlockSource object`

              - `type: "content"`

              - `content: string or array of ContentBlockSourceContent`

                - `string`

                - `ContentBlockSourceContent = array of ContentBlockSourceContent`

                  - `TextBlockParam object`

                  - `ImageBlockParam object`

            - `URLPDFSource object`

              - `type: "url"`

              - `url: string`

            - `FileDocumentSource object`

              - `type: "file"`

              - `file_id: string`

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

          - `citations: optional CitationsConfigParam or null`

            - `enabled: optional boolean`

          - `context: optional string or null`

            minLength: 1

          - `title: optional string or null`

            minLength: 1, maxLength: 500

        - `SearchResultBlockParam object`

          - `type: "search_result"`

          - `content: array of TextBlockParam`

            - `type: "text"`

            - `text: string`

              minLength: 1

            - `cache_control: optional CacheControlEphemeral or null`

              Create a cache control breakpoint at this content block.

            - `citations: optional array of TextCitationParam or null`

          - `source: string`

          - `title: string`

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

          - `citations: optional CitationsConfigParam`

        - `ThinkingBlockParam object`

          - `type: "thinking"`

          - `signature: string`

            The `signature` value of this thinking block, exactly as returned by the API in a previous response. Used to verify that the block was generated by Claude.

            Thinking blocks must be passed back unmodified and in their original order; a modified block results in a 400 `invalid_request_error`.

          - `thinking: string`

            The `thinking` text of this block as returned by the API.

        - `RedactedThinkingBlockParam object`

          - `type: "redacted_thinking"`

          - `data: string`

            The `data` value of this redacted thinking block, exactly as returned by the API in a previous response. Opaque and encrypted; pass it back unchanged.

        - `ToolUseBlockParam object`

          - `type: "tool_use"`

          - `id: string`

            pattern: ^[a-zA-Z0-9_-]+$

          - `input: map[unknown]`

          - `name: string`

            minLength: 1, maxLength: 200

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

          - `caller: optional DirectCaller or ServerToolCaller or ServerToolCaller20260120`

            - `DirectCaller object`

              Tool invocation directly from the model.

              - `type: "direct"`

            - `ServerToolCaller object`

              Tool invocation generated by a server-side tool.

              - `type: "code_execution_20250825"`

              - `tool_id: string`

                pattern: ^srvtoolu_[a-zA-Z0-9_]+$

            - `ServerToolCaller20260120 object`

              - `type: "code_execution_20260120"`

              - `tool_id: string`

                pattern: ^srvtoolu_[a-zA-Z0-9_]+$

          - `toolset_name: optional string or null`

            For a toolset member tool_use, the toolset family this member belongs to.

            minLength: 1, maxLength: 64, pattern: ^[a-zA-Z0-9_-]+$

        - `ToolResultBlockParam object`

          - `type: "tool_result"`

          - `tool_use_id: string`

            pattern: ^[a-zA-Z0-9_-]+$

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

          - `content: optional string or array of TextBlockParam or ImageBlockParam or SearchResultBlockParam or 3 more`

            - `string`

            - `array of TextBlockParam or ImageBlockParam or SearchResultBlockParam or 3 more`

              - `TextBlockParam object`

              - `ImageBlockParam object`

              - `SearchResultBlockParam object`

              - `DocumentBlockParam object`

              - `ToolReferenceBlockParam object`

                Tool reference block that can be included in tool_result content.

                - `type: "tool_reference"`

                - `tool_name: string`

                  minLength: 1, maxLength: 256, pattern: ^[a-zA-Z0-9_-]{1,256}$

                - `cache_control: optional CacheControlEphemeral or null`

                  Create a cache control breakpoint at this content block.

              - `BrowserStateBlockParam object`

                The caller's browser state after a browser toolset member call —
                the full inventory of open tabs, which tab is active, and any side
                effects (tabs opened, download state changes) the call produced.

                At most one per `tool_result`, only on a non-error result answering a
                browser toolset member `tool_use`. The server renders the
                model-visible text from it; the model never sees the raw fields.

                - `type: "browser_state"`

                - `tabs: array of BrowserStateTabEntry`

                  All tabs open in the browser after this call — the full inventory, not a delta. May be empty. Whenever non-empty, exactly one entry carries `active: true`.

                  maxItems: 100

                  - `tab_id: string`

                    The caller-assigned identifier for this tab, unique within the inventory.

                    minLength: 1, maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

                  - `title: string`

                    The title of the page the tab is showing. May be empty.

                    maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

                  - `url: string`

                    The URL of the page the tab is showing. May be empty.

                    maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

                  - `active: optional boolean`

                    Whether this tab is the active tab after this call. Whenever `tabs` is non-empty, exactly one entry is marked `active: true`.

                - `cache_control: optional CacheControlEphemeral or null`

                  Create a cache control breakpoint at this content block.

                - `state_changes: optional array of BrowserStateChange or null`

                  Tabs opened and download state changes during this call. "Nothing to report" is expressed by omitting the field, never by an empty list.

                  minItems: 1, maxItems: 200

                  - `BrowserStateChangeTabOpened object`

                    A tab this call's execution opened that remains open at its end —
                    the creation delta of the `tabs` inventory, not an event log.

                    Carries only the `tab_id`; the tab's `title` and `url` live on its
                    `tabs` entry, which must include the same `tab_id`. A tab opened
                    during a failed call gets no deferred `tab_opened`; it simply appears
                    in the next result's `tabs` inventory.

                    - `type: "tab_opened"`

                    - `tab_id: string`

                      The `tab_id` of the opened tab, present in `tabs`.

                      minLength: 1, maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

                  - `BrowserStateChangeDownloadStarted object`

                    A file download that started during this call.

                    - `type: "download_started"`

                    - `download_id: string`

                      The caller-assigned identifier for this download, stable across the state changes reporting it.

                      minLength: 1, maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

                    - `url: string`

                      The final post-redirect URL the download was served from.

                      maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

                  - `BrowserStateChangeDownloadCompleted object`

                    A file download that finished during this call, reported with the
                    same `download_id` as its `download_started` — or without a prior
                    `download_started`, when the download finished during the call that
                    started it (at most one state change per `download_id` per result).

                    - `type: "download_completed"`

                    - `download_id: string`

                      The caller-assigned identifier for this download, stable across the state changes reporting it.

                      minLength: 1, maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

                    - `url: string`

                      The final post-redirect URL the download was served from.

                      maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

                    - `path: optional string or null`

                      Where the executor saved the file, on the executor's filesystem. Only included when another tool in the same environment can read the file at that path.

                      maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

                    - `size_bytes: optional number or null`

                      The completed download's size.

                      minimum: 0

                  - `BrowserStateChangeDownloadFailed object`

                    A file download that failed — or was cancelled — during this call.

                    - `type: "download_failed"`

                    - `download_id: string`

                      The caller-assigned identifier for this download, stable across the state changes reporting it.

                      minLength: 1, maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

                    - `url: string`

                      The final post-redirect URL the download was served from.

                      maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

                    - `error: optional string or null`

                      The failure or cancellation detail, when known.

                      maxLength: 4096, pattern: ^[^\x00-\x1f\x7f-\x9f\u2028\u2029]*$

          - `is_error: optional boolean`

          - `toolset_name: optional string or null`

            For a toolset member tool_result, the toolset family of the paired tool_use.

            minLength: 1, maxLength: 64, pattern: ^[a-zA-Z0-9_-]+$

        - `ServerToolUseBlockParam object`

          - `type: "server_tool_use"`

          - `id: string`

            pattern: ^srvtoolu_[a-zA-Z0-9_]+$

          - `input: map[unknown]`

          - `name: "web_search" or "web_fetch" or "code_execution" or 4 more`

            - `"web_search"`

            - `"web_fetch"`

            - `"code_execution"`

            - `"bash_code_execution"`

            - `"text_editor_code_execution"`

            - `"tool_search_tool_regex"`

            - `"tool_search_tool_bm25"`

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

          - `caller: optional DirectCaller or ServerToolCaller or ServerToolCaller20260120`

            - `DirectCaller object`

              Tool invocation directly from the model.

            - `ServerToolCaller object`

              Tool invocation generated by a server-side tool.

            - `ServerToolCaller20260120 object`

        - `WebSearchToolResultBlockParam object`

          - `type: "web_search_tool_result"`

          - `content: WebSearchToolResultBlockParamContent`

            - `WebSearchToolResultBlockItem = array of WebSearchResultBlockParam`

              - `type: "web_search_result"`

              - `encrypted_content: string`

              - `title: string`

              - `url: string`

              - `page_age: optional string or null`

            - `WebSearchToolRequestError object`

              - `type: "web_search_tool_result_error"`

              - `error_code: WebSearchToolResultErrorCode`

                - `"invalid_tool_input"`

                - `"unavailable"`

                - `"max_uses_exceeded"`

                - `"too_many_requests"`

                - `"query_too_long"`

                - `"request_too_large"`

          - `tool_use_id: string`

            pattern: ^srvtoolu_[a-zA-Z0-9_]+$

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

          - `caller: optional DirectCaller or ServerToolCaller or ServerToolCaller20260120`

            - `DirectCaller object`

              Tool invocation directly from the model.

            - `ServerToolCaller object`

              Tool invocation generated by a server-side tool.

            - `ServerToolCaller20260120 object`

        - `WebFetchToolResultBlockParam object`

          - `type: "web_fetch_tool_result"`

          - `content: WebFetchToolResultErrorBlockParam or WebFetchBlockParam`

            - `WebFetchToolResultErrorBlockParam object`

              - `type: "web_fetch_tool_result_error"`

              - `error_code: WebFetchToolResultErrorCode`

                - `"invalid_tool_input"`

                - `"url_too_long"`

                - `"url_not_allowed"`

                - `"url_not_in_prior_context"`

                - `"url_not_accessible"`

                - `"unsupported_content_type"`

                - `"too_many_requests"`

                - `"max_uses_exceeded"`

                - `"unavailable"`

                - `"content_too_large"`

            - `WebFetchBlockParam object`

              - `type: "web_fetch_result"`

              - `content: DocumentBlockParam`

              - `url: string`

                Fetched content URL

              - `retrieved_at: optional string or null`

                ISO 8601 timestamp when the content was retrieved

          - `tool_use_id: string`

            pattern: ^srvtoolu_[a-zA-Z0-9_]+$

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

          - `caller: optional DirectCaller or ServerToolCaller or ServerToolCaller20260120`

            - `DirectCaller object`

              Tool invocation directly from the model.

            - `ServerToolCaller object`

              Tool invocation generated by a server-side tool.

            - `ServerToolCaller20260120 object`

        - `CodeExecutionToolResultBlockParam object`

          - `type: "code_execution_tool_result"`

          - `content: CodeExecutionToolResultBlockParamContent`

            - `CodeExecutionToolResultErrorParam object`

              - `type: "code_execution_tool_result_error"`

              - `error_code: CodeExecutionToolResultErrorCode`

                - `"invalid_tool_input"`

                - `"unavailable"`

                - `"too_many_requests"`

                - `"execution_time_exceeded"`

            - `CodeExecutionResultBlockParam object`

              - `type: "code_execution_result"`

              - `content: array of CodeExecutionOutputBlockParam`

                - `type: "code_execution_output"`

                - `file_id: string`

              - `return_code: number`

              - `stderr: string`

              - `stdout: string`

            - `EncryptedCodeExecutionResultBlockParam object`

              The output and exit code of Python code that Claude ran with the code execution tool, with standard output in encrypted form, sent back in a later request.

              - `type: "encrypted_code_execution_result"`

              - `content: array of CodeExecutionOutputBlockParam`

                - `type: "code_execution_output"`

                - `file_id: string`

              - `encrypted_stdout: string`

              - `return_code: number`

              - `stderr: string`

          - `tool_use_id: string`

            pattern: ^srvtoolu_[a-zA-Z0-9_]+$

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

        - `BashCodeExecutionToolResultBlockParam object`

          - `type: "bash_code_execution_tool_result"`

          - `content: BashCodeExecutionToolResultErrorParam or BashCodeExecutionResultBlockParam`

            - `BashCodeExecutionToolResultErrorParam object`

              - `type: "bash_code_execution_tool_result_error"`

              - `error_code: BashCodeExecutionToolResultErrorCode`

                - `"invalid_tool_input"`

                - `"unavailable"`

                - `"too_many_requests"`

                - `"execution_time_exceeded"`

                - `"output_file_too_large"`

            - `BashCodeExecutionResultBlockParam object`

              - `type: "bash_code_execution_result"`

              - `content: array of BashCodeExecutionOutputBlockParam`

                - `type: "bash_code_execution_output"`

                - `file_id: string`

              - `return_code: number`

              - `stderr: string`

              - `stdout: string`

          - `tool_use_id: string`

            pattern: ^srvtoolu_[a-zA-Z0-9_]+$

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

        - `TextEditorCodeExecutionToolResultBlockParam object`

          - `type: "text_editor_code_execution_tool_result"`

          - `content: TextEditorCodeExecutionToolResultErrorParam or TextEditorCodeExecutionViewResultBlockParam or TextEditorCodeExecutionCreateResultBlockParam or TextEditorCodeExecutionStrReplaceResultBlockParam`

            - `TextEditorCodeExecutionToolResultErrorParam object`

              - `type: "text_editor_code_execution_tool_result_error"`

              - `error_code: TextEditorCodeExecutionToolResultErrorCode`

                - `"invalid_tool_input"`

                - `"unavailable"`

                - `"too_many_requests"`

                - `"execution_time_exceeded"`

                - `"file_not_found"`

              - `error_message: optional string or null`

            - `TextEditorCodeExecutionViewResultBlockParam object`

              - `type: "text_editor_code_execution_view_result"`

              - `content: string`

              - `file_type: "text" or "image" or "pdf"`

                - `"text"`

                - `"image"`

                - `"pdf"`

              - `num_lines: optional number or null`

              - `start_line: optional number or null`

              - `total_lines: optional number or null`

            - `TextEditorCodeExecutionCreateResultBlockParam object`

              - `type: "text_editor_code_execution_create_result"`

              - `is_file_update: boolean`

            - `TextEditorCodeExecutionStrReplaceResultBlockParam object`

              - `type: "text_editor_code_execution_str_replace_result"`

              - `lines: optional array of string or null`

              - `new_lines: optional number or null`

              - `new_start: optional number or null`

              - `old_lines: optional number or null`

              - `old_start: optional number or null`

          - `tool_use_id: string`

            pattern: ^srvtoolu_[a-zA-Z0-9_]+$

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

        - `ToolSearchToolResultBlockParam object`

          - `type: "tool_search_tool_result"`

          - `content: ToolSearchToolResultErrorParam or ToolSearchToolSearchResultBlockParam`

            - `ToolSearchToolResultErrorParam object`

              - `type: "tool_search_tool_result_error"`

              - `error_code: ToolSearchToolResultErrorCode`

                - `"invalid_tool_input"`

                - `"unavailable"`

                - `"too_many_requests"`

                - `"execution_time_exceeded"`

              - `error_message: optional string or null`

            - `ToolSearchToolSearchResultBlockParam object`

              - `type: "tool_search_tool_search_result"`

              - `tool_references: array of ToolReferenceBlockParam`

                - `type: "tool_reference"`

                - `tool_name: string`

                  minLength: 1, maxLength: 256, pattern: ^[a-zA-Z0-9_-]{1,256}$

                - `cache_control: optional CacheControlEphemeral or null`

                  Create a cache control breakpoint at this content block.

          - `tool_use_id: string`

            pattern: ^srvtoolu_[a-zA-Z0-9_]+$

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

        - `ContainerUploadBlockParam object`

          A content block that represents a file to be uploaded to the container
          Files uploaded via this block will be available in the container's input directory.

          - `type: "container_upload"`

          - `file_id: string`

          - `cache_control: optional CacheControlEphemeral or null`

            Create a cache control breakpoint at this content block.

    - `role: "user"`

  - `AssistantMessageParam object`

    - `content: MessageContentParam`

    - `role: "assistant"`

  - `SystemMessageParam object`

    - `content: string or array of TextBlockParam`

      - `string`

      - `Blocks = array of TextBlockParam`

        - `type: "text"`

        - `text: string`

          minLength: 1

        - `cache_control: optional CacheControlEphemeral or null`

          Create a cache control breakpoint at this content block.

        - `citations: optional array of TextCitationParam or null`

    - `role: "system"`

- `model: Model`

  The model that will complete your prompt.

  See [models](https://docs.anthropic.com/en/docs/models-overview) for additional details and options.

  - `"claude-haiku-5-5"`

    Fastest model for high-volume, real-time tasks

  - `"claude-sonnet-5-5"`

    Efficient model for coding and agents

  - `"claude-fable-5-1"`

    Frontier intelligence for ambitious tasks across coding, scientific discovery, and enterprise workflows

  - `"claude-opus-5-5"`

    Powerful intelligence for coding, knowledge work, and long-running agents

  - `"claude-mythos-5-1"`

    Our most capable model for cybersecurity and biology research, available through trusted access programs

  - `"claude-sonnet-5"`

    Efficient model for coding and agents

  - `"claude-fable-5"`

    Next generation of intelligence for the hardest knowledge work and coding problems

  - `"claude-mythos-5"`

    Most capable model for cybersecurity and biology research

  - `"claude-opus-5"`

    Powerful intelligence for long-running agents and coding

  - `"claude-opus-4-8"`

    Powerful intelligence for long-running agents and coding

  - `"claude-opus-4-7"`

    Powerful intelligence for long-running agents and coding

  - `"claude-opus-4-6"`

    Powerful intelligence for long-running agents and coding

  - `"claude-sonnet-4-6"`

    Best combination of speed and intelligence

  - `"claude-haiku-4-5"`

  - `"claude-haiku-4-5-20251001"`

  - `"claude-opus-4-5"`

    Powerful intelligence for long-running agents and coding

  - `"claude-opus-4-5-20251101"`

    Powerful intelligence for long-running agents and coding

  - `"claude-mythos-preview"`

    **Deprecated**: Will reach end-of-life on June 30, 2026. Please migrate to claude-mythos-5. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.

    New class of intelligence, strongest in coding and cybersecurity

  - `"claude-sonnet-4-5"`

    **Deprecated**: Will reach end-of-life on November 30, 2026. Please migrate to claude-sonnet-5-5. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.

    High-performance model for agents and coding

  - `"claude-sonnet-4-5-20250929"`

    **Deprecated**: Will reach end-of-life on November 30, 2026. Please migrate to claude-sonnet-5-5. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.

    High-performance model for agents and coding

  - `string`

- `cache_control: optional CacheControlEphemeral or null`

  Top-level cache control automatically applies a cache_control marker to the last cacheable block in the request.

- `container: optional MessageCreateParamsContainer or null`

  Container identifier for reuse across requests.

  - `ContainerParams object`

    Container parameters with skills to be loaded.

    - `id: optional string or null`

      Container id

    - `skills: optional array of SkillParams or null`

      List of skills to load in the container

      maxItems: 20

      - `type: "anthropic" or "custom"`

        Type of skill - either 'anthropic' (built-in) or 'custom' (user-defined)

        - `"anthropic"`

        - `"custom"`

      - `skill_id: string`

        Skill ID

        minLength: 1, maxLength: 64

      - `version: optional string`

        Skill version or 'latest' for most recent version

        minLength: 1, maxLength: 64

  - `string`

- `diagnostics: optional DiagnosticsParam or null`

  Request-level diagnostics. Supply `previous_message_id` to have the response include `diagnostics.cache_miss_reason` explaining any prompt-cache divergence from that prior request.

  - `previous_message_id: optional string or null`

    The `id` (`msg_...`) from this client's previous /v1/messages response. The server compares that request's prompt fingerprint against this one and returns `diagnostics.cache_miss_reason` when the prompt-cache prefix could not be reused. Pass `null` on the first turn to opt in without a prior message to compare.

    maxLength: 256

- `inference_geo: optional string or null`

  Specifies the geographic region for inference processing. If not specified, the workspace's `default_inference_geo` is used.

- `metadata: optional Metadata`

  An object describing metadata about the request.

  - `user_id: optional string or null`

    An external identifier for the user who is associated with the request.

    This should be a uuid, hash value, or other opaque identifier. Anthropic may use this id to help detect abuse. Do not include any identifying information such as name, email address, or phone number.

    maxLength: 512

- `output_config: optional OutputConfig`

  Configuration options for the model's output, such as the output format.

  - `effort: optional "low" or "medium" or "high" or 2 more or null`

    How much effort the model should put into its response. Higher effort levels may result in more thorough analysis but take longer.

    Valid values are `low`, `medium`, `high`, `xhigh`, or `max`.

    - `"low"`

    - `"medium"`

    - `"high"`

    - `"xhigh"`

    - `"max"`

  - `format: optional JSONOutputFormat or null`

    A schema to specify Claude's output format in responses. See [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs?sdk_languages=http)

    - `type: "json_schema"`

    - `schema: map[unknown]`

      The JSON schema of the format

- `service_tier: optional "auto" or "standard_only"`

  Determines whether to use priority capacity (if available) or standard capacity for this request.

  Anthropic offers different levels of service for your API requests. See [service-tiers](https://platform.claude.com/docs/en/api/service-tiers?sdk_languages=http) for details.

  - `"auto"`

  - `"standard_only"`

- `speed: optional "standard" or "fast" or null`

  The inference speed mode for this request. `"fast"` enables high output-tokens-per-second inference.

  Some models require the `fast-mode-2026-02-01` beta header for any `speed` value. See [fast mode](https://platform.claude.com/docs/en/build-with-claude/fast-mode?sdk_languages=http) for which models.

  - `"standard"`

  - `"fast"`

- `stop_sequences: optional array of string`

  Custom text sequences that will cause the model to stop generating.

  Our models will normally stop when they have naturally completed their turn, which will result in a response `stop_reason` of `"end_turn"`.

  If you want the model to stop generating when it encounters custom strings of text, you can use the `stop_sequences` parameter. If the model encounters one of the custom sequences, the response `stop_reason` value will be `"stop_sequence"` and the response `stop_sequence` value will contain the matched stop sequence.

- `stream: optional boolean`

  Whether to incrementally stream the response using server-sent events. When `true`, SDKs return a raw event stream.

  In the TypeScript, Python and Ruby SDKs, the recommended way to stream is `messages.stream()`. It sets `stream` for you and accumulates the events into the final message. See [Streaming with SDKs](https://platform.claude.com/docs/en/build-with-claude/streaming?sdk_languages=http#streaming-with-sdks) for an example in each language.

- `system: optional string or array of TextBlockParam`

  System prompt.

  A system prompt is a way of providing context and instructions to Claude, such as specifying a particular goal or role. See our [guide to system prompts](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices?sdk_languages=http#give-claude-a-role).

  - `string`

  - `array of TextBlockParam`

    - `type: "text"`

    - `text: string`

      minLength: 1

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `citations: optional array of TextCitationParam or null`

- `thinking: optional ThinkingConfigParam`

  Configuration for Claude's thinking.

  With `{"type": "adaptive"}`, Claude decides when and how much to think. With `{"type": "enabled"}` (manual extended thinking), you set a `budget_tokens` of at least 1,024. Thinking tokens count toward your `max_tokens` limit.

  Which `type` values are accepted, and what happens when you omit `thinking`, depend on the model. See [thinking](https://platform.claude.com/docs/en/build-with-claude/thinking?sdk_languages=http#configuring-thinking) for each model's behavior.

  - `ThinkingConfigEnabled object`

    - `type: "enabled"`

    - `budget_tokens: number`

      Determines how many tokens Claude can use for its internal reasoning process. Larger budgets can enable more thorough analysis for complex problems, improving response quality.

      Must be ≥1024 and less than `max_tokens`.

      See [extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking?sdk_languages=http) for details.

      minimum: 1024

    - `display: optional "summarized" or "omitted" or null`

      Controls how thinking content appears in the response. When set to `summarized`, thinking is returned normally. When set to `omitted`, thinking content is redacted but a signature is returned for multi-turn continuity. The default depends on the model; see [Controlling thinking display](https://platform.claude.com/docs/en/build-with-claude/thinking?sdk_languages=http#controlling-thinking-display).

      - `"summarized"`

      - `"omitted"`

  - `ThinkingConfigDisabled object`

    - `type: "disabled"`

  - `ThinkingConfigBetweenTools object`

    - `type: "between_tools"`

  - `ThinkingConfigAdaptive object`

    - `type: "adaptive"`

    - `display: optional "summarized" or "omitted" or null`

      Controls how thinking content appears in the response. When set to `summarized`, thinking is returned normally. When set to `omitted`, thinking content is redacted but a signature is returned for multi-turn continuity. The default depends on the model; see [Controlling thinking display](https://platform.claude.com/docs/en/build-with-claude/thinking?sdk_languages=http#controlling-thinking-display).

      - `"summarized"`

      - `"omitted"`

- `tool_choice: optional ToolChoice`

  How the model should use the provided tools. The model can use a specific tool, any available tool, decide by itself, or not use tools at all.

  - `ToolChoiceAuto object`

    The model will automatically decide whether to use tools.

    - `type: "auto"`

    - `disable_parallel_tool_use: optional boolean`

      Whether to disable parallel tool use.

      Defaults to `false`. If set to `true`, the model will output at most one tool use.

  - `ToolChoiceAny object`

    The model will use any available tools.

    - `type: "any"`

    - `disable_parallel_tool_use: optional boolean`

      Whether to disable parallel tool use.

      Defaults to `false`. If set to `true`, the model will output exactly one tool use.

  - `ToolChoiceTool object`

    The model will use the specified tool with `tool_choice.name`.

    - `type: "tool"`

    - `name: string`

      The name of the tool to use.

    - `disable_parallel_tool_use: optional boolean`

      Whether to disable parallel tool use.

      Defaults to `false`. If set to `true`, the model will output exactly one tool use.

  - `ToolChoiceNone object`

    The model will not be allowed to use tools.

    - `type: "none"`

- `tools: optional array of ToolUnion`

  Definitions of tools that the model may use.

  If you include `tools` in your API request, the model may return `tool_use` content blocks that represent the model's use of those tools. You can then run those tools using the tool input generated by the model and then optionally return results back to the model using `tool_result` content blocks.

  There are two types of tools: **client tools** and **server tools**. The behavior described below applies to client tools. For [server tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools?sdk_languages=http), see their individual documentation as each has its own behavior (e.g., the [web search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool?sdk_languages=http)).

  Each tool definition includes:

  * `name`: Name of the tool.
  * `description`: Optional, but strongly-recommended description of the tool.
  * `input_schema`: [JSON schema](https://json-schema.org/draft/2020-12) for the tool `input` shape that the model will produce in `tool_use` output content blocks.

  For example, if you defined `tools` as:

  ```json
  [
    {
      "name": "get_stock_price",
      "description": "Get the current stock price for a given ticker symbol.",
      "input_schema": {
        "type": "object",
        "properties": {
          "ticker": {
            "type": "string",
            "description": "The stock ticker symbol, e.g. AAPL for Apple Inc."
          }
        },
        "required": ["ticker"]
      }
    }
  ]
  ```

  And then asked the model "What's the S&P 500 at today?", the model might produce `tool_use` content blocks in the response like this:

  ```json
  [
    {
      "type": "tool_use",
      "id": "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
      "name": "get_stock_price",
      "input": { "ticker": "^GSPC" }
    }
  ]
  ```

  You might then run your `get_stock_price` tool with `{"ticker": "^GSPC"}` as an input, and return the following back to the model in a subsequent `user` message:

  ```json
  [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01D7FLrfh4GYq7yT1ULFeyMV",
      "content": "259.75 USD"
    }
  ]
  ```

  Tools can be used for workflows that include running client-side tools and functions, or more generally whenever you want the model to produce a particular JSON structure of output.

  See our [guide](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview?sdk_languages=http) for more details.

  - `Tool object`

    - `type: optional "custom" or null`

    - `input_schema: object`

      [JSON schema](https://json-schema.org/draft/2020-12) for this tool's input.

      This defines the shape of the `input` that your tool accepts and that the model will produce.

      - `type: "object"`

      - `properties: optional map[unknown] or null`

      - `required: optional array of string or null`

    - `name: string`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

      minLength: 1, maxLength: 128, pattern: ^[a-zA-Z0-9_-]{1,128}$

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `description: optional string`

      Description of what this tool does.

      Tool descriptions should be as detailed as possible. The more information that the model has about what the tool is and how to use it, the better it will perform. You can use natural language descriptions to reinforce important aspects of the tool input JSON schema.

    - `eager_input_streaming: optional boolean or null`

      Enable eager input streaming for this tool. When true, tool input parameters will be streamed incrementally as they are generated, and types will be inferred on-the-fly rather than buffering the full JSON output. When false, streaming is disabled for this tool even if the fine-grained-tool-streaming beta is active. When null (default), uses the default behavior based on beta headers.

    - `input_examples: optional array of map[unknown]`

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

  - `ToolBash20250124 object`

    - `type: "bash_20250124"`

    - `name: "bash"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `input_examples: optional array of map[unknown]`

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

  - `CodeExecutionTool20250522 object`

    - `type: "code_execution_20250522"`

    - `name: "code_execution"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

  - `CodeExecutionTool20250825 object`

    - `type: "code_execution_20250825"`

    - `name: "code_execution"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

  - `CodeExecutionTool20260120 object`

    A `tools` entry for the code execution tool, version `code_execution_20260120`. It adds REPL state persistence to version `code_execution_20250825`.

    REPL state persistence applies with programmatic tool calling. With it, the Python interpreter state, such as variable bindings, persists across requests that reuse the container.

    See the [code execution tool guide](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool?sdk_languages=http#tool-versions) to learn what each tool version adds.

    - `type: "code_execution_20260120"`

    - `name: "code_execution"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

  - `CodeExecutionTool20260521 object`

    Code execution tool with REPL state persistence.

    - `type: "code_execution_20260521"`

    - `name: "code_execution"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

  - `BrowserToolset20260801 object`

    The browser toolset: a single `tools[]` entry (carrying no
    `name`) that declares the browser tool family. The model is served
    the family's tool with any members disabled via `configs` removed
    from its schema.

    - `type: "browser_toolset_20260801"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `configs: optional BrowserToolsetConfigs or null`

      Sparse per-member overrides, keyed by member name. Absent, null, and {} are equivalent; a member's defaults apply wherever its key is absent.

      - `type: optional BrowserTypeConfig or null`

        `type`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `close_tab: optional BrowserCloseTabConfig or null`

        `close_tab`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `double_click: optional BrowserDoubleClickConfig or null`

        `double_click`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `file_upload: optional BrowserFileUploadConfig or null`

        `file_upload`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `find: optional BrowserFindConfig or null`

        `find`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `form_input: optional BrowserFormInputConfig or null`

        `form_input`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `get_page_text: optional BrowserGetPageTextConfig or null`

        `get_page_text`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `hold_key: optional BrowserHoldKeyConfig or null`

        `hold_key`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `hover: optional BrowserHoverConfig or null`

        `hover`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `javascript_exec: optional BrowserJavascriptExecConfig or null`

        `javascript_exec`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `key: optional BrowserKeyConfig or null`

        `key`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `left_click: optional BrowserLeftClickConfig or null`

        `left_click`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `left_click_drag: optional BrowserLeftClickDragConfig or null`

        `left_click_drag`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `left_mouse_down: optional BrowserLeftMouseDownConfig or null`

        `left_mouse_down`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `left_mouse_up: optional BrowserLeftMouseUpConfig or null`

        `left_mouse_up`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `list_tabs: optional BrowserListTabsConfig or null`

        `list_tabs`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `middle_click: optional BrowserMiddleClickConfig or null`

        `middle_click`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `mouse_move: optional BrowserMouseMoveConfig or null`

        `mouse_move`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `navigate: optional BrowserNavigateConfig or null`

        `navigate`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `new_tab: optional BrowserNewTabConfig or null`

        `new_tab`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `read_console: optional BrowserReadConsoleConfig or null`

        `read_console`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `read_network: optional BrowserReadNetworkConfig or null`

        `read_network`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `read_page: optional BrowserReadPageConfig or null`

        `read_page`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `right_click: optional BrowserRightClickConfig or null`

        `right_click`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `screenshot: optional BrowserScreenshotConfig or null`

        `screenshot`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `scroll: optional BrowserScrollConfig or null`

        `scroll`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `scroll_to: optional BrowserScrollToConfig or null`

        `scroll_to`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `switch_tab: optional BrowserSwitchTabConfig or null`

        `switch_tab`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `triple_click: optional BrowserTripleClickConfig or null`

        `triple_click`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `wait: optional BrowserWaitConfig or null`

        `wait`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `zoom: optional BrowserZoomConfig or null`

        `zoom`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

  - `MemoryTool20250818 object`

    - `type: "memory_20250818"`

    - `name: "memory"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `input_examples: optional array of map[unknown]`

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

  - `ComputerToolset20260801 object`

    The computer toolset: a single `tools[]` entry (carrying no
    `name`) that declares the computer tool family. The model is
    served the family's tool with any members disabled via `configs`
    removed from its schema. Every member is enabled by default, zoom
    included. The single-tool options `display_number` and
    `enable_zoom` are not fields of a toolset entry — it carries only
    `type`, `configs`, and `cache_control`; zoom is controlled
    via `configs.zoom.enabled`.

    - `type: "computer_toolset_20260801"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `configs: optional ComputerToolsetConfigs or null`

      Sparse per-member overrides, keyed by member name. Absent, null, and {} are equivalent; a member's defaults apply wherever its key is absent.

      - `type: optional ComputerTypeConfig or null`

        `type`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `cursor_position: optional ComputerCursorPositionConfig or null`

        `cursor_position`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `double_click: optional ComputerDoubleClickConfig or null`

        `double_click`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `hold_key: optional ComputerHoldKeyConfig or null`

        `hold_key`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `key: optional ComputerKeyConfig or null`

        `key`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `left_click: optional ComputerLeftClickConfig or null`

        `left_click`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `left_click_drag: optional ComputerLeftClickDragConfig or null`

        `left_click_drag`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `left_mouse_down: optional ComputerLeftMouseDownConfig or null`

        `left_mouse_down`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `left_mouse_up: optional ComputerLeftMouseUpConfig or null`

        `left_mouse_up`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `middle_click: optional ComputerMiddleClickConfig or null`

        `middle_click`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `mouse_move: optional ComputerMouseMoveConfig or null`

        `mouse_move`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `right_click: optional ComputerRightClickConfig or null`

        `right_click`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `screenshot: optional ComputerScreenshotConfig or null`

        `screenshot`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `scroll: optional ComputerScrollConfig or null`

        `scroll`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `triple_click: optional ComputerTripleClickConfig or null`

        `triple_click`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `wait: optional ComputerWaitConfig or null`

        `wait`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

      - `zoom: optional ComputerZoomConfig or null`

        `zoom`'s config overrides.

        - `defer_loading: optional boolean or null`

          Defer loading for this member. Must resolve to the same value on every enabled member of the toolset.

        - `enabled: optional boolean or null`

          Whether this member is offered to the model. Default is per member, per the toolset's documentation. A member whose enabled resolves false is withheld from the served schema.

  - `ToolTextEditor20250124 object`

    - `type: "text_editor_20250124"`

    - `name: "str_replace_editor"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `input_examples: optional array of map[unknown]`

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

  - `ToolTextEditor20250429 object`

    - `type: "text_editor_20250429"`

    - `name: "str_replace_based_edit_tool"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `input_examples: optional array of map[unknown]`

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

  - `ToolTextEditor20250728 object`

    - `type: "text_editor_20250728"`

    - `name: "str_replace_based_edit_tool"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `input_examples: optional array of map[unknown]`

    - `max_characters: optional number or null`

      Maximum number of characters to display when viewing a file. If not specified, defaults to displaying the full file.

      minimum: 1

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

  - `WebSearchTool20250305 object`

    - `type: "web_search_20250305"`

    - `name: "web_search"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `allowed_domains: optional array of string or null`

      If provided, only these domains will be included in results. Cannot be used alongside `blocked_domains`.

    - `blocked_domains: optional array of string or null`

      If provided, these domains will never appear in results. Cannot be used alongside `allowed_domains`.

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `max_uses: optional number or null`

      Maximum number of times the tool can be used in the API request.

      minimum: 1

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

    - `user_location: optional UserLocation or null`

      Parameters for the user's location. Used to provide more relevant search results.

      - `type: "approximate"`

      - `city: optional string or null`

        The city of the user.

        minLength: 1, maxLength: 255

      - `country: optional string or null`

        The two letter [ISO country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) of the user.

        minLength: 2, maxLength: 2

      - `region: optional string or null`

        The region of the user.

        minLength: 1, maxLength: 255

      - `timezone: optional string or null`

        The [IANA timezone](https://nodatime.org/TimeZones) of the user.

        minLength: 1, maxLength: 255

  - `WebFetchTool20250910 object`

    - `type: "web_fetch_20250910"`

    - `name: "web_fetch"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `allowed_domains: optional array of string or null`

      List of domains to allow fetching from

    - `blocked_domains: optional array of string or null`

      List of domains to block fetching from

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `citations: optional CitationsConfigParam or null`

      Citations configuration for fetched documents. Citations are disabled by default.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `max_content_tokens: optional number or null`

      Maximum number of tokens used by including web page text content in the context. The limit is approximate and does not apply to binary content such as PDFs.

      minimum: 1

    - `max_uses: optional number or null`

      Maximum number of times the tool can be used in the API request.

      minimum: 1

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

    - `url_sources: optional WebFetchURLSources or null`

      Which sources contribute to the set of URLs the tool may fetch. Omitted means every source.

      - `client_tool_results: optional WebFetchURLSourceAll or WebFetchURLSourceNone or WebFetchURLSourceOnly or WebFetchURLSourceExcept`

        Which client tools' results contribute fetchable URLs: "all", "none", or an only or except list of client tool names from tools[].

        - `WebFetchURLSourceAll object`

          The `url_sources` variant under which a source contributes in
          full: every result of the tool filter's source, or all user input.

          - `type: "all"`

        - `WebFetchURLSourceNone object`

          The `url_sources` variant under which a source contributes nothing:
          no result of the tool filter's source, or no user input.

          - `type: "none"`

        - `WebFetchURLSourceOnly object`

          The tool filter variant under which only the named tools' results
          contribute.

          - `type: "only"`

          - `tools: array of WebFetchURLSourceToolReference`

            - `type: "tool_reference"`

            - `name: string`

        - `WebFetchURLSourceExcept object`

          The tool filter variant under which every result but the named
          tools' contributes.

          - `type: "except"`

          - `tools: array of WebFetchURLSourceToolReference`

            - `type: "tool_reference"`

            - `name: string`

      - `server_tool_results: optional WebFetchURLSourceAll or WebFetchURLSourceNone or WebFetchURLSourceOnly or WebFetchURLSourceExcept`

        Which server tools' results contribute fetchable URLs: "all", "none", or an only or except list of server tool names from tools[]; only web_search and web_fetch results ever contribute.

        - `WebFetchURLSourceAll object`

          The `url_sources` variant under which a source contributes in
          full: every result of the tool filter's source, or all user input.

        - `WebFetchURLSourceNone object`

          The `url_sources` variant under which a source contributes nothing:
          no result of the tool filter's source, or no user input.

        - `WebFetchURLSourceOnly object`

          The tool filter variant under which only the named tools' results
          contribute.

        - `WebFetchURLSourceExcept object`

          The tool filter variant under which every result but the named
          tools' contributes.

      - `user_input: optional WebFetchURLSourceAll or WebFetchURLSourceNone`

        Whether URLs in user messages are fetchable: "all" or "none".

        - `WebFetchURLSourceAll object`

          The `url_sources` variant under which a source contributes in
          full: every result of the tool filter's source, or all user input.

        - `WebFetchURLSourceNone object`

          The `url_sources` variant under which a source contributes nothing:
          no result of the tool filter's source, or no user input.

  - `WebSearchTool20260209 object`

    - `type: "web_search_20260209"`

    - `name: "web_search"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `allowed_domains: optional array of string or null`

      If provided, only these domains will be included in results. Cannot be used alongside `blocked_domains`.

    - `blocked_domains: optional array of string or null`

      If provided, these domains will never appear in results. Cannot be used alongside `allowed_domains`.

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `max_uses: optional number or null`

      Maximum number of times the tool can be used in the API request.

      minimum: 1

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

    - `user_location: optional UserLocation or null`

      Parameters for the user's location. Used to provide more relevant search results.

  - `WebFetchTool20260209 object`

    - `type: "web_fetch_20260209"`

    - `name: "web_fetch"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `allowed_domains: optional array of string or null`

      List of domains to allow fetching from

    - `blocked_domains: optional array of string or null`

      List of domains to block fetching from

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `citations: optional CitationsConfigParam or null`

      Citations configuration for fetched documents. Citations are disabled by default.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `max_content_tokens: optional number or null`

      Maximum number of tokens used by including web page text content in the context. The limit is approximate and does not apply to binary content such as PDFs.

      minimum: 1

    - `max_uses: optional number or null`

      Maximum number of times the tool can be used in the API request.

      minimum: 1

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

    - `url_sources: optional WebFetchURLSources or null`

      Which sources contribute to the set of URLs the tool may fetch. Omitted means every source.

  - `WebFetchTool20260309 object`

    Web fetch tool with use_cache parameter for bypassing cached content.

    - `type: "web_fetch_20260309"`

    - `name: "web_fetch"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `allowed_domains: optional array of string or null`

      List of domains to allow fetching from

    - `blocked_domains: optional array of string or null`

      List of domains to block fetching from

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `citations: optional CitationsConfigParam or null`

      Citations configuration for fetched documents. Citations are disabled by default.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `max_content_tokens: optional number or null`

      Maximum number of tokens used by including web page text content in the context. The limit is approximate and does not apply to binary content such as PDFs.

      minimum: 1

    - `max_uses: optional number or null`

      Maximum number of times the tool can be used in the API request.

      minimum: 1

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

    - `url_sources: optional WebFetchURLSources or null`

      Which sources contribute to the set of URLs the tool may fetch. Omitted means every source.

    - `use_cache: optional boolean`

      Whether to use cached content. Set to false to bypass the cache and fetch fresh content. Only set to false when the user explicitly requests fresh content or when fetching rapidly-changing sources.

  - `WebSearchTool20260318 object`

    - `type: "web_search_20260318"`

    - `name: "web_search"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `allowed_domains: optional array of string or null`

      If provided, only these domains will be included in results. Cannot be used alongside `blocked_domains`.

    - `blocked_domains: optional array of string or null`

      If provided, these domains will never appear in results. Cannot be used alongside `allowed_domains`.

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `max_uses: optional number or null`

      Maximum number of times the tool can be used in the API request.

      minimum: 1

    - `response_inclusion: optional "full" or "excluded"`

      How this tool's result blocks appear in the API response when the result was consumed by a completed code_execution call in the same turn. 'full' returns the complete content (default). 'excluded' drops the nested server_tool_use and result block pair entirely. Results from direct calls, or from code_execution calls that paused before completing, are always returned in full so they can be sent back on the next turn.

      - `"full"`

      - `"excluded"`

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

    - `user_location: optional UserLocation or null`

      Parameters for the user's location. Used to provide more relevant search results.

  - `WebFetchTool20260318 object`

    - `type: "web_fetch_20260318"`

    - `name: "web_fetch"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `allowed_domains: optional array of string or null`

      List of domains to allow fetching from

    - `blocked_domains: optional array of string or null`

      List of domains to block fetching from

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `citations: optional CitationsConfigParam or null`

      Citations configuration for fetched documents. Citations are disabled by default.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `max_content_tokens: optional number or null`

      Maximum number of tokens used by including web page text content in the context. The limit is approximate and does not apply to binary content such as PDFs.

      minimum: 1

    - `max_uses: optional number or null`

      Maximum number of times the tool can be used in the API request.

      minimum: 1

    - `response_inclusion: optional "full" or "excluded"`

      How this tool's result blocks appear in the API response when the result was consumed by a completed code_execution call in the same turn. 'full' returns the complete content (default). 'excluded' drops the nested server_tool_use and result block pair entirely. Results from direct calls, or from code_execution calls that paused before completing, are always returned in full so they can be sent back on the next turn.

      - `"full"`

      - `"excluded"`

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

    - `url_sources: optional WebFetchURLSources or null`

      Which sources contribute to the set of URLs the tool may fetch. Omitted means every source.

    - `use_cache: optional boolean`

      Whether to use cached content. Set to false to bypass the cache and fetch fresh content. Only set to false when the user explicitly requests fresh content or when fetching rapidly-changing sources.

  - `ToolSearchToolBm25_20251119 object`

    - `type: "tool_search_tool_bm25_20251119" or "tool_search_tool_bm25"`

      - `"tool_search_tool_bm25_20251119"`

      - `"tool_search_tool_bm25"`

    - `name: "tool_search_tool_bm25"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

  - `ToolSearchToolRegex20251119 object`

    - `type: "tool_search_tool_regex_20251119" or "tool_search_tool_regex"`

      - `"tool_search_tool_regex_20251119"`

      - `"tool_search_tool_regex"`

    - `name: "tool_search_tool_regex"`

      Name of the tool.

      This is how the tool will be called by the model and in `tool_use` blocks.

    - `allowed_callers: optional array of "direct" or "code_execution_20250825" or "code_execution_20260120" or "code_execution_20260521"`

      - `"direct"`

      - `"code_execution_20250825"`

      - `"code_execution_20260120"`

      - `"code_execution_20260521"`

    - `cache_control: optional CacheControlEphemeral or null`

      Create a cache control breakpoint at this content block.

    - `defer_loading: optional boolean`

      If true, tool will not be included in initial system prompt. Only loaded when returned via tool_reference from tool search.

    - `strict: optional boolean`

      When true, guarantees schema validation on tool names and inputs

## Returns

- `Message object`

  - `type: "message"`

    Object type.

    For Messages, this is always `"message"`.

    default: message

  - `id: string`

    Unique object identifier.

    The format and length of IDs may change over time.

  - `container: Container or null`

    Information about the container used in this request.

    This will be non-null if a container tool (e.g. code execution) was used.

    - `id: string`

      Identifier for the container used in this request

    - `expires_at: string`

      The time at which the container will expire.

      format: date-time

    - `skills: array of ContainerSkill or null`

      Skills loaded in the container

      - `type: "anthropic" or "custom"`

        Type of skill - either 'anthropic' (built-in) or 'custom' (user-defined)

        - `"anthropic"`

        - `"custom"`

      - `skill_id: string`

        Skill ID

        minLength: 1, maxLength: 64

      - `version: string`

        The resolved version: a skill version ID for custom skills.

        minLength: 1, maxLength: 64

  - `content: array of ContentBlock`

    Content generated by the model.

    This is an array of content blocks, each of which has a `type` that determines its shape.

    Example:

    ```json
    [{"type": "text", "text": "Hi, I'm Claude."}]
    ```

    If the request input `messages` ended with an `assistant` turn, then the response `content` will continue directly from that last turn. You can use this to constrain the model's output.

    For example, if the input `messages` were:

    ```json
    [
      {"role": "user", "content": "What's the Greek name for Sun? (A) Sol (B) Helios (C) Sun"},
      {"role": "assistant", "content": "The best answer is ("}
    ]
    ```

    Then the response `content` might be:

    ```json
    [{"type": "text", "text": "B)"}]
    ```

    - `TextBlock object`

      - `type: "text"`

        default: text

      - `citations: array of TextCitation or null`

        Citations supporting the text block.

        The type of citation returned will depend on the type of document being cited. Citing a PDF results in `page_location`, plain text results in `char_location`, and content document results in `content_block_location`.

        - `CitationCharLocation object`

          - `type: "char_location"`

            default: char_location

          - `cited_text: string`

          - `document_index: number`

            minimum: 0

          - `document_title: string or null`

          - `end_char_index: number`

          - `file_id: string or null`

          - `start_char_index: number`

            minimum: 0

        - `CitationPageLocation object`

          - `type: "page_location"`

            default: page_location

          - `cited_text: string`

          - `document_index: number`

            minimum: 0

          - `document_title: string or null`

          - `end_page_number: number`

          - `file_id: string or null`

          - `start_page_number: number`

            minimum: 1

        - `CitationContentBlockLocation object`

          - `type: "content_block_location"`

            default: content_block_location

          - `cited_text: string`

            The full text of the cited block range, concatenated.

            Always equals the contents of `content[start_block_index:end_block_index]` joined together. The text block is the minimal citable unit; this field is never a substring of a single block. Not counted toward output tokens, and not counted toward input tokens when sent back in subsequent turns.

          - `document_index: number`

            minimum: 0

          - `document_title: string or null`

          - `end_block_index: number`

            Exclusive 0-based end index of the cited block range in the source's `content` array.

            Always greater than `start_block_index`; a single-block citation has `end_block_index = start_block_index + 1`.

          - `file_id: string or null`

          - `start_block_index: number`

            0-based index of the first cited block in the source's `content` array.

            minimum: 0

        - `CitationsWebSearchResultLocation object`

          - `type: "web_search_result_location"`

            default: web_search_result_location

          - `cited_text: string`

          - `encrypted_index: string`

          - `title: string or null`

            maxLength: 512

          - `url: string`

        - `CitationsSearchResultLocation object`

          - `type: "search_result_location"`

            default: search_result_location

          - `cited_text: string`

            The full text of the cited block range, concatenated.

            Always equals the contents of `content[start_block_index:end_block_index]` joined together. The text block is the minimal citable unit; this field is never a substring of a single block. Not counted toward output tokens, and not counted toward input tokens when sent back in subsequent turns.

          - `end_block_index: number`

            Exclusive 0-based end index of the cited block range in the source's `content` array.

            Always greater than `start_block_index`; a single-block citation has `end_block_index = start_block_index + 1`.

          - `search_result_index: number`

            0-based index of the cited search result among all `search_result` content blocks in the request, in the order they appear across messages and tool results.

            Counted separately from `document_index`; server-side web search results are not included in this count.

            minimum: 0

          - `source: string`

          - `start_block_index: number`

            0-based index of the first cited block in the source's `content` array.

            minimum: 0

          - `title: string or null`

      - `text: string`

    - `ThinkingBlock object`

      - `type: "thinking"`

        default: thinking

      - `signature: string`

        A value used to verify that this thinking block was generated by Claude when it is passed back to the API.

        This is an opaque field and should not be interpreted or parsed. When passing thinking blocks back to the API (required when using tools with extended thinking), pass them back exactly as received, with this field intact.

        See [extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking?sdk_languages=http) for details.

      - `thinking: string`

        The text of Claude's thinking process for this block.

    - `RedactedThinkingBlock object`

      - `type: "redacted_thinking"`

        default: redacted_thinking

      - `data: string`

        The contents of this redacted thinking block, returned when portions of the model's thinking were safety-redacted. This field is opaque and encrypted, with no readable content.

        Pass `redacted_thinking` blocks back to the API unchanged when continuing a multi-turn conversation.

        See [extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking?sdk_languages=http#redacted-thinking-blocks) for details.

    - `ToolUseBlock object`

      - `type: "tool_use"`

        default: tool_use

      - `id: string`

        pattern: ^[a-zA-Z0-9_-]+$

      - `caller: DirectCaller or ServerToolCaller or ServerToolCaller20260120`

        default: {"type":"direct"}

        - `DirectCaller object`

          Tool invocation directly from the model.

          - `type: "direct"`

        - `ServerToolCaller object`

          Tool invocation generated by a server-side tool.

          - `type: "code_execution_20250825"`

          - `tool_id: string`

            pattern: ^srvtoolu_[a-zA-Z0-9_]+$

        - `ServerToolCaller20260120 object`

          - `type: "code_execution_20260120"`

          - `tool_id: string`

            pattern: ^srvtoolu_[a-zA-Z0-9_]+$

      - `input: map[unknown]`

      - `name: string`

        minLength: 1

      - `toolset_name: optional string or null`

        For a toolset member tool_use, the toolset family.

        minLength: 1, maxLength: 64, pattern: ^[a-zA-Z0-9_-]+$

    - `ServerToolUseBlock object`

      - `type: "server_tool_use"`

        default: server_tool_use

      - `id: string`

        pattern: ^srvtoolu_[a-zA-Z0-9_]+$

      - `caller: DirectCaller or ServerToolCaller or ServerToolCaller20260120`

        default: {"type":"direct"}

        - `DirectCaller object`

          Tool invocation directly from the model.

        - `ServerToolCaller object`

          Tool invocation generated by a server-side tool.

        - `ServerToolCaller20260120 object`

      - `input: map[unknown]`

      - `name: "web_search" or "web_fetch" or "code_execution" or 4 more`

        - `"web_search"`

        - `"web_fetch"`

        - `"code_execution"`

        - `"bash_code_execution"`

        - `"text_editor_code_execution"`

        - `"tool_search_tool_regex"`

        - `"tool_search_tool_bm25"`

    - `WebSearchToolResultBlock object`

      - `type: "web_search_tool_result"`

        default: web_search_tool_result

      - `caller: DirectCaller or ServerToolCaller or ServerToolCaller20260120`

        default: {"type":"direct"}

        - `DirectCaller object`

          Tool invocation directly from the model.

        - `ServerToolCaller object`

          Tool invocation generated by a server-side tool.

        - `ServerToolCaller20260120 object`

      - `content: WebSearchToolResultBlockContent`

        - `WebSearchToolResultError object`

          - `type: "web_search_tool_result_error"`

            default: web_search_tool_result_error

          - `error_code: WebSearchToolResultErrorCode`

            - `"invalid_tool_input"`

            - `"unavailable"`

            - `"max_uses_exceeded"`

            - `"too_many_requests"`

            - `"query_too_long"`

            - `"request_too_large"`

        - `array of WebSearchResultBlock`

          - `type: "web_search_result"`

            default: web_search_result

          - `encrypted_content: string`

          - `page_age: string or null`

          - `title: string`

          - `url: string`

      - `tool_use_id: string`

        pattern: ^srvtoolu_[a-zA-Z0-9_]+$

    - `WebFetchToolResultBlock object`

      - `type: "web_fetch_tool_result"`

        default: web_fetch_tool_result

      - `caller: DirectCaller or ServerToolCaller or ServerToolCaller20260120`

        default: {"type":"direct"}

        - `DirectCaller object`

          Tool invocation directly from the model.

        - `ServerToolCaller object`

          Tool invocation generated by a server-side tool.

        - `ServerToolCaller20260120 object`

      - `content: WebFetchToolResultErrorBlock or WebFetchBlock`

        - `WebFetchToolResultErrorBlock object`

          - `type: "web_fetch_tool_result_error"`

            default: web_fetch_tool_result_error

          - `error_code: WebFetchToolResultErrorCode`

            - `"invalid_tool_input"`

            - `"url_too_long"`

            - `"url_not_allowed"`

            - `"url_not_in_prior_context"`

            - `"url_not_accessible"`

            - `"unsupported_content_type"`

            - `"too_many_requests"`

            - `"max_uses_exceeded"`

            - `"unavailable"`

            - `"content_too_large"`

        - `WebFetchBlock object`

          - `type: "web_fetch_result"`

            default: web_fetch_result

          - `content: DocumentBlock`

            - `type: "document"`

              default: document

            - `citations: CitationsConfig or null`

              Citation configuration for the document

              - `enabled: boolean`

                default: false

            - `source: Base64PDFSource or PlainTextSource`

              - `Base64PDFSource object`

                - `type: "base64"`

                - `data: string`

                  format: byte

                - `media_type: "application/pdf"`

              - `PlainTextSource object`

                - `type: "text"`

                - `data: string`

                - `media_type: "text/plain"`

            - `title: string or null`

              The title of the document

          - `retrieved_at: string or null`

            ISO 8601 timestamp when the content was retrieved

          - `url: string`

            Fetched content URL

      - `tool_use_id: string`

        pattern: ^srvtoolu_[a-zA-Z0-9_]+$

    - `CodeExecutionToolResultBlock object`

      - `type: "code_execution_tool_result"`

        default: code_execution_tool_result

      - `content: CodeExecutionToolResultBlockContent`

        - `CodeExecutionToolResultError object`

          - `type: "code_execution_tool_result_error"`

            default: code_execution_tool_result_error

          - `error_code: CodeExecutionToolResultErrorCode`

            - `"invalid_tool_input"`

            - `"unavailable"`

            - `"too_many_requests"`

            - `"execution_time_exceeded"`

        - `CodeExecutionResultBlock object`

          - `type: "code_execution_result"`

            default: code_execution_result

          - `content: array of CodeExecutionOutputBlock`

            - `type: "code_execution_output"`

              default: code_execution_output

            - `file_id: string`

          - `return_code: number`

          - `stderr: string`

          - `stdout: string`

        - `EncryptedCodeExecutionResultBlock object`

          The output and exit code of Python code that Claude ran with the code execution tool, with standard output in encrypted form.

          The API returns this block in place of `code_execution_result` when the code called the web search tool.

          See the [programmatic tool calling guide](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling?sdk_languages=http) to learn more about programmatic tool calling.

          - `type: "encrypted_code_execution_result"`

            default: encrypted_code_execution_result

          - `content: array of CodeExecutionOutputBlock`

            - `type: "code_execution_output"`

              default: code_execution_output

            - `file_id: string`

          - `encrypted_stdout: string`

          - `return_code: number`

          - `stderr: string`

      - `tool_use_id: string`

        pattern: ^srvtoolu_[a-zA-Z0-9_]+$

    - `BashCodeExecutionToolResultBlock object`

      - `type: "bash_code_execution_tool_result"`

        default: bash_code_execution_tool_result

      - `content: BashCodeExecutionToolResultError or BashCodeExecutionResultBlock`

        - `BashCodeExecutionToolResultError object`

          - `type: "bash_code_execution_tool_result_error"`

            default: bash_code_execution_tool_result_error

          - `error_code: BashCodeExecutionToolResultErrorCode`

            - `"invalid_tool_input"`

            - `"unavailable"`

            - `"too_many_requests"`

            - `"execution_time_exceeded"`

            - `"output_file_too_large"`

        - `BashCodeExecutionResultBlock object`

          - `type: "bash_code_execution_result"`

            default: bash_code_execution_result

          - `content: array of BashCodeExecutionOutputBlock`

            - `type: "bash_code_execution_output"`

              default: bash_code_execution_output

            - `file_id: string`

          - `return_code: number`

          - `stderr: string`

          - `stdout: string`

      - `tool_use_id: string`

        pattern: ^srvtoolu_[a-zA-Z0-9_]+$

    - `TextEditorCodeExecutionToolResultBlock object`

      - `type: "text_editor_code_execution_tool_result"`

        default: text_editor_code_execution_tool_result

      - `content: TextEditorCodeExecutionToolResultError or TextEditorCodeExecutionViewResultBlock or TextEditorCodeExecutionCreateResultBlock or TextEditorCodeExecutionStrReplaceResultBlock`

        - `TextEditorCodeExecutionToolResultError object`

          - `type: "text_editor_code_execution_tool_result_error"`

            default: text_editor_code_execution_tool_result_error

          - `error_code: TextEditorCodeExecutionToolResultErrorCode`

            - `"invalid_tool_input"`

            - `"unavailable"`

            - `"too_many_requests"`

            - `"execution_time_exceeded"`

            - `"file_not_found"`

          - `error_message: string or null`

        - `TextEditorCodeExecutionViewResultBlock object`

          - `type: "text_editor_code_execution_view_result"`

            default: text_editor_code_execution_view_result

          - `content: string`

          - `file_type: "text" or "image" or "pdf"`

            - `"text"`

            - `"image"`

            - `"pdf"`

          - `num_lines: number or null`

          - `start_line: number or null`

          - `total_lines: number or null`

        - `TextEditorCodeExecutionCreateResultBlock object`

          - `type: "text_editor_code_execution_create_result"`

            default: text_editor_code_execution_create_result

          - `is_file_update: boolean`

        - `TextEditorCodeExecutionStrReplaceResultBlock object`

          - `type: "text_editor_code_execution_str_replace_result"`

            default: text_editor_code_execution_str_replace_result

          - `lines: array of string or null`

          - `new_lines: number or null`

          - `new_start: number or null`

          - `old_lines: number or null`

          - `old_start: number or null`

      - `tool_use_id: string`

        pattern: ^srvtoolu_[a-zA-Z0-9_]+$

    - `ToolSearchToolResultBlock object`

      - `type: "tool_search_tool_result"`

        default: tool_search_tool_result

      - `content: ToolSearchToolResultError or ToolSearchToolSearchResultBlock`

        - `ToolSearchToolResultError object`

          - `type: "tool_search_tool_result_error"`

            default: tool_search_tool_result_error

          - `error_code: ToolSearchToolResultErrorCode`

            - `"invalid_tool_input"`

            - `"unavailable"`

            - `"too_many_requests"`

            - `"execution_time_exceeded"`

          - `error_message: string or null`

        - `ToolSearchToolSearchResultBlock object`

          - `type: "tool_search_tool_search_result"`

            default: tool_search_tool_search_result

          - `tool_references: array of ToolReferenceBlock`

            - `type: "tool_reference"`

              default: tool_reference

            - `tool_name: string`

              minLength: 1, maxLength: 256, pattern: ^[a-zA-Z0-9_-]{1,256}$

      - `tool_use_id: string`

        pattern: ^srvtoolu_[a-zA-Z0-9_]+$

    - `ContainerUploadBlock object`

      Response model for a file uploaded to the container.

      - `type: "container_upload"`

        default: container_upload

      - `file_id: string`

  - `diagnostics: Diagnostics or null`

    Request-level diagnostics. `null` when the request did not supply `diagnostics`, or when it did and no prompt-cache divergence was detected.

    - `cache_miss_reason: CacheMissReason or null`

      Explains why the prompt cache could not fully reuse the prefix from the request identified by `diagnostics.previous_message_id`. `null` means diagnosis is still pending — the response was serialized before the background comparison completed.

      - `CacheMissModelChanged object`

        A `cache_miss_reason` for a request whose `model` or `speed` differs from the previous request's.

        See the [cache diagnostics guide](https://platform.claude.com/docs/en/build-with-claude/cache-diagnostics?sdk_languages=http#cache-miss-reason-types) to learn what to change for each reason.

        - `type: "model_changed"`

          default: model_changed

        - `cache_missed_input_tokens: number`

          Approximate number of input tokens that would have been read from cache had the prefix matched the previous request.

      - `CacheMissSystemChanged object`

        A `cache_miss_reason` for a request whose `system` differs from the previous request's.

        See the [cache diagnostics guide](https://platform.claude.com/docs/en/build-with-claude/cache-diagnostics?sdk_languages=http#cache-miss-reason-types) to learn what to change for each reason.

        - `type: "system_changed"`

          default: system_changed

        - `cache_missed_input_tokens: number`

          Approximate number of input tokens that would have been read from cache had the prefix matched the previous request.

      - `CacheMissToolsChanged object`

        A `cache_miss_reason` for a request whose `tools` differ from the previous request's, for example because tools were added, removed, or reordered.

        See the [cache diagnostics guide](https://platform.claude.com/docs/en/build-with-claude/cache-diagnostics?sdk_languages=http#cache-miss-reason-types) to learn what to change for each reason.

        - `type: "tools_changed"`

          default: tools_changed

        - `cache_missed_input_tokens: number`

          Approximate number of input tokens that would have been read from cache had the prefix matched the previous request.

      - `CacheMissMessagesChanged object`

        A `cache_miss_reason` for a request whose `messages` differ from the previous request's in an earlier entry, instead of only having entries appended. The `model`, `system`, and `tools` match.

        See the [cache diagnostics guide](https://platform.claude.com/docs/en/build-with-claude/cache-diagnostics?sdk_languages=http#cache-miss-reason-types) to learn what to change for each reason.

        - `type: "messages_changed"`

          default: messages_changed

        - `cache_missed_input_tokens: number`

          Approximate number of input tokens that would have been read from cache had the prefix matched the previous request.

      - `CacheMissPreviousMessageNotFound object`

        A `cache_miss_reason` for when the API doesn't have a stored record of the request that `diagnostics.previous_message_id` references.

        This doesn't mean that this request changed.

        See the [cache diagnostics guide](https://platform.claude.com/docs/en/build-with-claude/cache-diagnostics?sdk_languages=http#cache-miss-reason-types) to learn what to change for each reason.

        - `type: "previous_message_not_found"`

          default: previous_message_not_found

      - `CacheMissUnavailable object`

        A `cache_miss_reason` for when the API can't give a diagnosis. The request itself was processed normally.

        This includes a request whose `model`, `system`, and `tools` match the previous request's but whose other prompt-affecting parameters, such as `thinking` or `tool_choice`, differ.

        See the [cache diagnostics guide](https://platform.claude.com/docs/en/build-with-claude/cache-diagnostics?sdk_languages=http#cache-miss-reason-types) to learn what to change for each reason.

        - `type: "unavailable"`

          default: unavailable

  - `model: Model`

    The model that will complete your prompt.

    See [models](https://docs.anthropic.com/en/docs/models-overview) for additional details and options.

    - `"claude-haiku-5-5"`

      Fastest model for high-volume, real-time tasks

    - `"claude-sonnet-5-5"`

      Efficient model for coding and agents

    - `"claude-fable-5-1"`

      Frontier intelligence for ambitious tasks across coding, scientific discovery, and enterprise workflows

    - `"claude-opus-5-5"`

      Powerful intelligence for coding, knowledge work, and long-running agents

    - `"claude-mythos-5-1"`

      Our most capable model for cybersecurity and biology research, available through trusted access programs

    - `"claude-sonnet-5"`

      Efficient model for coding and agents

    - `"claude-fable-5"`

      Next generation of intelligence for the hardest knowledge work and coding problems

    - `"claude-mythos-5"`

      Most capable model for cybersecurity and biology research

    - `"claude-opus-5"`

      Powerful intelligence for long-running agents and coding

    - `"claude-opus-4-8"`

      Powerful intelligence for long-running agents and coding

    - `"claude-opus-4-7"`

      Powerful intelligence for long-running agents and coding

    - `"claude-opus-4-6"`

      Powerful intelligence for long-running agents and coding

    - `"claude-sonnet-4-6"`

      Best combination of speed and intelligence

    - `"claude-haiku-4-5"`

    - `"claude-haiku-4-5-20251001"`

    - `"claude-opus-4-5"`

      Powerful intelligence for long-running agents and coding

    - `"claude-opus-4-5-20251101"`

      Powerful intelligence for long-running agents and coding

    - `"claude-mythos-preview"`

      **Deprecated**: Will reach end-of-life on June 30, 2026. Please migrate to claude-mythos-5. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.

      New class of intelligence, strongest in coding and cybersecurity

    - `"claude-sonnet-4-5"`

      **Deprecated**: Will reach end-of-life on November 30, 2026. Please migrate to claude-sonnet-5-5. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.

      High-performance model for agents and coding

    - `"claude-sonnet-4-5-20250929"`

      **Deprecated**: Will reach end-of-life on November 30, 2026. Please migrate to claude-sonnet-5-5. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.

      High-performance model for agents and coding

    - `string`

  - `role: "assistant"`

    Conversational role of the generated message.

    This will always be `"assistant"`.

    default: assistant

  - `stop_details: RefusalStopDetails or null`

    Structured information about why model output stopped.

    This is `null` when the `stop_reason` has no additional detail to report.

    - `type: "refusal"`

      default: refusal

    - `category: "cyber" or "bio" or "frontier_llm" or 2 more or null`

      The policy category that triggered the refusal.

      `null` when the refusal doesn't map to a named category.

      - `"cyber"`

        The request could enable cyber harm, such as malware or exploit development. Benign cybersecurity work can also trigger this category.

      - `"bio"`

        The request could enable biological harm, such as dangerous lab methods. Beneficial life sciences work can also trigger this category.

      - `"frontier_llm"`

        The request could assist the development of competing AI models, which is restricted under [Anthropic's commercial terms](https://www.anthropic.com/legal/commercial-terms). Benign machine learning work can also trigger this category.

      - `"reasoning_extraction"`

        The request asks the model to reproduce its internal reasoning in the response text. To get reasoning in a structured form instead, use [adaptive thinking](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking?sdk_languages=http).

      - `"general_harms"`

        The request could be related to an area that was determined as harmful. Benign work might sometimes trigger this category.

    - `explanation: string or null`

      Human-readable explanation of the refusal.

      This text is not guaranteed to be stable. `null` when no explanation is available for the category.

  - `stop_reason: StopReason or null`

    The reason that we stopped.

    This may be one the following values:

    * `"end_turn"`: the model reached a natural stopping point
    * `"max_tokens"`: we exceeded the requested `max_tokens` or the model's maximum
    * `"stop_sequence"`: one of your provided custom `stop_sequences` was generated
    * `"tool_use"`: the model invoked one or more tools
    * `"pause_turn"`: we paused a long-running turn. You may provide the response back as-is in a subsequent request to let the model continue.
    * `"refusal"`: when streaming classifiers intervene to handle potential policy violations
    * `"model_context_window_exceeded"`: we exceeded the model's context window

    In non-streaming mode this value is always non-null. In streaming mode, it is null in the `message_start` event and non-null otherwise.

    - `"end_turn"`

    - `"max_tokens"`

    - `"stop_sequence"`

    - `"tool_use"`

    - `"pause_turn"`

    - `"refusal"`

    - `"model_context_window_exceeded"`

  - `stop_sequence: string or null`

    Which custom stop sequence was generated, if any.

    This value will be a non-null string if one of your custom stop sequences was generated.

  - `usage: Usage`

    Billing and rate-limit usage.

    Anthropic's API bills and rate-limits by token counts, as tokens represent the underlying cost to our systems.

    Under the hood, the API transforms requests into a format suitable for the model. The model's output then goes through a parsing stage before becoming an API response. As a result, the token counts in `usage` will not match one-to-one with the exact visible content of an API request or response.

    For example, `output_tokens` will be non-zero, even for an empty string response from Claude.

    Total input tokens in a request is the summation of `input_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`.

    - `cache_creation: CacheCreation or null`

      Breakdown of cached tokens by TTL

      - `ephemeral_1h_input_tokens: number`

        The number of input tokens used to create the 1 hour cache entry.

        default: 0, minimum: 0

      - `ephemeral_5m_input_tokens: number`

        The number of input tokens used to create the 5 minute cache entry.

        default: 0, minimum: 0

    - `cache_creation_input_tokens: number or null`

      The number of input tokens used to create the cache entry.

      minimum: 0

    - `cache_read_input_tokens: number or null`

      The number of input tokens read from the cache.

      minimum: 0

    - `inference_geo: string or null`

      The geographic region where inference was performed for this request.

    - `input_tokens: number`

      The number of input tokens which were used.

      minimum: 0

    - `output_tokens: number`

      The number of output tokens which were used.

      minimum: 0

    - `output_tokens_details: OutputTokensDetails or null`

      Breakdown of output tokens by category.

      `output_tokens` remains the inclusive, authoritative total used for billing.
      This object provides a read-only decomposition for observability — for example,
      how many of the billed output tokens were spent on internal reasoning that may
      have been summarized before being returned to you.

      - `thinking_tokens: number`

        Number of output tokens the model generated as internal reasoning, including
        the thinking-block delimiter tokens.

        Reflects the raw reasoning the model produced, not the (possibly shorter)
        summarized thinking text returned in the response body. It may differ from the model's exact
        generation count by a small number of tokens. Always ≤ `output_tokens`;
        `output_tokens - thinking_tokens` approximates the non-reasoning output.

        default: 0, minimum: 0

    - `server_tool_use: ServerToolUsage or null`

      The number of server tool requests.

      - `web_fetch_requests: number`

        The number of web fetch tool requests.

        default: 0, minimum: 0

      - `web_search_requests: number`

        The number of web search tool requests.

        default: 0, minimum: 0

    - `service_tier: "standard" or "priority" or "batch" or null`

      If the request used the priority, standard, or batch tier.

      - `"standard"`

      - `"priority"`

      - `"batch"`

    - `speed: "standard" or "fast" or null`

      The inference speed mode used for this request.

      - `"standard"`

      - `"fast"`

- `RawMessageStreamEvent = RawMessageStartEvent or RawMessageDeltaEvent or RawMessageStopEvent or 3 more`

  - `RawMessageStartEvent object`

    - `type: "message_start"`

      default: message_start

    - `message: Message`

  - `RawMessageDeltaEvent object`

    - `type: "message_delta"`

      default: message_delta

    - `delta: object`

      - `container: Container or null`

        Information about the container used in this request.

        This will be non-null if a container tool (e.g. code execution) was used.

      - `stop_details: RefusalStopDetails or null`

        Structured information about why model output stopped.

        This is `null` when the `stop_reason` has no additional detail to report.

      - `stop_reason: StopReason or null`

      - `stop_sequence: string or null`

    - `usage: MessageDeltaUsage`

      Billing and rate-limit usage.

      Anthropic's API bills and rate-limits by token counts, as tokens represent the underlying cost to our systems.

      Under the hood, the API transforms requests into a format suitable for the model. The model's output then goes through a parsing stage before becoming an API response. As a result, the token counts in `usage` will not match one-to-one with the exact visible content of an API request or response.

      For example, `output_tokens` will be non-zero, even for an empty string response from Claude.

      Total input tokens in a request is the summation of `input_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`.

      - `cache_creation_input_tokens: number or null`

        The cumulative number of input tokens used to create the cache entry.

        minimum: 0

      - `cache_read_input_tokens: number or null`

        The cumulative number of input tokens read from the cache.

        minimum: 0

      - `input_tokens: number or null`

        The cumulative number of input tokens which were used.

        minimum: 0

      - `output_tokens: number`

        The cumulative number of output tokens which were used.

      - `output_tokens_details: OutputTokensDetails or null`

        Breakdown of output tokens by category.

        `output_tokens` remains the inclusive, authoritative total used for billing.
        This object provides a read-only decomposition for observability — for example,
        how many of the billed output tokens were spent on internal reasoning that may
        have been summarized before being returned to you.

      - `server_tool_use: ServerToolUsage or null`

        The number of server tool requests.

  - `RawMessageStopEvent object`

    - `type: "message_stop"`

      default: message_stop

  - `RawContentBlockStartEvent object`

    - `type: "content_block_start"`

      default: content_block_start

    - `content_block: TextBlock or ThinkingBlock or RedactedThinkingBlock or 9 more`

      - `TextBlock object`

      - `ThinkingBlock object`

      - `RedactedThinkingBlock object`

      - `ToolUseBlock object`

      - `ServerToolUseBlock object`

      - `WebSearchToolResultBlock object`

      - `WebFetchToolResultBlock object`

      - `CodeExecutionToolResultBlock object`

      - `BashCodeExecutionToolResultBlock object`

      - `TextEditorCodeExecutionToolResultBlock object`

      - `ToolSearchToolResultBlock object`

      - `ContainerUploadBlock object`

        Response model for a file uploaded to the container.

    - `index: number`

  - `RawContentBlockDeltaEvent object`

    - `type: "content_block_delta"`

      default: content_block_delta

    - `delta: RawContentBlockDelta`

      - `TextDelta object`

        - `type: "text_delta"`

          default: text_delta

        - `text: string`

      - `InputJSONDelta object`

        - `type: "input_json_delta"`

          default: input_json_delta

        - `partial_json: string`

      - `CitationsDelta object`

        - `type: "citations_delta"`

          default: citations_delta

        - `citation: CitationCharLocation or CitationPageLocation or CitationContentBlockLocation or 2 more`

          - `CitationCharLocation object`

          - `CitationPageLocation object`

          - `CitationContentBlockLocation object`

          - `CitationsWebSearchResultLocation object`

          - `CitationsSearchResultLocation object`

      - `ThinkingDelta object`

        - `type: "thinking_delta"`

          default: thinking_delta

        - `thinking: string`

          The incremental `thinking` text for this content block. Concatenate the `thinking` values of successive `thinking_delta` events to assemble the block's full `thinking` value.

      - `SignatureDelta object`

        - `type: "signature_delta"`

          default: signature_delta

        - `signature: string`

          The `signature` for this thinking block: an opaque value used to verify that the block was generated by Claude when it is passed back to the API. Delivered in a `signature_delta` event just before the block's `content_block_stop` event.

    - `index: number`

  - `RawContentBlockStopEvent object`

    - `type: "content_block_stop"`

      default: content_block_stop

    - `index: number`

## Example

```bash
curl https://api.anthropic.com/v1/messages \
    -H 'Content-Type: application/json' \
    -H 'anthropic-version: 2026-10-21' \
    -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
    --max-time 600 \
    -d '{
          "max_tokens": 1024,
          "messages": [
            {
              "content": "Hello, world",
              "role": "user"
            }
          ],
          "model": "claude-opus-5-5",
          "stream": false,
          "system": [
            {
              "text": "Today'\''s date is 2024-06-01.",
              "type": "text"
            }
          ],
          "thinking": {
            "type": "adaptive"
          },
          "tools": [
            {
              "input_schema": {
                "type": "object",
                "properties": {
                  "location": "bar",
                  "unit": "bar"
                },
                "required": [
                  "location"
                ]
              },
              "name": "name"
            }
          ]
        }'
```

### Response (200)

```json
{
  "id": "msg_013Zva2CMHLNnXjNJJKqJ2EF",
  "container": {
    "id": "container_011CpZohnwH4vuy7gazohgSP",
    "expires_at": "2019-12-27T18:11:19.117Z",
    "skills": [
      {
        "skill_id": "pdf",
        "type": "anthropic",
        "version": "latest"
      }
    ]
  },
  "content": [
    {
      "citations": [
        {
          "cited_text": "The grass is green. The sky is blue.",
          "document_index": 0,
          "document_title": "My Document",
          "end_char_index": 0,
          "file_id": "file_011CNha8iCJcU1wXNR6q4V8w",
          "start_char_index": 0,
          "type": "char_location"
        }
      ],
      "text": "Hi! My name is Claude.",
      "type": "text"
    }
  ],
  "diagnostics": {
    "cache_miss_reason": {
      "cache_missed_input_tokens": 0,
      "type": "model_changed"
    }
  },
  "model": "claude-opus-5-5",
  "role": "assistant",
  "stop_details": {
    "category": "cyber",
    "explanation": "This request was declined because it conflicts with Anthropic's Usage Policy.",
    "type": "refusal"
  },
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "type": "message",
  "usage": {
    "cache_creation": {
      "ephemeral_1h_input_tokens": 0,
      "ephemeral_5m_input_tokens": 0
    },
    "cache_creation_input_tokens": 2051,
    "cache_read_input_tokens": 2051,
    "inference_geo": "global",
    "input_tokens": 2095,
    "output_tokens": 503,
    "output_tokens_details": {
      "thinking_tokens": 0
    },
    "server_tool_use": {
      "web_fetch_requests": 2,
      "web_search_requests": 0
    },
    "service_tier": "standard",
    "speed": "standard"
  }
}
```
