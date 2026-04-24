<!--
  Upstream snapshot - DO NOT EDIT - run _upstream/sync.sh to refresh
  Source: https://ai.google.dev/gemini-api/docs/interactions.md.txt
  Synced: 2026-04-24
  Consumed by: gemini.interactions.wiretypes.ts, gemini.interactions.parser.ts, gemini.interactionsCreate.ts, gemini.interactionsPoller.ts
  Companion: ./gemini.interactions.spec.md (the Interactions API reference spec), ./gemini.deep-research.guide.md (the Deep Research agent guide)
-->

> [!IMPORTANT]
> We have updated our [Terms of Service](https://ai.google.dev/gemini-api/terms).

> [!TIP]
> **Using a coding agent?** Connect it to the **Gemini Docs MCP** and install the `gemini-interactions-api` skill to give your assistant direct access to the latest developer docs and best practices. [Set up your coding agent →](https://ai.google.dev/gemini-api/docs/coding-agents)

The Interactions API ([Beta](https://ai.google.dev/gemini-api/docs/api-versions)) is a unified interface
for interacting with Gemini models and agents. As an improved alternative
to the [`generateContent`](https://ai.google.dev/api/generate-content#method:-models.generatecontent)
API, it simplifies state management, tool orchestration,
and long-running tasks. For comprehensive view of the API schema, see the
[API Reference](https://ai.google.dev/api/interactions-api). During the Beta,
features and schemas are subject to [breaking changes](https://ai.google.dev/gemini-api/docs/interactions#breaking-changes).
To get started quickly, try the [Interactions API quickstart notebook](https://colab.sandbox.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_started_interactions_api.ipynb).

<button value="chat" default="">General use</button> <button value="tool-use">Function calling</button> <button value="deep-research">Deep Research agent</button>

The following example shows how to call the Interactions API with a text prompt.

### Python

    from google import genai

    client = genai.Client()

    interaction =  client.interactions.create(
        model="gemini-3-flash-preview",
        input="Tell me a short joke about programming."
    )

    print(interaction.outputs[-1].text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction =  await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Tell me a short joke about programming.',
    });

    console.log(interaction.outputs[interaction.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Tell me a short joke about programming."
    }'

## Basic interactions

The Interactions API is available through our
[existing SDKs](https://ai.google.dev/gemini-api/docs/interactions#sdk). The simplest way to interact with the model is by
providing a text prompt. The `input` can be a string, a list containing a
content objects, or a list of turns with roles and content objects.

### Python

    from google import genai

    client = genai.Client()

    interaction =  client.interactions.create(
        model="gemini-3-flash-preview",
        input="Tell me a short joke about programming."
    )

    print(interaction.outputs[-1].text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction =  await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Tell me a short joke about programming.',
    });

    console.log(interaction.outputs[interaction.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Tell me a short joke about programming."
    }'

> [!NOTE]
> **Note:** Interaction objects are saved by default (`store=true`) to enable state management features and background execution. See [Data Storage and
> Retention](https://ai.google.dev/gemini-api/docs/interactions#data-storage-retention) for details on retention periods and how to delete stored data or opt out.

## Conversation

You can build multi-turn conversations in two ways:

- Statefully by referencing a previous interaction
- Statelessly by providing the entire conversation history

### Stateful conversation

To continue a conversation, pass the `id` from the previous interaction to the
`previous_interaction_id` parameter. The API remembers the conversation history,
so you only need to send the new input. For details on which fields are
inherited and which must be re-specified, see
[Server-side state management](https://ai.google.dev/gemini-api/docs/interactions#server-side-state).

### Python

    from google import genai

    client = genai.Client()

    # 1. First turn
    interaction1 = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Hi, my name is Phil."
    )
    print(f"Model: {interaction1.outputs[-1].text}")

    # 2. Second turn (passing previous_interaction_id)
    interaction2 = client.interactions.create(
        model="gemini-3-flash-preview",
        input="What is my name?",
        previous_interaction_id=interaction1.id
    )
    print(f"Model: {interaction2.outputs[-1].text}")

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    // 1. First turn
    const interaction1 = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Hi, my name is Phil.'
    });
    console.log(`Model: ${interaction1.outputs[interaction1.outputs.length - 1].text}`);

    // 2. Second turn (passing previous_interaction_id)
    const interaction2 = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'What is my name?',
        previous_interaction_id: interaction1.id
    });
    console.log(`Model: ${interaction2.outputs[interaction2.outputs.length - 1].text}`);

### REST

    # 1. First turn
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Hi, my name is Phil."
    }'

    # 2. Second turn (Replace INTERACTION_ID with the ID from the previous interaction)
    # curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    # -H "Content-Type: application/json" \
    # -H "x-goog-api-key: $GEMINI_API_KEY" \
    # -d '{
    #     "model": "gemini-3-flash-preview",
    #     "input": "What is my name?",
    #     "previous_interaction_id": "INTERACTION_ID"
    # }'

#### Retrieve past stateful interactions

Using the interaction `id` to retrieve previous turns of the conversation.

### Python

    previous_interaction = client.interactions.get("<YOUR_INTERACTION_ID>")

    print(previous_interaction)

### JavaScript

    const previous_interaction = await client.interactions.get("<YOUR_INTERACTION_ID>");
    console.log(previous_interaction);

### REST

    curl -X GET "https://generativelanguage.googleapis.com/v1beta/interactions/<YOUR_INTERACTION_ID>" \
    -H "x-goog-api-key: $GEMINI_API_KEY"

#### Include original input

By default, `interactions.get()` returns only the model's outputs. To include the
original normalized input in the response, set `include_input` to `true`.

### Python

    interaction = client.interactions.get(
        "<YOUR_INTERACTION_ID>",
        include_input=True
    )

    print(f"Input: {interaction.input}")
    print(f"Output: {interaction.outputs}")

### JavaScript

    const interaction = await client.interactions.get(
        "<YOUR_INTERACTION_ID>",
        { include_input: true }
    );

    console.log(`Input: ${JSON.stringify(interaction.input)}`);
    console.log(`Output: ${JSON.stringify(interaction.outputs)}`);

### REST

    curl -X GET "https://generativelanguage.googleapis.com/v1beta/interactions/<YOUR_INTERACTION_ID>?include_input=true" \
    -H "x-goog-api-key: $GEMINI_API_KEY"

### Stateless conversation

You can manage conversation history manually on the client side.

### Python

    from google import genai

    client = genai.Client()

    conversation_history = [
        {
            "role": "user",
            "content": "What are the three largest cities in Spain?"
        }
    ]

    interaction1 = client.interactions.create(
        model="gemini-3-flash-preview",
        input=conversation_history
    )

    print(f"Model: {interaction1.outputs[-1].text}")

    conversation_history.append({"role": "model", "content": interaction1.outputs})
    conversation_history.append({
        "role": "user",
        "content": "What is the most famous landmark in the second one?"
    })

    interaction2 = client.interactions.create(
        model="gemini-3-flash-preview",
        input=conversation_history
    )

    print(f"Model: {interaction2.outputs[-1].text}")

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const conversationHistory = [
        {
            role: 'user',
            content: "What are the three largest cities in Spain?"
        }
    ];

    const interaction1 = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: conversationHistory
    });

    console.log(`Model: ${interaction1.outputs[interaction1.outputs.length - 1].text}`);

    conversationHistory.push({ role: 'model', content: interaction1.outputs });
    conversationHistory.push({
        role: 'user',
        content: "What is the most famous landmark in the second one?"
    });

    const interaction2 = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: conversationHistory
    });

    console.log(`Model: ${interaction2.outputs[interaction2.outputs.length - 1].text}`);

### REST

     curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
     -H "Content-Type: application/json" \
     -H "x-goog-api-key: $GEMINI_API_KEY" \
     -d '{
        "model": "gemini-3-flash-preview",
        "input": [
            {
                "role": "user",
                "content": "What are the three largest cities in Spain?"
            },
            {
                "role": "model",
                "content": "The three largest cities in Spain are Madrid, Barcelona, and Valencia."
            },
            {
                "role": "user",
                "content": "What is the most famous landmark in the second one?"
            }
        ]
    }'

## Multimodal capabilities

You can use the Interactions API for multimodal use cases such as image
understanding or video generation.

### Multimodal understanding

You can provide multimodal input as base64-encoded data inline, by using the
Files API for larger files, or by passing a publicly accessible link in the uri
field. The code samples that follow demonstrate the public URL method.

#### Image understanding

### Python

    from google import genai
    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input=[
            {"type": "text", "text": "Describe the image."},
            {
                "type": "image",
                "uri": "YOUR_URL",
                "mime_type": "image/png"
            }
        ]
    )
    print(interaction.outputs[-1].text)

### JavaScript

    import {GoogleGenAI} from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: [
            {type: 'text', text: 'Describe the image.'},
            {
                type: 'image',
                uri: 'YOUR_URL',
                mime_type: 'image/png'
            }
        ]
    });
    console.log(interaction.outputs[interaction.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": [
        {
            "type": "text",
            "text": "Describe the image."
        },
        {
            "type": "image",
            "uri": "YOUR_URL",
            "mime_type": "image/png"
        }
        ]
    }'

#### Audio understanding

### Python

    from google import genai
    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input=[
            {"type": "text", "text": "What does this audio say?"},
            {
                "type": "audio",
                "uri": "YOUR_URL",
                "mime_type": "audio/wav"
            }
        ]
    )
    print(interaction.outputs[-1].text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: [
            { type: 'text', text: 'What does this audio say?' },
            {
                type: 'audio',
                uri: 'YOUR_URL',
                mime_type: 'audio/wav'
            }
        ]
    });

    console.log(interaction.outputs[interaction.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": [
            {"type": "text", "text": "What does this audio say?"},
            {
                "type": "audio",
                "uri": "YOUR_URL",
                "mime_type": "audio/wav"
            }
        ]
    }'

#### Video understanding

