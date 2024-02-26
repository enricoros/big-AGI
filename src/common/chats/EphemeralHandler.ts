import { ChatActions, createDEphemeral, DConversationId } from '~/common/state/store-chats';

export class EphemeralHandler {
  private readonly ephemeralId: string;

  constructor(title: string, initialText: string, readonly conversationId: DConversationId, private readonly chatActions: ChatActions) {
    const dEphemeral = createDEphemeral(title, initialText);
    this.ephemeralId = dEphemeral.id;
    this.chatActions.appendEphemeral(this.conversationId, dEphemeral);
  }

  updateText(text: string): void {
    this.chatActions.updateEphemeralText(this.conversationId, this.ephemeralId, text);
  }

  updateState(state: object): void {
    this.chatActions.updateEphemeralState(this.conversationId, this.ephemeralId, state);
  }

  delete(): void {
    this.chatActions.deleteEphemeral(this.conversationId, this.ephemeralId);
  }
}