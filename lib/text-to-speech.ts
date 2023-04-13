import { ApiElevenLabsSpeechBody } from '../pages/api/elevenlabs/speech';


export async function speakText(text: string) {
  if (!text) return;

  try {
    const audioBuffer = await convertTextToSpeech(text);
    const audioContext = new AudioContext();
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = await audioContext.decodeAudioData(audioBuffer);
    bufferSource.connect(audioContext.destination);
    bufferSource.start();
  } catch (error) {
    console.error('Error playing first text:', error);
  }
}

/*async function playLastMessage(conversationId: string) {
  const messages = useChatStore.getState().conversations.find(conversation => conversation.id === conversationId)?.messages;
  if (!messages?.length) return;
  // grab the first paragraph of the last message (and not shorter than 100 characters, if possible)
  let text = '';
  const paragraphs = messages[messages.length - 1].text.split('\n');
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (text.length + trimmed.length > 100)
      break;
    text += (text.length > 0 ? '\n' : '') + trimmed;
  }
  await speakText(text);
}*/


async function convertTextToSpeech(text: string): Promise<ArrayBuffer> {
  const payload: ApiElevenLabsSpeechBody = {
    text,
  };

  const response = await fetch('/api/elevenlabs/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || errorData.message || 'Unknown error');
  }

  return await response.arrayBuffer();
}