### Python

    from google import genai
    client = genai.Client()

    print("Analyzing video...")
    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input=[
            {"type": "text", "text": "What is happening in this video? Provide a timestamped summary."},
            {
                "type": "video",
                "uri": "YOUR_URL",
                "mime_type": "video/mp4"
            }
        ]
    )

    print(interaction.outputs[-1].text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    console.log('Analyzing video...');
    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: [
            { type: 'text', text: 'What is happening in this video? Provide a timestamped summary.' },
            {
                type: 'video',
                uri: 'YOUR_URL',
                mime_type: 'video/mp4'
            }
        ]
    });

    console.log(interaction.outputs[interaction.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": [
            {"type": "text", "text": "What is happening in this video?"},
            {
                "type": "video",
                "uri": "YOUR_URL",
                "mime_type": "video/mp4"
            }
        ]
    }'

#### Document (PDF) understanding

### Python

    from google import genai
    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input=[
            {"type": "text", "text": "What is this document about?"},
            {
                "type": "document",
                "uri": "YOUR_URL",
                "mime_type": "application/pdf"
            }
        ]
    )
    print(interaction.outputs[-1].text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: [
            { type: 'text', text: 'What is this document about?' },
            {
                type: 'document',
                uri: 'YOUR_URL',
                mime_type: 'application/pdf'
            }
        ],
    });
    console.log(interaction.outputs[0].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": [
            {"type": "text", "text": "What is this document about?"},
            {
                "type": "document",
                "uri": "YOUR_URL",
                "mime_type": "application/pdf"
            }
        ]
    }'

### Multimodal generation

You can use Interactions API to generate multimodal outputs.

#### Image generation

> [!TIP]
> Use **Grounding with Google Image Search** to reference and retrieve web images for real-world context during image generation. See [Grounding with Google Image Search](https://ai.google.dev/gemini-api/docs/interactions#image-search-grounding) for implementation details.

### Python

    import base64
    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-pro-image-preview",
        input="Generate an image of a futuristic city.",
        response_modalities=["IMAGE"]
    )

    for output in interaction.outputs:
        if output.type == "image":
            print(f"Generated image with mime_type: {output.mime_type}")
            # Save the image
            with open("generated_city.png", "wb") as f:
                f.write(base64.b64decode(output.data))

### JavaScript

    import { GoogleGenAI } from '@google/genai';
    import * as fs from 'fs';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-pro-image-preview',
        input: 'Generate an image of a futuristic city.',
        response_modalities: ['IMAGE']
    });

    for (const output of interaction.outputs) {
        if (output.type === 'image') {
            console.log(`Generated image with mime_type: ${output.mime_type}`);
            // Save the image
            fs.writeFileSync('generated_city.png', Buffer.from(output.data, 'base64'));
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-pro-image-preview",
        "input": "Generate an image of a futuristic city.",
        "response_modalities": ["IMAGE"]
    }'

##### Configure image output

You can customize generated images using `image_config` within `generation_config`
to control the aspect ratio and resolution.

| Parameter | Options | Description |
|---|---|---|
| `aspect_ratio` | `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9` | Controls the width-to-height ratio of the output image. |
| `image_size` | `1k`, `2k`, `4k` | Sets the output image resolution. |

### Python

    import base64
    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-pro-image-preview",
        input="Generate an image of a futuristic city.",
        generation_config={
            "image_config": {
                "aspect_ratio": "9:16",
                "image_size": "2k"
            }
        }
    )

    for output in interaction.outputs:
        if output.type == "image":
            print(f"Generated image with mime_type: {output.mime_type}")
            # Save the image
            with open("generated_city.png", "wb") as f:
                f.write(base64.b64decode(output.data))

### JavaScript

    import { GoogleGenAI } from '@google/genai';
    import * as fs from 'fs';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-pro-image-preview',
        input: 'Generate an image of a futuristic city.',
        generation_config: {
            image_config: {
                aspect_ratio: '9:16',
                image_size: '2k'
            }
        }
    });

    for (const output of interaction.outputs) {
        if (output.type === 'image') {
            console.log(`Generated image with mime_type: ${output.mime_type}`);
            // Save the image
            fs.writeFileSync('generated_city.png', Buffer.from(output.data, 'base64'));
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-pro-image-preview",
        "input": "Generate an image of a futuristic city.",
        "generation_config": {
            "image_config": {
                "aspect_ratio": "9:16",
                "image_size": "2k"
            }
        }
    }'

#### Speech generation

Generate natural-sounding speech from text using the text-to-speech (TTS) model.
Configure voice, language, and speaker settings with the `speech_config`
parameter.

> [!NOTE]
> You can control the speech style using inline audio tags like `[whispers]` or `[shouting]` within the input text. For more details, see [Transcript and audio tags](https://ai.google.dev/gemini-api/docs/speech-generation#transcript-tags).

### Python

    import base64
    from google import genai
    import wave

    # Set up the wave file to save the output:
    def wave_file(filename, pcm, channels=1, rate=24000, sample_width=2):
        with wave.open(filename, "wb") as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(sample_width)
            wf.setframerate(rate)
            wf.writeframes(pcm)

    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3.1-flash-tts-preview",
        input="Say the following: WOOHOO This is so much fun!. [laughs]",
        response_modalities=["AUDIO"],
        generation_config={
            "speech_config": {
                "language": "en-us",
                "voice": "kore"
            }
        }
    )

    for output in interaction.outputs:
        if output.type == "audio":
            print(f"Generated audio with mime_type: {output.mime_type}")
            # Save the audio as wave file to the current directory.
            wave_file("generated_audio.wav", base64.b64decode(output.data))

### JavaScript

    import { GoogleGenAI } from '@google/genai';
    import * as fs from 'fs';
    import wav from 'wav';

    async function saveWaveFile(
        filename,
        pcmData,
        channels = 1,
        rate = 24000,
        sampleWidth = 2,
    ) {
        return new Promise((resolve, reject) => {
            const writer = new wav.FileWriter(filename, {
                    channels,
                    sampleRate: rate,
                    bitDepth: sampleWidth * 8,
            });

            writer.on('finish', resolve);
            writer.on('error', reject);

            writer.write(pcmData);
            writer.end();
        });
    }

    async function main() {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const client = new GoogleGenAI({apiKey: GEMINI_API_KEY});

        const interaction = await client.interactions.create({
            model: 'gemini-3.1-flash-tts-preview',
            input: 'Say the following: WOOHOO This is so much fun!.',
            response_modalities: ['AUDIO'],
            generation_config: {
                speech_config: {
                    language: "en-us",
                    voice: "kore"
                }
            }
        });

        for (const output of interaction.outputs) {
            if (output.type === 'audio') {
                console.log(`Generated audio with mime_type: ${output.mime_type}`);
                const audioBuffer = Buffer.from(output.data, 'base64');
                // Save the audio as wave file to the current directory
                await saveWaveFile("generated_audio.wav", audioBuffer);
            }
        }
    }
    await main();

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3.1-flash-tts-preview",
        "input": "Say the following: WOOHOO This is so much fun!.",
        "response_modalities": ["AUDIO"],
        "generation_config": {
            "speech_config": {
                "language": "en-us",
                "voice": "kore"
            }
        }
    }' | jq -r '.outputs[] | select(.type == "audio") | .data' | base64 -d > generated_audio.pcm
    # You may need to install ffmpeg.
    ffmpeg -f s16le -ar 24000 -ac 1 -i generated_audio.pcm generated_audio.wav

TTS does not support streaming.

##### Multi-speaker speech generation

Generate speech with multiple speakers by specifying speaker names in the prompt
and matching them in the `speech_config`.

The prompt should include the speaker names:

    TTS the following conversation between Alice and Bob:
    Alice: Hi Bob, how are you doing today?
    Bob: I'm doing great, thanks for asking! How about you?
    Alice: Fantastic! I just learned about the Gemini API.

Then configure the `speech_config` with matching speakers:

    "generation_config": {
        "speech_config": [
            {"voice": "Zephyr", "speaker": "Alice", "language": "en-US"},
            {"voice": "Puck", "speaker": "Bob", "language": "en-US"}
        ]
    }

#### Music generation

Generate high-quality music from text prompts using Lyria 3 models. The
Interactions API supports both short clips and full-length songs with vocals,
lyrics, and instrumental arrangements.

For the complete music generation guide including custom lyrics, timing control,
and image-to-music, see
[Generate music with Lyria 3](https://ai.google.dev/gemini-api/docs/music-generation).

### Python

    import base64
    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        model="lyria-3-clip-preview",
        input="Create a 30-second cheerful acoustic folk song with "
              "guitar and harmonica.",
    )

    for output in interaction.outputs:
        if output.type == "audio":
            print(f"Generated audio with mime_type: {output.mime_type}")
            with open("music.mp3", "wb") as f:
                f.write(base64.b64decode(output.data))
        elif output.type == "text":
            print(f"Lyrics: {output.text}")

