import { createCodeExecutionContentFragment, createCodeExecutionResponseContentFragment, createErrorContentFragment, createTextContentFragment, createToolCallContentFragment, DMessageContentFragment, DMessageFragment, isTextPart, specialShallowReplaceTextContentFragment } from '~/common/stores/chat/chat.fragments';

import type { AixWire_Particles } from '../server/api/aix.wiretypes';


export class PartReassembler {
  private fragments: DMessageFragment[] = [];
  private currentTextFragment: DMessageContentFragment | null = null;

  processParticle(particle: AixWire_Particles.ChatGenerateOp): void {
    if ('p' in particle) {
      this._handleParticleOp(particle);
    } else if ('cg' in particle) {
      this._handleControlMessage(particle);
    }
  }

  private _handleParticleOp(particle: AixWire_Particles.ParticleOp): void {
    switch (particle.p) {
      case 't_':
        this.handleTextParticle(particle);
        break;
      case 'function-call':
      case 'fc_':
        this.handleFunctionCallParticle(particle);
        break;
      case 'code-call':
        this.handleCodeCallParticle(particle);
        break;
      case 'code-response':
        this.handleCodeResponseParticle(particle);
        break;
    }
  }

  private _handleControlMessage(message: Extract<AixWire_Particles.ChatGenerateOp, { cg: string }>): void {
    switch (message.cg) {
      case 'issue':
        this.handleIssue(message.issueText);
        break;
      // Handle other control messages if needed
    }
  }


  private handleTextParticle(particle: Extract<AixWire_Particles.ParticleOp, { p: 't_' }>): void {
    if (!this.currentTextFragment || !isTextPart(this.currentTextFragment.part)) {
      this.currentTextFragment = createTextContentFragment(particle.t);
      console.log('created text', this.currentTextFragment);
      this.fragments.push(this.currentTextFragment);
    } else {
      this.currentTextFragment = specialShallowReplaceTextContentFragment(
        this.currentTextFragment,
        this.currentTextFragment.part.text + particle.t,
      );
      console.log('updated text', this.currentTextFragment);
    }
  }

  private handleFunctionCallParticle(particle: Extract<AixWire_Particles.ParticleOp, { p: 'function-call' | 'fc_' }>): void {
    if (particle.p === 'function-call') {
      const fragment = createToolCallContentFragment(
        particle.id,
        particle.name,
        particle.i_args || null,
      );
      console.log('created tool call', fragment);
      this.fragments.push(fragment);
    } else if (this.fragments.length > 0) {
      const lastFragment = this.fragments[this.fragments.length - 1];
      if (lastFragment.ft === 'content' && lastFragment.part.pt === 'tool_call' && lastFragment.part.call.type === 'function_call') {
        const updatedPart = {
          ...lastFragment.part,
          call: {
            ...lastFragment.part.call,
            args: (lastFragment.part.call.args || '') + particle.i_args,
          },
        };
        this.fragments[this.fragments.length - 1] = { ...lastFragment, part: updatedPart };
        console.log('updated tool call', updatedPart);
      }
    }
  }

  private handleCodeCallParticle(particle: Extract<AixWire_Particles.ParticleOp, { p: 'code-call' }>): void {
    const fragment = createCodeExecutionContentFragment(
      particle.id,
      particle.code,
      particle.language,
    );
    this.fragments.push(fragment);
  }

  private handleCodeResponseParticle(particle: Extract<AixWire_Particles.ParticleOp, { p: 'code-response' }>): void {
    const fragment = createCodeExecutionResponseContentFragment(
      particle.id,
      particle.output,
      undefined,
      particle.error,
    );
    this.fragments.push(fragment);
  }

  private handleIssue(issueText: string): void {
    if (this.currentTextFragment && isTextPart(this.currentTextFragment.part)) {
      this.currentTextFragment = specialShallowReplaceTextContentFragment(
        this.currentTextFragment,
        this.currentTextFragment.part.text + ` [ISSUE: ${issueText}]`,
      );
    } else {
      this.fragments.push(createErrorContentFragment(issueText));
    }
  }

  getReassembledFragments(): DMessageFragment[] {
    return this.fragments;
  }

  reset(): void {
    this.fragments = [];
    this.currentTextFragment = null;
  }
}
