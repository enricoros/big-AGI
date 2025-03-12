import { metricsFinishChatGenerateLg, metricsPendChatGenerateLg } from '~/common/stores/metrics/metrics.chatgenerate';
import { create_CodeExecutionInvocation_ContentFragment, create_CodeExecutionResponse_ContentFragment, create_FunctionCallInvocation_ContentFragment, createAnnotationsVoidFragment, createDVoidWebCitation, createErrorContentFragment, createModelAuxVoidFragment, createTextContentFragment, DVoidModelAuxPart, isContentFragment, isModelAuxPart, isTextContentFragment, isVoidAnnotationsFragment, isVoidFragment } from '~/common/stores/chat/chat.fragments';

import type { AixWire_Particles } from '../server/api/aix.wiretypes';

import type { AixClientDebugger, AixFrameId } from './debugger/memstore-aix-client-debugger';
import { aixClientDebugger_completeFrame, aixClientDebugger_init, aixClientDebugger_recordParticle, aixClientDebugger_setRequest } from './debugger/reassembler-debug';

import { AixChatGenerateContent_LL, DEBUG_PARTICLES } from './aix.client';


// configuration
const MERGE_ISSUES_INTO_TEXT_PART_IF_OPEN = true;


/**
 * Reassembles the content fragments and more information from the Aix ChatGenerate Particles.
 */
export class ContentReassembler {

  private currentTextFragmentIndex: number | null = null;
  private readonly debuggerFrameId: AixFrameId | null = null;

  // private pendingAnnotations: DVoidWebCitation[] = []; // we implemented this as a single fragment per message instead

  constructor(readonly accumulator: AixChatGenerateContent_LL, enableDebugContext?: AixClientDebugger.Context) {

    // [SUDO] Debugging the request, last-write-wins for the global (displayed in the UI)
    this.debuggerFrameId = !enableDebugContext ? null : aixClientDebugger_init(enableDebugContext);

  }

  // reset(): void {
  //   this.accumulator. ... = [];
  //   this.currentTextFragmentIndex = null;
  // }

  reassembleParticle(op: AixWire_Particles.ChatGenerateOp, debugIsAborted: boolean): void {
    if (DEBUG_PARTICLES)
      console.log('-> aix.p:', op);
    switch (true) {

      // TextParticleOp
      case 't' in op:
        this.onAppendText(op);
        break;

      // PartParticleOp
      case 'p' in op:
        switch (op.p) {
          case 'tr_':
            this.onAppendReasoningText(op);
            break;
          case 'trs':
            this.onSetReasoningSignature(op);
            break;
          case 'trr_':
            this.onAddRedactedDataParcel(op);
            break;
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
          case 'urlc':
            this.onAddUrlCitation(op);
            break;
          default:
            const _exhaustiveCheck: never = op;
            this._appendReassemblyDevError(`unexpected PartParticleOp: ${JSON.stringify(op)}`);
        }
        break;

      // ChatControlOp
      case 'cg' in op:
        switch (op.cg) {
          case '_debugDispatchRequest':
            if (this.debuggerFrameId)
              aixClientDebugger_setRequest(this.debuggerFrameId, op.dispatchRequest);
            break;
          case 'end':
            this.onCGEnd(op);
            break;
          case 'issue':
            this.onCGIssue(op);
            break;
          case 'set-metrics':
            this.onMetrics(op);
            break;
          case 'set-model':
            this.onModelName(op);
            break;
          default:
            const _exhaustiveCheck: never = op;
            this._appendReassemblyDevError(`unexpected ChatGenerateOp: ${JSON.stringify(op)}`);
        }
        break;

      default:
        const _exhaustiveCheck: never = op;
        this._appendReassemblyDevError(`unexpected particle: ${JSON.stringify(op)}`);
    }

    // [DEV] Debugging, skipping the header particle
    if (this.debuggerFrameId && !('cg' in op && op.cg === '_debugDispatchRequest'))
      aixClientDebugger_recordParticle(this.debuggerFrameId, op, debugIsAborted);
  }

  reassembleClientAbort(): void {
    if (DEBUG_PARTICLES)
      console.log('-> aix.p: abort-client');
    this.reassembleParticle({ cg: 'end', reason: 'abort-client', tokenStopReason: 'client-abort-signal' }, true);
  }

  reassembleClientException(errorAsText: string): void {
    if (DEBUG_PARTICLES)
      console.log('-> aix.p: issue:', errorAsText);
    this.onCGIssue({ cg: 'issue', issueId: 'client-read', issueText: errorAsText });
    this.reassembleParticle({ cg: 'end', reason: 'issue-rpc', tokenStopReason: 'cg-issue' }, false);
  }