### JavaScript

    import { GoogleGenAI } from '@google/genai';
    import * as fs from 'fs';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'lyria-3-clip-preview',
        input: 'Create a 30-second cheerful acoustic folk song with ' +
               'guitar and harmonica.',
    });

    for (const output of interaction.outputs) {
        if (output.type === 'audio') {
            console.log(`Generated audio with mime_type: ${output.mime_type}`);
            fs.writeFileSync('music.mp3', Buffer.from(output.data, 'base64'));
        } else if (output.type === 'text') {
            console.log(`Lyrics: ${output.text}`);
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "lyria-3-clip-preview",
        "input": "Create a 30-second cheerful acoustic folk song with guitar and harmonica."
    }'

For full-length songs (up to \~4 minutes), use the `lyria-3-pro-preview` model:

### Python

    interaction = client.interactions.create(
        model="lyria-3-pro-preview",
        input="An epic cinematic orchestral piece about a journey home. "
              "Starts with a solo piano intro, builds through sweeping "
              "strings, and climaxes with a massive wall of sound.",
    )

### JavaScript

    const interaction = await client.interactions.create({
        model: 'lyria-3-pro-preview',
        input: 'An epic cinematic orchestral piece about a journey home. ' +
               'Starts with a solo piano intro, builds through sweeping ' +
               'strings, and climaxes with a massive wall of sound.',
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "lyria-3-pro-preview",
        "input": "An epic cinematic orchestral piece about a journey home. Starts with a solo piano intro, builds through sweeping strings, and climaxes with a massive wall of sound."
    }'

## Agentic capabilities

The Interactions API is designed for building and interacting with agents, and
includes support for function calling, built-in tools, structured outputs, and
the Model Context Protocol (MCP).

### Agents

You can use specialized agents like `deep-research-preview-04-2026` for
complex tasks. To learn more about the Gemini Deep Research Agent, see the
[Deep Research](https://ai.google.dev/gemini-api/docs/deep-research) guide.

> [!NOTE]
> **Note:** The `background=true` parameter is required and only supported when using agents.

### Python

    import time
    from google import genai

    client = genai.Client()

    # 1. Start the Deep Research Agent
    initial_interaction = client.interactions.create(
        input="Research the history of the Google TPUs with a focus on 2025 and 2026.",
        agent="deep-research-preview-04-2026",
        background=True
    )

    print(f"Research started. Interaction ID: {initial_interaction.id}")

    # 2. Poll for results
    while True:
        interaction = client.interactions.get(initial_interaction.id)
        print(f"Status: {interaction.status}")

        if interaction.status == "completed":
            print("\nFinal Report:\n", interaction.outputs[-1].text)
            break
        elif interaction.status in ["failed", "cancelled"]:
            print(f"Failed with status: {interaction.status}")
            break

        time.sleep(10)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    // 1. Start the Deep Research Agent
    const initialInteraction = await client.interactions.create({
        input: 'Research the history of the Google TPUs with a focus on 2025 and 2026.',
        agent: 'deep-research-preview-04-2026',
        background: true
    });

    console.log(`Research started. Interaction ID: ${initialInteraction.id}`);

    // 2. Poll for results
    while (true) {
        const interaction = await client.interactions.get(initialInteraction.id);
        console.log(`Status: ${interaction.status}`);

        if (interaction.status === 'completed') {
            console.log('\nFinal Report:\n', interaction.outputs[interaction.outputs.length - 1].text);
            break;
        } else if (['failed', 'cancelled'].includes(interaction.status)) {
            console.log(`Failed with status: ${interaction.status}`);
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 10000));
    }

### REST

    # 1. Start the Deep Research Agent
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "input": "Research the history of the Google TPUs with a focus on 2025 and 2026.",
        "agent": "deep-research-preview-04-2026",
        "background": true
    }'

    # 2. Poll for results (Replace INTERACTION_ID with the ID from the previous interaction)
    # curl -X GET "https://generativelanguage.googleapis.com/v1beta/interactions/INTERACTION_ID" \
    # -H "x-goog-api-key: $GEMINI_API_KEY"

### Tools and function calling

This section explains how to use function calling to define custom tools and how
to use Google's built-in tools within the Interactions API.

#### Function calling

> [!NOTE]
> Format the `result` field in a `function_result` as an object (like `{"items": [...]}`), a string (like stringified JSON), or a **list** of content objects (like text or image objects). Do not pass a raw list of arbitrary objects directly to `result`. If your tool returns a generic list, wrap it in a dictionary before passing it to the model.

### Python

    from google import genai

    client = genai.Client()

    # 1. Define the tool
    def get_weather(location: str):
        """Gets the weather for a given location."""
        return f"The weather in {location} is sunny."

    weather_tool = {
        "type": "function",
        "name": "get_weather",
        "description": "Gets the weather for a given location.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "The city and state, e.g. San Francisco, CA"}
            },
            "required": ["location"]
        }
    }

    # 2. Send the request with tools
    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="What is the weather in Paris?",
        tools=[weather_tool]
    )

    # 3. Handle the tool call
    for output in interaction.outputs:
        if output.type == "function_call":
            print(f"Tool Call: {output.name}({output.arguments})")
            # Execute tool
            result = get_weather(**output.arguments)

            # Send result back
            interaction = client.interactions.create(
                model="gemini-3-flash-preview",
                previous_interaction_id=interaction.id,
                input=[{
                    "type": "function_result",
                    "name": output.name,
                    "call_id": output.id,
                    "result": result
                }]
            )
            print(f"Response: {interaction.outputs[-1].text}")

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    // 1. Define the tool
    const weatherTool = {
        type: 'function',
        name: 'get_weather',
        description: 'Gets the weather for a given location.',
        parameters: {
            type: 'object',
            properties: {
                location: { type: 'string', description: 'The city and state, e.g. San Francisco, CA' }
            },
            required: ['location']
        }
    };

    // 2. Send the request with tools
    let interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'What is the weather in Paris?',
        tools: [weatherTool]
    });

    // 3. Handle the tool call
    for (const output of interaction.outputs) {
        if (output.type === 'function_call') {
            console.log(`Tool Call: ${output.name}(${JSON.stringify(output.arguments)})`);

            // Execute tool (Mocked)
            const result = `The weather in ${output.arguments.location} is sunny.`;

            // Send result back
            interaction = await client.interactions.create({
                model: 'gemini-3-flash-preview',
                previous_interaction_id:interaction.id,
                input: [{
                    type: 'function_result',
                    name: output.name,
                    call_id: output.id,
                    result: result
                }]
            });
            console.log(`Response: ${interaction.outputs[interaction.outputs.length - 1].text}`);
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "What is the weather in Paris?",
        "tools": [{
            "type": "function",
            "name": "get_weather",
            "description": "Gets the weather for a given location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "The city and state, e.g. San Francisco, CA"}
                },
                "required": ["location"]
            }
        }]
    }'

    # Handle the tool call and send result back (Replace INTERACTION_ID and CALL_ID)
    # curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    # -H "Content-Type: application/json" \
    # -H "x-goog-api-key: $GEMINI_API_KEY" \
    # -d '{
    #     "model": "gemini-3-flash-preview",
    #     "previous_interaction_id": "INTERACTION_ID",
    #     "input": [{
    #         "type": "function_result",
    #         "name": "get_weather",
    #         "call_id": "FUNCTION_CALL_ID",
    #         "result": "The weather in Paris is sunny."
    #     }]
    # }'

##### Function calling with client-side state

If you don't want to use server-side state, you can manage it all
on the client side.

### Python

    from google import genai
    client = genai.Client()

    functions = [
        {
            "type": "function",
            "name": "schedule_meeting",
            "description": "Schedules a meeting with specified attendees at a given time and date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "attendees": {"type": "array", "items": {"type": "string"}},
                    "date": {"type": "string", "description": "Date of the meeting (e.g., 2024-07-29)"},
                    "time": {"type": "string", "description": "Time of the meeting (e.g., 15:00)"},
                    "topic": {"type": "string", "description": "The subject of the meeting."},
                },
                "required": ["attendees", "date", "time", "topic"],
            },
        }
    ]

    history = [{"role": "user","content": [{"type": "text", "text": "Schedule a meeting for 2025-11-01 at 10 am with Peter and Amir about the Next Gen API."}]}]

    # 1. Model decides to call the function
    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input=history,
        tools=functions
    )

    # add model interaction back to history
    history.append({"role": "model", "content": interaction.outputs})

    for output in interaction.outputs:
        if output.type == "function_call":
            print(f"Function call: {output.name} with arguments {output.arguments}")

            # 2. Execute the function and get a result
            # In a real app, you would call your function here.
            # call_result = schedule_meeting(**json.loads(output.arguments))
            call_result = "Meeting scheduled successfully."

            # 3. Send the result back to the model
            history.append({"role": "user", "content": [{"type": "function_result", "name": output.name, "call_id": output.id, "result": call_result}]})

            interaction2 = client.interactions.create(
                model="gemini-3-flash-preview",
                input=history,
            )
            print(f"Final response: {interaction2.outputs[-1].text}")
        else:
            print(f"Output: {output}")

### JavaScript

    // 1. Define the tool
    const functions = [
        {
            type: 'function',
            name: 'schedule_meeting',
            description: 'Schedules a meeting with specified attendees at a given time and date.',
            parameters: {
                type: 'object',
                properties: {
                    attendees: { type: 'array', items: { type: 'string' } },
                    date: { type: 'string', description: 'Date of the meeting (e.g., 2024-07-29)' },
                    time: { type: 'string', description: 'Time of the meeting (e.g., 15:00)' },
                    topic: { type: 'string', description: 'The subject of the meeting.' },
                },
                required: ['attendees', 'date', 'time', 'topic'],
            },
        },
    ];

    const history = [
        { role: 'user', content: [{ type: 'text', text: 'Schedule a meeting for 2025-11-01 at 10 am with Peter and Amir about the Next Gen API.' }] }
    ];

    // 2. Model decides to call the function
    let interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: history,
        tools: functions
    });

    // add model interaction back to history
    history.push({ role: 'model', content: interaction.outputs });

    for (const output of interaction.outputs) {
        if (output.type === 'function_call') {
            console.log(`Function call: ${output.name} with arguments ${JSON.stringify(output.arguments)}`);

            // 3. Send the result back to the model
            history.push({ role: 'user', content: [{ type: 'function_result', name: output.name, call_id: output.id, result: 'Meeting scheduled successfully.' }] });

            const interaction2 = await client.interactions.create({
                model: 'gemini-3-flash-preview',
                input: history,
            });
            console.log(`Final response: ${interaction2.outputs[interaction2.outputs.length - 1].text}`);
        }
    }

##### Multimodal function results

The `result` field in a `function_result` accepts either a plain string or an
array of `TextContent` and `ImageContent` objects. This lets you return
images, such as screenshots or charts, alongside text from your function calls,
so the model can reason over the visual output.

### Python

    import base64
    from google import genai

    client = genai.Client()

    functions = [
        {
            "type": "function",
            "name": "take_screenshot",
            "description": "Takes a screenshot of a specified website.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The URL to take a screenshot of."},
                },
                "required": ["url"],
            },
        }
    ]

    # 1. Model decides to call the function
    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Can you take a screenshot of https://google.com and tell me what you see?",
        tools=functions
    )

    for output in interaction.outputs:
        if output.type == "function_call":
            print(f"Function call: {output.name}({output.arguments})")

            # 2. Execute the function and load the image
            # Replace with actual function call, pseudo code for reading image from disk
            with open("screenshot.png", "rb") as f:
                base64_image = base64.b64encode(f.read()).decode("utf-8")

            # 3. Return a multimodal result (text + image)
            call_result = [
                {"type": "text", "text": "Screenshot captured successfully."},
                {"type": "image", "mime_type": "image/png", "data": base64_image}
            ]

            response = client.interactions.create(
                model="gemini-3-flash-preview",
                tools=functions,
                previous_interaction_id=interaction.id,
                input=[{
                    "type": "function_result",
                    "name": output.name,
                    "call_id": output.id,
                    "result": call_result
                }]
            )
            print(f"Response: {response.outputs[-1].text}")

