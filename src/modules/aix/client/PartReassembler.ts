import { create_CodeExecutionInvocation_ContentFragment, create_CodeExecutionResponse_ContentFragment, create_FunctionCallInvocation_ContentFragment, createErrorContentFragment, createTextContentFragment, DMessageContentFragment, isTextPart } from '~/common/stores/chat/chat.fragments';

import type { AixWire_Particles } from '../server/api/aix.wiretypes';


// hackey?: global to be accessed by the UI
export let devMode_AixLastDispatchRequest: { url: string, headers: string, body: string, particles: string[] } | null = null;


export class PartReassembler {
  private fragments: DMessageContentFragment[] = [];
  private currentTextFragmentIndex: number | null = null;

  constructor() {
    devMode_AixLastDispatchRequest = null;
  }

  reassembleParticle(op: AixWire_Particles.ChatGenerateOp): void {
    let isDebug = false;
    switch (true) {
      // TextParticleOp
      case 't' in op:
        this.onAppendText(op);
        break;

      // PartParticleOp
      case 'p' in op:
        switch (op.p) {
          case 'fci':
            this.onStartFunctionCallInvocation(op);
            break;
          case '_fci':
            this.onAppendFunctionCallInvocationArgs(op);
            break;
          case 'cei':
            this.onAddCodeExecutionInvocation(op);
            break;
          case 'cer':
            this.onAddCodeExecutionResponse(op);
            break;
          default:
            this.fragments.push(createErrorContentFragment(`PartReassembler: unexpected PartParticleOp: ${JSON.stringify(op)}`));
        }
        break;

      // ChatGenerateOp<{cg: string}>
      case 'cg' in op:
        switch (op.cg) {
          case 'issue':
            this.onIssue(op);
            break;

          case 'end':
          case 'set-model':
          case 'update-counts':
            // handled outside
            break;

          default:
            this.fragments.push(createErrorContentFragment(`PartReassembler: unexpected ChatGenerateOp: ${JSON.stringify(op)}`));
        }
        break;

      // Debug:
      case '_debug' in op:
        isDebug = true;
        if (op._debug === 'request')
          devMode_AixLastDispatchRequest = { ...op.request, particles: [] };
        break;

      default:
        this.fragments.push(createErrorContentFragment(`PartReassembler: unexpected particle: ${JSON.stringify(op)}`));
    }

    // [DEV] Debugging
    if (!isDebug && devMode_AixLastDispatchRequest?.particles)
      devMode_AixLastDispatchRequest.particles.push(JSON.stringify(op));
  }


  // Appends the text to the open text part, or creates a new one if none is open
  private onAppendText(particle: AixWire_Particles.TextParticleOp): void {

    // add to existing TextContentFragment
    const currentTextFragment = this.currentTextFragmentIndex !== null ? this.fragments[this.currentTextFragmentIndex] : null;
    if (currentTextFragment && isTextPart(currentTextFragment.part)) {
      currentTextFragment.part.text += particle.t;
      return;
    }

    // new TextContentFragment
    const newTextFragment = createTextContentFragment(particle.t);
    this.fragments.push(newTextFragment);
    this.currentTextFragmentIndex = this.fragments.length - 1;
  }

  private onStartFunctionCallInvocation(fci: Extract<AixWire_Particles.PartParticleOp, { p: 'fci' }>): void {
    // Break text accumulation
    this.currentTextFragmentIndex = null;
    // Start FC accumulation
    const fragment = create_FunctionCallInvocation_ContentFragment(
      fci.id,
      fci.name,
      fci.i_args || null,
    );
    // TODO: add _description from the Spec
    // TODO: add _args_schema from the Spec
    this.fragments.push(fragment);
  }

  private onAppendFunctionCallInvocationArgs(_fci: Extract<AixWire_Particles.PartParticleOp, { p: '_fci' }>): void {
    const fragment = this.fragments[this.fragments.length - 1];
    if (fragment && fragment.part.pt === 'tool_invocation' && fragment.part.invocation.type === 'function_call') {
      const updatedPart = {
        ...fragment.part,
        invocation: {
          ...fragment.part.invocation,
          args: (fragment.part.invocation.args || '') + _fci._args,
        },
      };
      this.fragments[this.fragments.length - 1] = { ...fragment, part: updatedPart };
    } else
      this.fragments.push(createErrorContentFragment('PartReassembler: unexpected _fc particle without a preceding function-call'));
  }

  private onAddCodeExecutionInvocation(cei: Extract<AixWire_Particles.PartParticleOp, { p: 'cei' }>): void {
    this.fragments.push(create_CodeExecutionInvocation_ContentFragment(cei.id, cei.language, cei.code, cei.author));
    this.currentTextFragmentIndex = null;
  }

  private onAddCodeExecutionResponse(cer: Extract<AixWire_Particles.PartParticleOp, { p: 'cer' }>): void {
    this.fragments.push(create_CodeExecutionResponse_ContentFragment(cer.id, cer.error, cer.result, cer.executor, cer.environment));
    this.currentTextFragmentIndex = null;
  }

  private onIssue({ issueId, issueText }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'issue' }>): void {
    // NOTE: not sure I like the flow at all here
    // there seem to be some bad conditions when issues are raised while the active part is not text
    const currentTextFragment = this.currentTextFragmentIndex !== null ? this.fragments[this.currentTextFragmentIndex] : null;
    if (currentTextFragment && isTextPart(currentTextFragment.part)) {
      currentTextFragment.part.text += issueText;
      return;
    }
    this.fragments.push(createErrorContentFragment(issueText));
    this.currentTextFragmentIndex = null;
  }

  get reassembedFragments(): DMessageContentFragment[] {
    return this.fragments;
  }

  reset(): void {
    this.fragments = [];
    this.currentTextFragmentIndex = null;
  }
}