  reassembleFinalize(): void {

    // Perform all the latest operations
    const hasAborted = !!this.accumulator.genTokenStopReason;
    metricsFinishChatGenerateLg(this.accumulator.genMetricsLg, hasAborted);

    // [SUDO] Debugging, finalize the frame
    if (this.debuggerFrameId)
      aixClientDebugger_completeFrame(this.debuggerFrameId);

  }


  /// Fragments Reassembly ///

  // Appends the text to the open text part, or creates a new one if none is open
  private onAppendText(particle: AixWire_Particles.TextParticleOp): void {

    // add to existing TextContentFragment
    const currentTextFragment = this.currentTextFragmentIndex !== null ? this.accumulator.fragments[this.currentTextFragmentIndex] : null;
    if (currentTextFragment && isTextContentFragment(currentTextFragment)) {
      currentTextFragment.part.text += particle.t;
      return;
    }

    // new TextContentFragment
    const newTextFragment = createTextContentFragment(particle.t);
    this.accumulator.fragments.push(newTextFragment);
    this.currentTextFragmentIndex = this.accumulator.fragments.length - 1;

  }

  private onAppendReasoningText({ _t /*, weak*/ }: Extract<AixWire_Particles.PartParticleOp, { p: 'tr_' }>): void {
    // Break text accumulation
    this.currentTextFragmentIndex = null;

    // append to existing ModelAuxVoidFragment if possible
    const currentFragment = this.accumulator.fragments[this.accumulator.fragments.length - 1];
    if (currentFragment && isVoidFragment(currentFragment) && isModelAuxPart(currentFragment.part)) {
      const appendedPart = { ...currentFragment.part, aText: (currentFragment.part.aText || '') + _t } satisfies DVoidModelAuxPart;
      this.accumulator.fragments[this.accumulator.fragments.length - 1] = { ...currentFragment, part: appendedPart };
      return;
    }

    // new ModelAuxVoidFragment
    const fragment = createModelAuxVoidFragment('reasoning', _t);
    this.accumulator.fragments.push(fragment);
  }

  private onSetReasoningSignature({ signature }: Extract<AixWire_Particles.PartParticleOp, { p: 'trs' }>): void {

    // set to existing ModelAuxVoidFragment if possible
    const currentFragment = this.accumulator.fragments[this.accumulator.fragments.length - 1];
    if (currentFragment && isVoidFragment(currentFragment) && isModelAuxPart(currentFragment.part)) {
      const setPart = { ...currentFragment.part, textSignature: signature } satisfies DVoidModelAuxPart;
      this.accumulator.fragments[this.accumulator.fragments.length - 1] = { ...currentFragment, part: setPart };
      return;
    }

    // if for some reason there's no ModelAuxVoidFragment, create one
    const fragment = createModelAuxVoidFragment('reasoning', '', signature);
    this.accumulator.fragments.push(fragment);
  }

  private onAddRedactedDataParcel({ _data }: Extract<AixWire_Particles.PartParticleOp, { p: 'trr_' }>): void {

    // add to existing ModelAuxVoidFragment if possible
    const currentFragment = this.accumulator.fragments[this.accumulator.fragments.length - 1];
    if (currentFragment && isVoidFragment(currentFragment) && isModelAuxPart(currentFragment.part)) {
      const appendedPart = { ...currentFragment.part, redactedData: [...(currentFragment.part.redactedData || []), _data] } satisfies DVoidModelAuxPart;
      this.accumulator.fragments[this.accumulator.fragments.length - 1] = { ...currentFragment, part: appendedPart };
      return;
    }

    // create a new ModelAuxVoidFragment for redacted thinking
    const fragment = createModelAuxVoidFragment('reasoning', '', undefined, [_data]);
    this.accumulator.fragments.push(fragment);
  }


  private onStartFunctionCallInvocation(fci: Extract<AixWire_Particles.PartParticleOp, { p: 'fci' }>): void {
    // Break text accumulation
    this.currentTextFragmentIndex = null;
    // Start FC accumulation
    const fragment = create_FunctionCallInvocation_ContentFragment(
      fci.id,
      fci.name,
      fci.i_args || '', // if i_args is undefined, use an empty string, which means 'no args' in DParticle/AixTools (for now at least)
    );
    // TODO: add _description from the Spec
    // TODO: add _args_schema from the Spec
    this.accumulator.fragments.push(fragment);
  }

  private onAppendFunctionCallInvocationArgs(_fci: Extract<AixWire_Particles.PartParticleOp, { p: '_fci' }>): void {
    const fragment = this.accumulator.fragments[this.accumulator.fragments.length - 1];
    if (fragment && isContentFragment(fragment) && fragment.part.pt === 'tool_invocation' && fragment.part.invocation.type === 'function_call') {
      const updatedPart = {
        ...fragment.part,
        invocation: {
          ...fragment.part.invocation,
          args: (fragment.part.invocation.args || '') + _fci._args,
        },
      };
      this.accumulator.fragments[this.accumulator.fragments.length - 1] = { ...fragment, part: updatedPart };
    } else
      this._appendReassemblyDevError('unexpected _fc particle without a preceding function-call');
  }