### JavaScript

    import { GoogleGenAI } from '@google/genai';
    import * as fs from 'fs';

    const client = new GoogleGenAI({});

    const functions = [
        {
            type: 'function',
            name: 'take_screenshot',
            description: 'Takes a screenshot of a specified website.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'The URL to take a screenshot of.' },
                },
                required: ['url'],
            },
        }
    ];

    // 1. Model decides to call the function
    let interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Can you take a screenshot of https://google.com and tell me what you see?',
        tools: functions
    });

    for (const output of interaction.outputs) {
        if (output.type === 'function_call') {
            console.log(`Function call: ${output.name}(${JSON.stringify(output.arguments)})`);

            // 2. Execute the function and load the image
            // Replace with actual function call, pseudo code for reading image from disk
            const base64Image = fs.readFileSync('screenshot.png').toString('base64');

            // 3. Return a multimodal result (text + image)
            const callResult = [
                { type: 'text', text: 'Screenshot captured successfully.' },
                { type: 'image', mime_type: 'image/png', data: base64Image }
            ];

            const response = await client.interactions.create({
                model: 'gemini-3-flash-preview',
                tools: functions,
                previous_interaction_id: interaction.id,
                input: [{
                    type: 'function_result',
                    name: output.name,
                    call_id: output.id,
                    result: callResult
                }]
            });
            console.log(`Response: ${response.outputs[response.outputs.length - 1].text}`);
        }
    }

### REST

    # 1. Send request with tools (will return a function_call)
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Can you take a screenshot of https://google.com and tell me what you see?",
        "tools": [{
            "type": "function",
            "name": "take_screenshot",
            "description": "Takes a screenshot of a specified website.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The URL to take a screenshot of."}
                },
                "required": ["url"]
            }
        }]
    }'

    # 2. Send multimodal result back (Replace INTERACTION_ID, CALL_ID, and BASE64_IMAGE)
    # curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    # -H "Content-Type: application/json" \
    # -H "x-goog-api-key: $GEMINI_API_KEY" \
    # -d '{
    #     "model": "gemini-3-flash-preview",
    #     "tools": [{"type": "function", "name": "take_screenshot", "description": "Takes a screenshot of a specified website.", "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}}],
    #     "previous_interaction_id": "INTERACTION_ID",
    #     "input": [{
    #         "type": "function_result",
    #         "name": "take_screenshot",
    #         "call_id": "CALL_ID",
    #         "result": [
    #             {"type": "text", "text": "Screenshot captured successfully."},
    #             {"type": "image", "mime_type": "image/png", "data": "BASE64_IMAGE"}
    #         ]
    #     }]
    # }'

#### Built-in tools

Gemini comes with built-in tools like
[Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search),
[Grounding with Google Image Search](https://ai.google.dev/gemini-api/docs/interactions#image-search-grounding),
[Grounding with Google Maps](https://ai.google.dev/gemini-api/docs/interactions#grounding-with-google-maps),
[Code execution](https://ai.google.dev/gemini-api/docs/code-execution),
[URL context](https://ai.google.dev/gemini-api/docs/url-context), and
[Computer Use](https://ai.google.dev/gemini-api/docs/computer-use)

##### Grounding with Google Search

### Python

    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Who won the last Super Bowl?",
        tools=[{"type": "google_search"}]
    )
    # Find the text output (not the GoogleSearchResultContent)
    text_output = next((o for o in interaction.outputs if o.type == "text"), None)
    if text_output:
        print(text_output.text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Who won the last Super Bowl?',
        tools: [{ type: 'google_search' }]
    });
    // Find the text output (not the GoogleSearchResultContent)
    const textOutput = interaction.outputs.find(o => o.type === 'text');
    if (textOutput) console.log(textOutput.text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Who won the last Super Bowl?",
        "tools": [{"type": "google_search"}]
    }'

##### Grounding with Google Image Search (only for 3.1 Flash Image)

> [!NOTE]
> This feature is only available for the Gemini 3.1 Flash Image model (`gemini-3.1-flash-image-preview`).

Grounding with Google Image Search allows models to use web images retrieved via Google Image Search as visual context for image generation. Image Search is a new search type within the existing Grounding with Google Search tool, functioning alongside standard [Web Search](https://ai.google.dev/gemini-api/docs/interactions#grounding-with-google-search).

###### Enabling Image Search

Request image results by adding `"image_search"` to the `search_types` array for the `google_search` tool.

### Python

    interaction = client.interactions.create(
        model="gemini-3.1-flash-image-preview",
        input="Search for an image of a vintage gold bitcoin coin.",
        tools=[{
            "type": "google_search",
            "search_types": ["web_search", "image_search"]
        }]
    )

### JavaScript

    const interaction = await client.interactions.create({
        model: 'gemini-3.1-flash-image-preview',
        input: 'Search for an image of a vintage gold bitcoin coin.',
        tools: [{
            type: 'google_search',
            search_types: ['web_search', 'image_search']
        }]
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3.1-flash-image-preview",
        "input": "Search for an image of a vintage gold bitcoin coin.",
        "tools": [{
            "type": "google_search",
            "search_types": ["web_search", "image_search"]
        }]
    }'

###### Mandatory display requirements

To comply with [Google Search Terms of Service](https://ai.google.dev/gemini-api/terms#grounding-with-google-search), your UI must implement two distinct levels of attribution:

1. **Google Search Attribution**

   You must display the "Check on Google" search suggestions provided in the `google_search_result` block.
   - **Field:** `rendered_content` (HTML/CSS)
   - **Action:** Render this chip as-is near the model's response.
2. **Publisher Attribution**

   You must provide a link to the "containing page" (the landing page) for every image displayed.
   - **Field:** `url` (Found within the `result` array)
   - **Requirement:** You must provide a direct, single-click path from the image to its containing source webpage. Using intermediate image viewers or multi-click paths is not permitted.

###### Handling grounded response

The following snippet demonstrates how to handle the interleaved response blocks for both raw image data and mandatory attribution.

### Python

    for output in interaction.outputs:
        # 1. Handle raw multimodal image data
        if output.type == "image":
            print(f"🖼️ Image received: {output.mime_type}")
            # 'data' contains base64-encoded image content
            display_image(output.data, output.mime_type)
        # 2. Handle mandatory Search and Publisher attribution
        elif output.type == "google_search_result":
            # Display Google Search Attribution
            if output.rendered_content:
                render_html_chips(output.rendered_content)

            # Provide Publisher Attribution

            for source in output.result:
                print(f"Source Page: {source['url']}")

### JavaScript

    for (const output of interaction.outputs) {
      // 1. Handle raw multimodal image data
      if (output.type === 'image') {
        console.log(`🖼️ Image received: ${output.mimeType}`);
        // 'data' contains base64-encoded image content
        displayImage(output.data, output.mimeType);
      }
        // 2. Handle mandatory Search and Publisher attribution
        else if (output.type === 'google_search_result') {
          // Display Google Search Attribution
          if (output.renderedContent) {
            renderHtmlChips(output.renderedContent);
          }

          // Provide Publisher Attribution

        for (const source of output.result) {
          console.log(`Source Page: ${source.url}`);
        }
      }
    }

###### Expected output schema

The **Image Block** (type: `"image"`) contains the raw visual data generated or retrieved by the model.

    {
      "type": "image",
      "mime_type": "image/png",
      "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB..." // Base64 content
    }

The **Result Block** (type: `"google_search_result"`) contains the mandatory attribution metadata linked to the search.

    {
      "type": "google_search_result",
      "call_id": "search_002",
      "rendered_content": "<div class=\"search-suggestions\">...</div>", // Google Search Attribution

      "result": [
        {
          "url": "https://example.com/source-page", // Publisher Attribution
          "title": "Source Page Title"
        }
      ]
    }

##### Grounding with Google Maps

Grounding with Google Maps allows models to use Google Maps data for visual
context, map pins, and location-based discovery.

### Python

    from google import genai
    client = genai.Client()
    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="What's the best coffee shop near me?",
        tools=[{"type": "google_maps"}]
    )

### JavaScript

    import { GoogleGenAI } from '@google/genai';
    const client = new GoogleGenAI({});
    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'What\'s the best coffee shop near me?',
        tools: [{ type: 'google_maps' }]
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "What is the best coffee shop near me?",
        "tools": [{"type": "google_maps"}]
    }'

###### Service usage requirements

When presenting results from Grounding with Google Maps, you must follow the
[Google Maps Terms of Service](https://ai.google.dev/gemini-api/terms#grounding-with-google-maps).
You must inform your users of the following and meet these display requirements:

- **Inform the user**: Immediately follow the generated content with the associated Google Maps sources. The sources must be viewable within one user interaction.
- **Display links**: Generate a link preview for each source (including review snippets if present).
- **Attribute to "Google Maps"** : Follow th [text attribution guidelines](https://ai.google.dev/gemini-api/docs/maps-grounding#maps-attribution-guidelines).
- **Display the source title**.
- **Link to the source** using the provided URL.
- **Attribution Guidelines** : Do not modify the text "Google Maps" (capitalization, wrapping). Prevent browser translation using `translate="no"`.

###### Handling the response

The following snippet demonstrates how to handle the response by extracting the
text and inline citations (including review snippets) to meet display
requirements.

### Python

    for output in interaction.outputs:
        if output.type == "text":
            print(output.text)
            if output.annotations:
                print("\nSources:")
                for annotation in output.annotations:
                    if annotation.get("type") == "place_citation":
                        # Display place citation
                        print(f"- {annotation['name']} (Google Maps): {annotation['url']}")
                        # Display review snippets if available
                        if "review_snippets" in annotation:
                            for snippet in annotation["review_snippets"]:
                                print(f"  - Review: {snippet['title']} ({snippet['url']})")
        elif output.type == "google_maps_result":
            # You can also access the raw place data here if needed for map pins
            pass

### JavaScript

    for (const output of interaction.outputs) {
        if (output.type === 'text') {
            console.log(output.text);
            if (output.annotations) {
                console.log('\nSources:');
                for (const annotation of output.annotations) {
                    if (annotation.type === 'place_citation') {
                        console.log(`- ${annotation.name} (Google Maps): ${annotation.url}`);
                        if (annotation.review_snippets) {
                            for (const snippet of annotation.review_snippets) {
                                console.log(`  - Review: ${snippet.title} (${snippet.url})`);
                            }
                        }
                    }
                }
            }
        }
    }

###### Expected output schema

Expect the following output schema when using Grounding with Google Maps.

The **Result Block** (type: `"google_maps_result"`) contains the structured place data.

    {
      "type": "google_maps_result",
      "call_id": "maps_001",
      "result": {
        "places": [
          {
            "place_id": "ChIJ...",
            "name": "Blue Bottle Coffee", // Google Maps Source
            "url": "https://maps.google.com/?cid=...", // Google Maps Link
            "review_snippets": [
              {
                "title": "Amazing single-origin selections",
                "url": "https://maps.google.com/...",
                "review_id": "def456"
              }
            ]
          }
        ],
        "widget_context_token": "widgetcontent/..."
      },
      "signature": "..."
    }

The **Text Block** (type: `"text"`) contains the generated content with inline
annotations.

    {
      "type": "text",
      "text": "Blue Bottle Coffee (4.5★) on Mint Plaza was rated highly online...",
      "annotations": [
        {
          "type": "place_citation",
          "place_id": "ChIJ...",
          "name": "Blue Bottle Coffee", // Google Maps Source
          "url": "https://maps.google.com/?cid=...", // Google Maps Link
          "review_snippets": [
            {
              "title": "Amazing single-origin selections",
              "url": "https://maps.google.com/...",
              "review_id": "def456"
            }
          ],
          "start_index": 0,
          "end_index": 42
        }
      ]
    }

##### Code execution

### Python

    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Calculate the 50th Fibonacci number.",
        tools=[{"type": "code_execution"}]
    )
    print(interaction.outputs[-1].text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Calculate the 50th Fibonacci number.',
        tools: [{ type: 'code_execution' }]
    });
    console.log(interaction.outputs[interaction.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Calculate the 50th Fibonacci number.",
        "tools": [{"type": "code_execution"}]
    }'

##### URL context

Grounding with URL context allows the model to read public URLs provided in the prompt or tool list.

### Python

    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Summarize the content of https://www.wikipedia.org/",
        tools=[{"type": "url_context"}]
    )

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Summarize the content of https://www.wikipedia.org/',
        tools: [{ type: 'url_context' }]
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Summarize the content of https://www.wikipedia.org/",
        "tools": [{"type": "url_context"}]
    }'

###### Handling the response

The following snippet demonstrates how to handle the response by extracting the text and inline citations (type `url_citation`).

### Python

    for output in interaction.outputs:
        if output.type == "text":
            print(output.text)
            if output.annotations:
                print("\nSources:")
                for annotation in output.annotations:
                    if annotation.get("type") == "url_citation":
                        print(f"- {annotation['title']}: {annotation['url']}")

### JavaScript

    for (const output of interaction.outputs) {
        if (output.type === 'text') {
            console.log(output.text);
            if (output.annotations) {
                console.log('\nSources:');
                for (const annotation of output.annotations) {
                    if (annotation.type === 'url_citation') {
                        console.log(`- ${annotation.title}: ${annotation.url}`);
                    }
                }
            }
        }
    }

###### Expected output schema

Expect the following output schema when using URL context.

The **Call Block** (type: `"url_context_call"`) contains the URL the model attempted to read.

    {
      "type": "url_context_call",
      "id": "browse_001",
      "arguments": {
        "urls": ["https://www.wikipedia.org/"]
      },
      "signature": "EkYKIGY5OT..."
    }

The **Result Block** (type: `"url_context_result"`) contains the status of the retrieval.

    {
      "type": "url_context_result",
      "call_id": "browse_001",
      "result": {
        "url": "https://www.wikipedia.org/",
        "status": "URL_RETRIEVAL_STATUS_SUCCESS"
      },
      "signature": "EkYKIGY5OT..."
    }

The **Text Block** contains the generated text and inline citations.

    {
      "type": "text",
      "text": "Wikipedia is a free online encyclopedia...",
      "annotations": [
        {
          "type": "url_citation",
          "url": "https://www.wikipedia.org/",
          "title": "Wikipedia --- Main Page",
          "start_index": 0,
          "end_index": 42
        }
      ]
    }

##### Computer use

### Python

    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-2.5-computer-use-preview-10-2025",
        input="Search for highly rated smart fridges with touchscreen, 2 doors, around 25 cu ft, priced below 4000 dollars on Google Shopping. Create a bulleted list of the 3 cheapest options in the format of name, description, price in an easy-to-read layout.",
        tools=[{
            "type": "computer_use",
            "environment": "browser",
            "excludedPredefinedFunctions": ["drag_and_drop"]
        }]
    )

    # The response will contain tool calls (actions) for the computer interface
    # or text explaining the action
    for output in interaction.outputs:
        print(output)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-2.5-computer-use-preview-10-2025',
        input: 'Search for highly rated smart fridges with touchscreen, 2 doors, around 25 cu ft, priced below 4000 dollars on Google Shopping. Create a bulleted list of the 3 cheapest options in the format of name, description, price in an easy-to-read layout.',
        tools: [{
            type: 'computer_use',
            environment: 'browser',
            excludedPredefinedFunctions: ['drag_and_drop']
        }]
    });

    // The response will contain tool calls (actions) for the computer interface
    // or text explaining the action
    interaction.outputs.forEach(output => console.log(output));

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-2.5-computer-use-preview-10-2025",
        "input": "Search for highly rated smart fridges with touchscreen, 2 doors, around 25 cu ft, priced below 4000 dollars on Google Shopping. Create a bulleted list of the 3 cheapest options in the format of name, description, price in an easy-to-read layout.",
        "tools": [{
            "type": "computer_use",
            "environment": "browser",
            "excludedPredefinedFunctions": ["drag_and_drop"]
        }]
    }'

