import * as React from 'react';

/**
 * The AloneDetector class checks if the current client is the only one present for a given app. It uses
 * BroadcastChannel to talk to other clients. If no other clients reply within a short time, it assumes it's
 * the only one and tells the caller.
 */
class AloneDetector {
  private readonly clientId: string;
  private readonly bChannel: BroadcastChannel;

  private aloneCallback: ((isAlone: boolean) => void) | null;
  private aloneTimerId: number | undefined;

  constructor(channelName: string, onAlone: (isAlone: boolean) => void) {

    this.clientId = Math.random().toString(36).substring(2, 10);
    this.aloneCallback = onAlone;

    this.bChannel = new BroadcastChannel(channelName);
    this.bChannel.onmessage = this.handleIncomingMessage;

  }

  public onUnmount(): void {
    // close channel
    this.bChannel.onmessage = null;
    this.bChannel.close();

    // clear timeout
    if (this.aloneTimerId)
      clearTimeout(this.aloneTimerId);

    this.aloneTimerId = undefined;
    this.aloneCallback = null;
  }

  public checkIfAlone(): void {

    // triggers other clients
    this.bChannel.postMessage({ type: 'CHECK', sender: this.clientId });

    // if no response within 500ms, assume this client is alone
    this.aloneTimerId = window.setTimeout(() => {
      this.aloneTimerId = undefined;
      this.aloneCallback?.(true);
    }, 500);

  }

  private handleIncomingMessage = (event: MessageEvent): void => {

    // ignore self messages
    if (event.data.sender === this.clientId) return;

    switch (event.data.type) {

      case 'CHECK':
        this.bChannel.postMessage({ type: 'ALIVE', sender: this.clientId });
        break;

      case 'ALIVE':
        // received an ALIVE message, tell the client they're not alone
        if (this.aloneTimerId) {
          clearTimeout(this.aloneTimerId);
          this.aloneTimerId = undefined;
        }
        this.aloneCallback?.(false);
        this.aloneCallback = null;
        break;

    }
  };
}


/**
 * React hook that checks whether the current tab is the only one open for a specific channel.
 *
 * @param {string} channelName - The name of the BroadcastChannel to communicate on.
 * @returns {boolean | null} - True if the current tab is alone, false if not, or null before the check completes.
 */
export function useSingleTabEnforcer(channelName: string): boolean | null {
  const [isAlone, setIsAlone] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const tabManager = new AloneDetector(channelName, setIsAlone);
    tabManager.checkIfAlone();
    return () => {
      tabManager.onUnmount();
    };
  }, [channelName]);

  return isAlone;
}