  private onAddCodeExecutionInvocation(cei: Extract<AixWire_Particles.PartParticleOp, { p: 'cei' }>): void {
    this.accumulator.fragments.push(create_CodeExecutionInvocation_ContentFragment(cei.id, cei.language, cei.code, cei.author));
    this.currentTextFragmentIndex = null;
  }

  private onAddCodeExecutionResponse(cer: Extract<AixWire_Particles.PartParticleOp, { p: 'cer' }>): void {
    this.accumulator.fragments.push(create_CodeExecutionResponse_ContentFragment(cer.id, cer.error, cer.result, cer.executor, cer.environment));
    this.currentTextFragmentIndex = null;
  }

  private onAddUrlCitation(urlc: Extract<AixWire_Particles.PartParticleOp, { p: 'urlc' }>): void {

    const { title, url, num: refNumber, from: startIndex, to: endIndex, text: textSnippet } = urlc;

    // reuse existing annotations - single fragment per message
    const existingFragment = this.accumulator.fragments.find(isVoidAnnotationsFragment);
    if (existingFragment) {

      // coalesce ranges if there are citations at the same URL
      const sameUrlCitation = existingFragment.part.annotations.find(({ type, url: existingUrl }) => type === 'citation' && url === existingUrl);
      if (!sameUrlCitation) {
        existingFragment.part.annotations = [
          ...existingFragment.part.annotations,
          createDVoidWebCitation(url, title, refNumber, startIndex, endIndex, textSnippet),
        ];
      } else {
        if (startIndex !== undefined && endIndex !== undefined) {
          sameUrlCitation.ranges = [
            ...sameUrlCitation.ranges,
            { startIndex, endIndex, ...(textSnippet ? { textSnippet } : {}) },
          ];
        }
      }

    } else {

      // create the *only* annotations fragment in the message
      const newCitation = createDVoidWebCitation(url, title, refNumber, startIndex, endIndex, textSnippet);
      this.accumulator.fragments.push(createAnnotationsVoidFragment([newCitation]));

    }

    // Important: Don't reset currentTextFragmentIndex to allow text to continue
    // This ensures we don't interrupt the text flow
  }


  /// Rest of the data ///

  private onCGEnd({ reason: _reason /* Redundant: no information */, tokenStopReason }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'end' }>): void {

    // NOTE: no new info in particle.reason
    // - abort-client: user abort (already captured in the stop reason)
    // - done-*: normal termination (no info)
    // - issue-*: issue (already captured in the 'issue' particle, and stop reason is 'cg-issue')

    // handle the token stop reason
    switch (tokenStopReason) {
      // normal stop
      case 'ok':                    // content
      case 'ok-tool_invocations':   // content + tool invocation
        break;

      case 'client-abort-signal':
        this.accumulator.genTokenStopReason = 'client-abort';
        break;

      case 'out-of-tokens':
        this.accumulator.genTokenStopReason = 'out-of-tokens';
        break;

      case 'cg-issue':              // error fragment already added before
        this.accumulator.genTokenStopReason = 'issue';
        break;

      case 'filter-content':        // inline text message shall have been added
      case 'filter-recitation':     // inline text message shall have been added
        this.accumulator.genTokenStopReason = 'filter';
        break;

      // unexpected
      default:
        this._appendReassemblyDevError(`Unexpected token stop reason: ${tokenStopReason}`);
        break;
    }
  }

  private onCGIssue({ issueId: _issueId /* Redundant as we add an Error Fragment already */, issueText }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'issue' }>): void {
    // NOTE: not sure I like the flow at all here
    // there seem to be some bad conditions when issues are raised while the active part is not text
    if (MERGE_ISSUES_INTO_TEXT_PART_IF_OPEN) {
      const currentTextFragment = this.currentTextFragmentIndex === null ? null
        : this.accumulator.fragments[this.currentTextFragmentIndex];
      if (currentTextFragment && isTextContentFragment(currentTextFragment)) {
        currentTextFragment.part.text += ' ' + issueText;
        return;
      }
    }
    this.accumulator.fragments.push(createErrorContentFragment(issueText));
    this.currentTextFragmentIndex = null;
  }

  private onMetrics({ metrics }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'set-metrics' }>): void {
    // type check point for AixWire_Particles.CGSelectMetrics -> DMetricsChatGenerate_Lg
    this.accumulator.genMetricsLg = metrics;
    metricsPendChatGenerateLg(this.accumulator.genMetricsLg);
  }

  private onModelName({ name }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'set-model' }>): void {
    this.accumulator.genModelName = name;
  }


  // utility

  private _appendReassemblyDevError(errorText: string): void {
    this.accumulator.fragments.push(createErrorContentFragment('ContentReassembler: ' + errorText));
    this.currentTextFragmentIndex = null;
  }

}