###### Handling Computer Use function results

Since Computer Use is a client-side tool loop, you must execute the action (e.g., opening a browser) and send the result back to the model. When sending the `function_result` for actions like `open_web_browser`, make sure to pass the URL response in the results list as shown below:

    {
      "type": "function_result",
      "name": "open_web_browser",
      "call_id": "5q6h0z70",
      "result": [
        {
          "type": "text",
          "text": "{\"url\": \"https://google.com\", \"safety_acknowledgement\":true}"
        },
        {
          "type": "image",
          "data": "iVBORw0KGgoAAAANSUhEUgAA...",
          "mime_type": "image/png"
        }
      ]
    }

##### File search

Grounding with File search allows the model to search your uploaded files in File Search Stores.

### Python

    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Tell me about the book 'I, Claudius'",
        tools=[{"type": "file_search", "file_search_store_names": ["fileSearchStores/my-store-name"]}]
    )

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: "Tell me about the book 'I, Claudius'",
        tools: [{ type: 'file_search', file_search_store_names: ['fileSearchStores/my-store-name'] }]
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Tell me about the book 'I, Claudius'",
        "tools": [{"type": "file_search", "file_search_store_names": ["fileSearchStores/my-store-name"]}]
    }'

###### Handling the response

The following snippet demonstrates how to handle the response by extracting the text and inline citations (type `file_citation`).

### Python

    for output in interaction.outputs:
        if output.type == "text":
            print(output.text)
            if output.annotations:
                print("\nSources:")
                for annotation in output.annotations:
                    if annotation.get("type") == "file_citation":
                        print(f"- {annotation['file_name']} ({annotation['document_uri']}):")
                        print(f"  Snippet: {annotation['source']}")

### JavaScript

    for (const output of interaction.outputs) {
        if (output.type === 'text') {
            console.log(output.text);
            if (output.annotations) {
                console.log('\nSources:');
                for (const annotation of output.annotations) {
                    if (annotation.type === 'file_citation') {
                        console.log(`- ${annotation.fileName} (${annotation.documentUri}):`);
                        console.log(`  Snippet: ${annotation.source}`);
                    }
                }
            }
        }
    }

###### Expected output schema

Expect the following output schema when using File search.

The **Call Block** (type: `"file_search_call"`) contains the call metadata.

    {
      "type": "file_search_call",
      "id": "filesearch_001",
      "signature": "EkYKIGY5OT..."
    }

The **Result Block** (type: `"file_search_result"`) contains the result metadata.

    {
      "type": "file_search_result",
      "call_id": "filesearch_001",
      "signature": "EkYKIGY5OT..."
    }

The **Text Block** contains the generated text and inline citations.

    {
      "type": "text",
      "text": "The book 'I, Claudius' is a historical novel by Robert Graves...",
      "annotations": [
        {
          "type": "file_citation",
          "document_uri": "fileSearchStores/my-store-name/documents/abc",
          "file_name": "book_summaries.pdf",
          "source": "Claudius is the narrator of this historical novel...",
          "start_index": 0,
          "end_index": 60
        }
      ]
    }

#### Combining built-in tools and function calling

You can use [built-in tools and function calling](https://ai.google.dev/gemini-api/docs/tool-combination) together in the same request.

### Python

    from google import genai
    import json

    client = genai.Client()

    get_weather = {
        "type": "function",
        "name": "getWeather",
        "description": "Gets the weather for a requested city.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "The city and state, e.g. Utqiaġvik, Alaska",
                },
            },
            "required": ["city"],
        },
    }

    tools = [
        {"type": "google_search"},  # Built-in tool
        get_weather                 # Custom tool (callable)
    ]

    # Turn 1: Initial request with both tools enabled
    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="What is the northernmost city in the United States? What's the weather like there today?",
        tools=tools
    )

    for output in interaction.outputs:
        if output.type == "function_call":
            print(f"Function call: {output.name} (ID: {output.id})")
            # Execute your custom function locally
            result = {"response": "Very cold. 22 degrees Fahrenheit."}
            # Turn 2: Provide the function result back to the model.
            # Passing `previous_interaction_id` automatically circulates the
            # built-in Google Search context (and thought signatures) from Turn 1
            interaction_2 = client.interactions.create(
                model="gemini-3-flash-preview",
                previous_interaction_id=interaction.id,
                tools=tools,
                input=[{
                    "type": "function_result",
                    "name": output.name,
                    "call_id": output.id,
                    "result": json.dumps(result)
                }]
            )

            for output in interaction_2.outputs:
                if output.type == "text":
                    print(output.text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const weatherTool = {
        type: 'function',
        name: 'get_weather',
        description: 'Gets the weather for a given location.',
        parameters: {
            type: 'object',
            properties: {
                location: { type: 'string', description: 'The city and state, e.g. San Francisco, CA' }
            },
            required: ['location']
        }
    };

    const tools = [
        {type: 'google_search'}, // Built-in tool
        weatherTool              // Custom tool
    ];

    // Turn 1: Initial request with both tools enabled
    let interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: "What is the northernmost city in the United States? What's the weather like there today?",
        tools: tools
    });

    for (const output of interaction.outputs) {
        if (output.type == "function_call") {
            console.log(`Function call: ${output.name} (ID: ${output.id})`);
            // Execute your custom function locally
            const result = {response: "Very cold. 22 degrees Fahrenheit."};
            // Turn 2: Provide the function result back to the model.
            // Passing `previous_interaction_id` automatically circulates the
            // built-in Google Search context (and thought signatures) from Turn 1
            const interaction_2 = await client.interactions.create({
                model: "gemini-3-flash-preview",
                previous_interaction_id: interaction.id,
                tools: tools,
                input: [{
                    type: "function_result",
                    name: output.name,
                    call_id: output.id,
                    result: JSON.stringify(result)
                }]
            });

            for (const output_2 of interaction_2.outputs) {
                if (output_2.type == "text") {
                    console.log(output_2.text);
                }
            }
        }
    }

