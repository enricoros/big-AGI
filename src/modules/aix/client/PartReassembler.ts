import { createCodeExecutionContentFragment, createCodeExecutionResponseContentFragment, createErrorContentFragment, createTextContentFragment, createToolCallContentFragment, DMessageContentFragment, isTextPart, specialShallowReplaceTextContentFragment } from '~/common/stores/chat/chat.fragments';

import type { AixWire_Particles } from '../server/api/aix.wiretypes';

export class PartReassembler {
  private fragments: DMessageContentFragment[] = [];
  private currentTextFragmentIndex: number | null = null;

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
    if (this.currentTextFragmentIndex === null || !isTextPart(this.fragments[this.currentTextFragmentIndex].part)) {
      const newTextFragment = createTextContentFragment(particle.t);
      this.fragments.push(newTextFragment);
      this.currentTextFragmentIndex = this.fragments.length - 1;
    } else {
      const currentFragment = this.fragments[this.currentTextFragmentIndex];
      const updatedFragment = specialShallowReplaceTextContentFragment(
        currentFragment,
        currentFragment.part.text + particle.t,
      );
      this.fragments[this.currentTextFragmentIndex] = updatedFragment;
    }
  }

  private handleFunctionCallParticle(particle: Extract<AixWire_Particles.ParticleOp, { p: 'function-call' | 'fc_' }>): void {
    if (particle.p === 'function-call') {
      const fragment = createToolCallContentFragment(
        particle.id,
        particle.name,
        particle.i_args || null,
      );
      this.fragments.push(fragment);
      this.currentTextFragmentIndex = null;
    } else if (this.fragments.length > 0) {
      const lastFragment = this.fragments[this.fragments.length - 1];
      if (lastFragment.part.pt === 'tool_call' && lastFragment.part.call.type === 'function_call') {
        const updatedPart = {
          ...lastFragment.part,
          call: {
            ...lastFragment.part.call,
            args: (lastFragment.part.call.args || '') + particle.i_args,
          },
        };
        this.fragments[this.fragments.length - 1] = { ...lastFragment, part: updatedPart };
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
    this.currentTextFragmentIndex = null;
  }

  private handleCodeResponseParticle(particle: Extract<AixWire_Particles.ParticleOp, { p: 'code-response' }>): void {
    const fragment = createCodeExecutionResponseContentFragment(
      particle.id,
      particle.output,
      undefined,
      particle.error,
    );
    this.fragments.push(fragment);
    this.currentTextFragmentIndex = null;
  }

  private handleIssue(issueText: string): void {
    if (this.currentTextFragmentIndex !== null && isTextPart(this.fragments[this.currentTextFragmentIndex].part)) {
      const currentFragment = this.fragments[this.currentTextFragmentIndex];
      const updatedFragment = specialShallowReplaceTextContentFragment(
        currentFragment,
        currentFragment.part.text + ` [ISSUE: ${issueText}]`,
      );
      this.fragments[this.currentTextFragmentIndex] = updatedFragment;
    } else {
      this.fragments.push(createErrorContentFragment(issueText));
      this.currentTextFragmentIndex = null;
    }
  }

  getReassembledFragments(): DMessageContentFragment[] {
    return this.fragments;
  }

  reset(): void {
    this.fragments = [];
    this.currentTextFragmentIndex = null;
  }
}