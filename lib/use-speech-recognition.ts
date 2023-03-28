import * as React from 'react';

interface ISpeechRecognition {
    new (): ISpeechRecognition;
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onerror: (event: any) => void;
    onresult: (event: any) => void;
    onaudiostart: (event: any) => void;
    onaudioend: (event: any) => void;
    start: () => void;
}

/**
 * We use a hook to default to 'false/null' and dynamically create the engine and update the UI.
 */
export const useSpeechRecognition = (onResultCallback: (transcript: string) => void) => {
    const [isSpeechEnabled, setIsSpeechEnabled] = React.useState<boolean>(false);
    const [isRecordingSpeech, setIsRecordingSpeech] = React.useState<boolean>(false);
    const [recognition, setRecognition] = React.useState<ISpeechRecognition | null>(null);

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const Speech = ((window as any).SpeechRecognition ||
                (window as any).webkitSpeechRecognition ||
                (window as any).mozSpeechRecognition ||
                (window as any).msSpeechRecognition
            ) as ISpeechRecognition;

            if (typeof Speech !== 'undefined') {
                setIsSpeechEnabled(true);
                const instance = new Speech();
                instance.lang = 'en-US';
                instance.interimResults = false;
                instance.maxAlternatives = 1;

                instance.onerror = event => {
                    console.error('Error occurred during speech recognition:', event.error);
                };

                instance.onresult = (event) => {
                    let transcript = event.results[event.results.length - 1][0].transcript;
                    // shall we have these smarts?
                    transcript = (transcript || '')
                        .replaceAll(' question mark', '?')
                        .replaceAll(' comma', ',')
                        .replaceAll(' exclamation mark', '!');
                    if (transcript)
                        onResultCallback(transcript);
                };

                instance.onaudioend = () => {
                    setIsRecordingSpeech(false);
                }

                setRecognition(instance);
            }
        }
    }, [onResultCallback]);

    const startRecording = () => {
        if (recognition) {
            setIsRecordingSpeech(true);
            recognition.start();
        } else {
            console.error('Speech recognition is not supported or not initialized.');
        }
    };

    return { isSpeechEnabled, isRecordingSpeech, startRecording };
};