### REST

    # Turn 1: Initial request with both tools enabled
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "What is the northernmost city in the United States? What is the weather like there today?",
        "tools": [
            {"type": "google_search"},
            {
                "type": "function",
                "name": "get_weather",
                "description": "Gets the weather for a given location.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string", "description": "The city and state, e.g. San Francisco, CA"}
                    },
                    "required": ["location"]
                }
            }
        ]
    }'

    # Assuming Turn 1 returns a function_call for get_weather,
    # replace INTERACTION_ID and CALL_ID with values from Turn 1 response.
    # Turn 2: Provide the function result back to the model.
    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "previous_interaction_id": "INTERACTION_ID",
        "tools": [
            {"type": "google_search"},
            {
                "type": "function",
                "name": "get_weather",
                "description": "Gets the weather for a given location.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string", "description": "The city and state, e.g. San Francisco, CA"}
                    },
                    "required": ["location"]
                }
            }
        ],
        "input": [{
            "type": "function_result",
            "name": "get_weather",
            "call_id": "CALL_ID",
            "result": "{\"response\": \"Very cold. 22 degrees Fahrenheit.\"}"
        }]
    }'

##### Understanding tool context circulation

Gemini 3 and newer models support **tool context circulation** to maintain a
reliable "memory" of server-side actions. When a built-in tool (like Google
Search) is triggered, the API generates specific `toolCall` and `toolResponse`
parts. These parts contain the precise context the model needs to reason about
those results in the next turn.

- **Stateful (Recommended)** : If you use `previous_interaction_id`, the API manages this circulation for you automatically.
- **Stateless**: If you manage history manually, you must include these blocks exactly as they were returned by the API in your input array.

### Remote Model context protocol (MCP)

Remote [MCP](https://modelcontextprotocol.io/docs/getting-started/intro)
integration simplifies agent development by allowing the Gemini API
to directly call external tools hosted on remote servers.

### Python

    import datetime
    from google import genai

    client = genai.Client()

    mcp_server = {
        "type": "mcp_server",
        "name": "weather_service",
        "url": "https://gemini-api-demos.uc.r.appspot.com/mcp"
    }

    today = datetime.date.today().strftime("%d %B %Y")

    interaction = client.interactions.create(
        model="gemini-2.5-flash",
        input="What is the weather like in New York today?",
        tools=[mcp_server],
        system_instruction=f"Today is {today}."
    )

    print(interaction.outputs[-1].text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const mcpServer = {
        type: 'mcp_server',
        name: 'weather_service',
        url: 'https://gemini-api-demos.uc.r.appspot.com/mcp'
    };

    const today = new Date().toDateString();

    const interaction = await client.interactions.create({
        model: 'gemini-2.5-flash',
        input: 'What is the weather like in New York today?',
        tools: [mcpServer],
        system_instruction: `Today is ${today}.`
    });

    console.log(interaction.outputs[interaction.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-2.5-flash",
        "input": "What is the weather like in New York today?",
        "tools": [{
            "type": "mcp_server",
            "name": "weather_service",
            "url": "https://gemini-api-demos.uc.r.appspot.com/mcp"
        }],
        "system_instruction": "Today is '"$(date +"%du%Bt%Y")"' YYYY-MM-DD>."
    }'

**Important notes:**

- Remote MCP only works with Streamable HTTP servers (SSE servers are not supported)
- Remote MCP does not work with Gemini 3 models (this is coming soon)
- MCP server names shouldn't include "-" character (use snake_case server names instead)

### Structured output (JSON schema)

Enforce a specific JSON output by providing a JSON schema in the
`response_format` parameter. This is useful for tasks like moderation,
classification, or data extraction.

### Python

    from google import genai
    from pydantic import BaseModel, Field
    from typing import Literal, Union
    client = genai.Client()

    class SpamDetails(BaseModel):
        reason: str = Field(description="The reason why the content is considered spam.")
        spam_type: Literal["phishing", "scam", "unsolicited promotion", "other"]

    class NotSpamDetails(BaseModel):
        summary: str = Field(description="A brief summary of the content.")
        is_safe: bool = Field(description="Whether the content is safe for all audiences.")

    class ModerationResult(BaseModel):
        decision: Union[SpamDetails, NotSpamDetails]

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Moderate the following content: 'Congratulations! You've won a free cruise. Click here to claim your prize: www.definitely-not-a-scam.com'",
        response_format=ModerationResult.model_json_schema(),
    )

    parsed_output = ModerationResult.model_validate_json(interaction.outputs[-1].text)
    print(parsed_output)

### JavaScript

    import { GoogleGenAI } from '@google/genai';
    import { z } from 'zod';
    const client = new GoogleGenAI({});

    const moderationSchema = z.object({
        decision: z.union([
            z.object({
                reason: z.string().describe('The reason why the content is considered spam.'),
                spam_type: z.enum(['phishing', 'scam', 'unsolicited promotion', 'other']).describe('The type of spam.'),
            }).describe('Details for content classified as spam.'),
            z.object({
                summary: z.string().describe('A brief summary of the content.'),
                is_safe: z.boolean().describe('Whether the content is safe for all audiences.'),
            }).describe('Details for content classified as not spam.'),
        ]),
    });

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: "Moderate the following content: 'Congratulations! You've won a free cruise. Click here to claim your prize: www.definitely-not-a-scam.com'",
        response_format: z.toJSONSchema(moderationSchema),
    });
    console.log(interaction.outputs[0].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Moderate the following content: 'Congratulations! You've won a free cruise. Click here to claim your prize: www.definitely-not-a-scam.com'",
        "response_format": {
            "type": "object",
            "properties": {
                "decision": {
                    "type": "object",
                    "properties": {
                        "reason": {"type": "string", "description": "The reason why the content is considered spam."},
                        "spam_type": {"type": "string", "description": "The type of spam."}
                    },
                    "required": ["reason", "spam_type"]
                }
            },
            "required": ["decision"]
        }
    }'

### Combining tools and structured output

Combine built-in tools with structured output to get a reliable JSON object
based on information retrieved by a tool.

### Python

    from google import genai
    from pydantic import BaseModel, Field
    from typing import Literal, Union

    client = genai.Client()

    class SpamDetails(BaseModel):
        reason: str = Field(description="The reason why the content is considered spam.")
        spam_type: Literal["phishing", "scam", "unsolicited promotion", "other"]

    class NotSpamDetails(BaseModel):
        summary: str = Field(description="A brief summary of the content.")
        is_safe: bool = Field(description="Whether the content is safe for all audiences.")

    class ModerationResult(BaseModel):
        decision: Union[SpamDetails, NotSpamDetails]

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Moderate the following content: 'Congratulations! You've won a free cruise. Click here to claim your prize: www.definitely-not-a-scam.com'",
        response_format=ModerationResult.model_json_schema(),
        tools=[{"type": "url_context"}]
    )

    parsed_output = ModerationResult.model_validate_json(interaction.outputs[-1].text)
    print(parsed_output)

### JavaScript

    import { GoogleGenAI } from '@google/genai';
    import { z } from 'zod'; // Assuming zod is used for schema generation, or define manually
    const client = new GoogleGenAI({});

    const obj = z.object({
        winning_team: z.string(),
        score: z.string(),
    });
    const schema = z.toJSONSchema(obj);

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Who won the last euro?',
        tools: [{ type: 'google_search' }],
        response_format: schema,
    });
    console.log(interaction.outputs[0].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Who won the last euro?",
        "tools": [{"type": "google_search"}],
        "response_format": {
            "type": "object",
            "properties": {
                "winning_team": {"type": "string"},
                "score": {"type": "string"}
            }
        }
    }'

## Advanced features

There are also additional advance features that give you more flexibility
in working with Interactions API.

### Streaming

Receive responses incrementally as they are generated.

When `stream=true`, the final `interaction.complete` event does not contain the
generated content in the `outputs` field. It only contains usage metadata and
the final status. You must aggregate `content.delta` events client-side to
reconstruct the full response or tool call arguments.

