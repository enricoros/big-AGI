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

export let isSpeechEnabled = false;
export let recognition: ISpeechRecognition;

if (typeof window !== 'undefined') {
    let Speech = ((window as any).SpeechRecognition ||
                (window as any).webkitSpeechRecognition ||
                (window as any).mozSpeechRecognition ||
                (window as any).msSpeechRecognition
                ) as ISpeechRecognition;

    if(typeof Speech !== 'undefined') {
        isSpeechEnabled = true;
        recognition = new Speech();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        recognition.onerror = (event) => {
            console.error('Error occurred during speech recognition:', event.error);
        };
        
    }
}