### Python

    from google import genai

    client = genai.Client()

    stream = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Explain quantum entanglement in simple terms.",
        stream=True
    )

    for chunk in stream:
        if chunk.event_type == "content.delta":
            if chunk.delta.type == "text":
                print(chunk.delta.text, end="", flush=True)
            elif chunk.delta.type == "thought_summary":
                print(getattr(chunk.delta.content, "text", ""), end="", flush=True)
        elif chunk.event_type == "interaction.complete":
            print(f"\n\n--- Stream Finished ---")
            print(f"Total Tokens: {chunk.interaction.usage.total_tokens}")

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const stream = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Explain quantum entanglement in simple terms.',
        stream: true,
    });

    for await (const chunk of stream) {
        if (chunk.event_type === 'content.delta') {
            if (chunk.delta.type === 'text' && 'text' in chunk.delta) {
                process.stdout.write(chunk.delta.text);
            } else if (chunk.delta.type === 'thought_summary' && chunk.delta.content) {
                process.stdout.write(chunk.delta.content.text || '');
            }
        } else if (chunk.event_type === 'interaction.complete') {
            console.log('\n\n--- Stream Finished ---');
            console.log(`Total Tokens: ${chunk.interaction.usage.total_tokens}`);
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Explain quantum entanglement in simple terms.",
        "stream": true
    }'

#### Streaming event types

When streaming is enabled, the API returns Server-Sent Events (SSE). Each event
has an `event_type` field indicating its purpose. Full list of event types is available in the [API reference](https://ai.google.dev/api/interactions-api#Resource:Interaction).

| Event Type | Description |
|---|---|
| `interaction.start` | First event. Contains the interaction `id` and initial `status` (`in_progress`). |
| `interaction.status_update` | Indicates status changes (e.g., `in_progress`). |
| `content.start` | Marks the start of a new output block. Contains `index` and content `type` (e.g., `text`, `thought`). |
| `content.delta` | Incremental content updates. Contains the partial data keyed by `delta.type`. |
| `content.stop` | Marks the end of an output block at `index`. |
| `interaction.complete` | Final event. Contains `id`, `status`, `usage`, and metadata. **Note:** `outputs` is `None`---you must reconstruct outputs from the `content.*` events. |
| `error` | Indicates an error occurred. Contains `error.code` and `error.message`. |

#### Reconstructing the Interaction object from streaming events

Unlike non-streaming responses, streaming responses do **not** contain an
`outputs` array. You must reconstruct outputs by accumulating content from the
`content.delta` events.

### Python

    from google import genai

    client = genai.Client()

    stream = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Write a haiku about Python programming.",
        stream=True
    )

    # Accumulate outputs by index
    outputs = {}
    usage = None

    for chunk in stream:
        if chunk.event_type == "content.start":
            outputs[chunk.index] = {"type": chunk.content.type}

        elif chunk.event_type == "content.delta":
            output = outputs[chunk.index]
            if chunk.delta.type == "text":
                output["text"] = output.get("text", "") + chunk.delta.text
            elif chunk.delta.type == "thought_signature":
                output["signature"] = chunk.delta.signature
            elif chunk.delta.type == "thought_summary":
                output["summary"] = output.get("summary", "") + getattr(chunk.delta.content, "text", "")

        elif chunk.event_type == "interaction.complete":
            usage = chunk.interaction.usage

    # Final outputs list (sorted by index)
    final_outputs = [outputs[i] for i in sorted(outputs.keys())]
    print(f"\n\nOutputs: {final_outputs}")

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const stream = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Write a haiku about Python programming.',
        stream: true,
    });

    // Accumulate outputs by index
    const outputs = new Map();
    let usage = null;

    for await (const chunk of stream) {
        if (chunk.event_type === 'content.start') {
            outputs.set(chunk.index, { type: chunk.content.type });

        } else if (chunk.event_type === 'content.delta') {
            const output = outputs.get(chunk.index);
            if (chunk.delta.type === 'text') {
                output.text = (output.text || '') + chunk.delta.text;
                process.stdout.write(chunk.delta.text);
            } else if (chunk.delta.type === 'thought_signature') {
                output.signature = chunk.delta.signature;
            } else if (chunk.delta.type === 'thought_summary') {
                output.summary = (output.summary || '') + (chunk.delta.content?.text || '');
            }

        } else if (chunk.event_type === 'interaction.complete') {
            usage = chunk.interaction.usage;
        }
    }

    // Final outputs list (sorted by index)
    const finalOutputs = [...outputs.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([_, output]) => output);
    console.log(`\n\nOutputs:`, finalOutputs);

#### Streaming tool calls

When using tools with streaming, the model generates function calls as a sequence of
`content.delta` events on the stream. Unlike text, tool arguments are delivered as
complete JSON objects within a single `content.delta` event. The
`outputs` array is empty in the `interaction.complete` event during
streaming, you must capture tool calls from deltas as shown below.

### Python

    from google import genai
    import json

    client = genai.Client()

    weather_tool = {
        "type": "function",
        "name": "get_weather",
        "description": "Gets the weather for a given location.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "The city and state"}
            },
            "required": ["location"]
        }
    }

    stream = client.interactions.create(
        model="gemini-3-flash-preview",
        input="What is the weather in Paris?",
        tools=[weather_tool],
        stream=True
    )

    # A map to capture tool calls by their ID as they arrive
    function_calls = {}

    for chunk in stream:
        if chunk.event_type == "content.delta":
            if chunk.delta.type == "text" and chunk.delta.text:
                print(chunk.delta.text, end="", flush=True)

            elif chunk.delta.type == "function_call":
                print(f"\nExecuting {chunk.delta.name} immediately...")
                # result = my_tools[chunk.delta.name](**chunk.delta.arguments)
                function_calls[chunk.delta.id] = chunk.delta

        elif chunk.event_type == "interaction.complete":
            print("\n\nAll tools executed. Stream finished.")

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const weatherTool = {
        type: 'function',
        name: 'get_weather',
        description: 'Gets the weather for a given location.',
        parameters: {
            type: 'object',
            properties: {
                location: { type: 'string', description: 'The city and state' }
            },
            required: ['location']
        }
    };

    const stream = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'What is the weather in Paris?',
        tools: [weatherTool],
        stream: true,
    });

    const toolCalls = new Map();

    for await (const chunk of stream) {
        if (chunk.event_type === 'content.delta') {
            if (chunk.delta.type === 'text' && chunk.delta.text) {
                process.stdout.write(chunk.delta.text);

            } else if (chunk.delta.type === 'function_call') {
                console.log(`\nExecuting ${chunk.delta.name} immediately...`);
                // const result = myTools[chunk.delta.name](chunk.delta.arguments);
                toolCalls.set(chunk.delta.id, chunk.delta);
            }
        } else if (chunk.event_type === 'interaction.complete') {
            console.log('\n\nAll tools executed. Stream finished.');
        }
    }

### REST

    # When streaming via SSE, capture function_call data from content.delta events.
    # The 'arguments' field arrives as a complete JSON object once generated.

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "What is the weather in Paris?",
        "tools": [{
            "type": "function",
            "name": "get_weather",
            "description": "Gets the weather for a given location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "The city and state"}
                },
                "required": ["location"]
            }
        }],
        "stream": true
    }'

### Configuration

Customize the model's behavior with `generation_config`.

### Python

    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Tell me a story about a brave knight.",
        generation_config={
            "temperature": 0.7,
            "max_output_tokens": 500,
            "thinking_level": "low",
        }
    )

    print(interaction.outputs[-1].text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Tell me a story about a brave knight.',
        generation_config: {
            temperature: 0.7,
            max_output_tokens: 500,
            thinking_level: 'low',
        }
    });

    console.log(interaction.outputs[interaction.outputs.length - 1].text);

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Tell me a story about a brave knight.",
        "generation_config": {
            "temperature": 0.7,
            "max_output_tokens": 500,
            "thinking_level": "low"
        }
    }'

### Thinking

Gemini 2.5 and newer models use an internal reasoning process called "thinking"
before generating a response. This helps the model produce better answers for
complex tasks like math, coding, and multi-step reasoning.

#### Thinking level

The `thinking_level` parameter lets you control the model's reasoning depth:

| Level | Description | Supported Models |
|---|---|---|
| `minimal` | Matches the "no thinking" setting for most queries. In some cases, models may think very minimally. Minimizes latency and cost. | **Flash Models Only** (e.g. Gemini 3 Flash) |
| `low` | Light reasoning that prioritises latency and cost savings for simple instruction following and chat. | **All Thinking Models** |
| `medium` | Balanced thinking for most tasks. | **Flash Models Only** (e.g. Gemini 3 Flash) |
| `high` | **(Default)** Maximizes reasoning depth. The model may take significantly longer to reach a first token, but the output will be more carefully reasoned. | **All Thinking Models** |

#### Thinking summaries

The model's thinking is represented as **thought blocks** (`type: "thought"`)
in the response outputs. You can control whether to receive human-readable
summaries of the thinking process using the `thinking_summaries` parameter:

| Value | Description |
|---|---|
| `auto` | **(Default)** Returns thought summaries when available. |
| `none` | Disables thought summaries. |

### Python

    from google import genai

    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input="Solve this step by step: What is 15% of 240?",
        generation_config={
            "thinking_level": "high",
            "thinking_summaries": "auto"
        }
    )

    for output in interaction.outputs:
        if output.type == "thought":
            print(f"Thinking: {output.summary}")
        elif output.type == "text":
            print(f"Answer: {output.text}")

### JavaScript

    import { GoogleGenAI } from '@google/genai';

    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: 'Solve this step by step: What is 15% of 240?',
        generation_config: {
            thinking_level: 'high',
            thinking_summaries: 'auto'
        }
    });

    for (const output of interaction.outputs) {
        if (output.type === 'thought') {
            console.log(`Thinking: ${output.summary}`);
        } else if (output.type === 'text') {
            console.log(`Answer: ${output.text}`);
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": "Solve this step by step: What is 15% of 240?",
        "generation_config": {
            "thinking_level": "high",
            "thinking_summaries": "auto"
        }
    }'

Every thought block contains a `signature` field (a cryptographic hash of the
internal reasoning state) and an optional `summary` field (a human-readable
summary of the model's reasoning). The `signature` is always present, but a
thought block may contain only a signature with no summary in these cases:

- **Simple requests**: The model didn't reason enough to generate a summary
- **`thinking_summaries: "none"`**: Summaries are explicitly disabled

Your code should always handle thought blocks where the `summary` is empty or
absent. When managing conversation history manually (stateless mode), you must
include thought blocks with their signatures in subsequent requests to validate
authenticity.

### Working with files

#### Working with remote files

Access files using remote URLs directly in the API call.

### Python

    from google import genai
    client = genai.Client()

    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input=[
            {
                "type": "image",
                "uri": "https://github.com/<github-path>/cats-and-dogs.jpg",
            },
            {"type": "text", "text": "Describe what you see."}
        ],
    )
    for output in interaction.outputs:
        if output.type == "text":
            print(output.text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';
    const client = new GoogleGenAI({});

    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: [
            {
                type: 'image',
                uri: 'https://github.com/<github-path>/cats-and-dogs.jpg',
            },
            { type: 'text', text: 'Describe what you see.' }
        ],
    });
    for (const output of interaction.outputs) {
        if (output.type === 'text') {
            console.log(output.text);
        }
    }

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": [
            {
                "type": "image",
                "uri": "https://github.com/<github-path>/cats-and-dogs.jpg"
            },
            {"type": "text", "text": "Describe what you see."}
        ]
    }'

#### Working with Gemini Files API

Upload files to the Gemini [Files API](https://ai.google.dev/gemini-api/docs/files)
before using them.

### Python

    from google import genai
    import time
    import requests
    client = genai.Client()

    # 1. Download the file
    url = "https://github.com/philschmid/gemini-samples/raw/refs/heads/main/assets/cats-and-dogs.jpg"
    response = requests.get(url)
    with open("cats-and-dogs.jpg", "wb") as f:
        f.write(response.content)

    # 2. Upload to Gemini Files API
    file = client.files.upload(file="cats-and-dogs.jpg")

    # 3. Wait for processing
    while client.files.get(name=file.name).state != "ACTIVE":
        time.sleep(2)

    # 4. Use in Interaction
    interaction = client.interactions.create(
        model="gemini-3-flash-preview",
        input=[
            {
                "type": "image",
                "uri": file.uri,
            },
            {"type": "text", "text": "Describe what you see."}
        ],
    )
    for output in interaction.outputs:
        if output.type == "text":
            print(output.text)

### JavaScript

    import { GoogleGenAI } from '@google/genai';
    import * as fs from 'fs';
    import fetch from 'node-fetch';
    const client = new GoogleGenAI({});

    // 1. Download the file
    const url = 'https://github.com/philschmid/gemini-samples/raw/refs/heads/main/assets/cats-and-dogs.jpg';
    const filename = 'cats-and-dogs.jpg';
    const response = await fetch(url);
    const buffer = await response.buffer();
    fs.writeFileSync(filename, buffer);

    // 2. Upload to Gemini Files API
    const myfile = await client.files.upload({ file: filename, config: { mimeType: 'image/jpeg' } });

    // 3. Wait for processing
    while ((await client.files.get({ name: myfile.name })).state !== 'ACTIVE') {
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 4. Use in Interaction
    const interaction = await client.interactions.create({
        model: 'gemini-3-flash-preview',
        input: [
            { type: 'image', uri: myfile.uri, },
            { type: 'text', text: 'Describe what you see.' }
        ],
    });
    for (const output of interaction.outputs) {
        if (output.type === 'text') {
            console.log(output.text);
        }
    }

### REST

    # 1. Upload the file (Requires File API setup)
    # See https://ai.google.dev/gemini-api/docs/files for details.
    # Assume FILE_URI is obtained from the upload step.

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
    -H "Content-Type: application/json" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -d '{
        "model": "gemini-3-flash-preview",
        "input": [
            {"type": "image", "uri": "FILE_URI"},
            {"type": "text", "text": "Describe what you see."}
        ]
    }'

### Flex and Priority inference tiers

You can use inference tiers with the Interactions API to optimize for different
workload needs:

- [Flex](https://ai.google.dev/gemini-api/docs/flex-inference) (`flex`) for cost optimization; 50% off standard pricing.
- [Priority](https://ai.google.dev/gemini-api/docs/priority-inference) (`priority`) for
  latency optimization; the highest reliability service tier.

### Python

    import google.genai as genai

    client = genai.Client()

    try:
        interaction = client.interactions.create(
            model="gemini-3-flash-preview",
            input="Analyze this dataset for trends...",
            service_tier='flex'
        )
        print(interaction.outputs[-1].text)
    except Exception as e:
        print(f"Flex request failed: {e}")

### Javascript

     import { GoogleGenAI } from '@google/genai';

     const client = new GoogleGenAI({});

     async function main() {
         try {
             const interaction = await client.interactions.create({
                 model: 'gemini-3-flash-preview',
                 input: 'Analyze this dataset for trends...',
                 service_tier: 'flex'
             });
             console.log(interaction.outputs[interaction.outputs.length - 1].text);
         } catch (e) {
             console.log(`Flex request failed: ${e}`);
         }
     }
     await main();

### REST

     curl -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
     -H "Content-Type: application/json" \
     -H "x-goog-api-key: $GEMINI_API_KEY" \
     -d '{
         "model": "gemini-3-flash-preview",
         "input": "Analyze this dataset for trends...",
         "service_tier": "flex"
     }'

### Data model

You can learn more about the data model in the [API
Reference](https://ai.google.dev/api/interactions-api#data-models). The following is a high
level overview of the main components.

#### Interaction

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for the interaction. |
| `model` / `agent` | `string` | The model or agent used. Only one can be provided. |
| `input` | [`Content[]`](https://ai.google.dev/api/interactions-api#data-models) | The inputs provided. |
| `outputs` | [`Content[]`](https://ai.google.dev/api/interactions-api#data-models) | The model's responses. |
| `tools` | [`Tool[]`](https://ai.google.dev/api/interactions-api#Resource:Tool) | The tools used. |
| `previous_interaction_id` | `string` | ID of the previous interaction for context. |
| `stream` | `boolean` | Whether the interaction is streaming. |
| `status` | `string` | Status: `completed`, `in_progress`, `requires_action`,`failed`, etc. |
| `background` | `boolean` | Whether the interaction is in background mode. |
| `store` | `boolean` | Whether to store the interaction. Default: `true`. Set to `false` to opt out. |
| `usage` | [Usage](https://ai.google.dev/api/interactions-api#Resource:Interaction) | Token usage of the interaction request. |

## Supported models \& agents

| Model Name | Type | Model ID |
|---|---|---|
| Gemini 3.1 Flash-Lite Preview | Model | `gemini-3.1-flash-lite-preview` |
| Gemini 3.1 Pro Preview | Model | `gemini-3.1-pro-preview` |
| Gemini 3 Flash Preview | Model | `gemini-3-flash-preview` |
| Gemini 2.5 Pro | Model | `gemini-2.5-pro` |
| Gemini 2.5 Flash | Model | `gemini-2.5-flash` |
| Gemini 2.5 Flash-lite | Model | `gemini-2.5-flash-lite` |
| Lyria 3 Clip Preview | Model | `lyria-3-clip-preview` |
| Lyria 3 Pro Preview | Model | `lyria-3-pro-preview` |
| Deep Research Preview | Agent | `deep-research-pro-preview-12-2025` |
| Deep Research Preview | Agent | `deep-research-preview-04-2026` |
| Deep Research Preview | Agent | `deep-research-max-preview-04-2026` |

## How the Interactions API works

The Interactions API is designed around a central resource: the
[**`Interaction`**](https://ai.google.dev/api/interactions-api#Resource:Interaction).
An `Interaction` represents a complete turn in a conversation
or task. It acts as a session record, containing the entire history of an
interaction, including all user inputs, model thoughts, tool calls, tool
results, and final model outputs.

When you make a call to
[`interactions.create`](https://ai.google.dev/api/interactions-api#CreateInteraction), you are
creating a new `Interaction` resource.

### Server-side state management

You can use the `id` of a completed interaction in a subsequent call using the
`previous_interaction_id` parameter to continue the conversation. The server
uses this ID to retrieve the conversation history, saving you from having to
resend the entire chat history.

Only the conversation history (inputs and outputs) is preserved
using `previous_interaction_id`. The other parameters are **interaction-scoped**
and apply only to the specific interaction you are currently generating:

- `tools`
- `system_instruction`
- `generation_config` (including `thinking_level`, `temperature`, etc.)

This means you must re-specify these parameters in each new interaction if you
want them to apply. This server-side state management is optional; you can also
operate in stateless mode by sending the full conversation history in each
request.

### Data storage and retention

By default, all Interaction objects are stored (`store=true`) in order to
simplify use of server-side state management features (with
`previous_interaction_id`), background execution (using `background=true`) and
observability purposes.

- **Paid Tier** : Interactions are retained for **55 days**.
- **Free Tier** : Interactions are retained for **1 day**.

If you don't want this, you can
set `store=false` in your request. This control is separate from state
management; you can opt out of storage for any interaction. However, note that
`store=false` is incompatible with `background=true` and prevents using
`previous_interaction_id` for subsequent turns.

You can delete stored interactions at any time using the delete method found in
the [API Reference](https://ai.google.dev/api/interactions-api). You can only delete interactions if
you know the interaction ID.

After the retention period expires, your data will be
deleted automatically.

Interactions objects are processed according to the [terms](https://ai.google.dev/gemini-api/terms).

## Best practices

- **Cache hit rate** : Using `previous_interaction_id` to continue conversations allows the system to more easily utilize implicit caching for the conversation history, which improves performance and reduces costs.
- **Mixing interactions** : You have the flexibility to mix and match Agent and Model interactions within a conversation. For example, you can use a specialized agent, like the Deep Research agent, for initial data collection, and then use a standard Gemini model for follow-up tasks such as summarizing or reformatting, linking these steps with the `previous_interaction_id`.

## SDKs

You can use latest version of the Google GenAI SDKs in order to access
Interactions API.

- On Python, this is `google-genai` package from `1.55.0` version onwards.
- On JavaScript, this is `@google/genai` package from `1.33.0` version onwards.

You can learn more about how to install the SDKs on
[Libraries](https://ai.google.dev/gemini-api/docs/libraries) page.

## Limitations

- **Beta status**: The Interactions API is in beta/preview. Features and schemas may change.
- **Remote MCP**: Gemini 3 does not support remote MCP, this is coming soon.

## Breaking changes

The Interactions API is currently in an early beta stage. We are actively
developing and refining the API capabilities, resource schemas, and SDK
interfaces based on real-world usage and developer feedback.

As a result, **breaking changes may occur**.
Updates may include changes to:

- Schemas for input and output.
- SDK method signatures and object structures.
- Specific feature behaviors.

For production workloads, you should continue to use the standard
[`generateContent`](https://ai.google.dev/gemini-api/docs/text-generation) API. It remains the
recommended path for stable deployments and will continue to be actively
developed and maintained.

## Feedback

Your feedback is critical to the development of the Interactions API.
Share your thoughts, report bugs, or request features on our
[Google AI Developer Community Forum](https://discuss.ai.google.dev/c/gemini-api/4).

## What's next

- Try the [Interactions API quickstart notebook](https://colab.sandbox.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_started_interactions_api.ipynb).
- Learn more about the [Gemini Deep Research Agent](https://ai.google.dev/gemini-api/docs/deep-research).
