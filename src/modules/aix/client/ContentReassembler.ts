import { addDBImageAsset } from '~/common/stores/blob/dblobs-portability';

import type { MaybePromise } from '~/common/types/useful.types';
import { DEFAULT_ADRAFT_IMAGE_MIMETYPE } from '~/common/attachment-drafts/attachment.pipeline';
import { convert_Base64WithMimeType_To_Blob } from '~/common/util/blobUtils';
import { create_CodeExecutionInvocation_ContentFragment, create_CodeExecutionResponse_ContentFragment, create_FunctionCallInvocation_ContentFragment, createAnnotationsVoidFragment, createDMessageDataRefDBlob, createDVoidWebCitation, createErrorContentFragment, createImageContentFragment, createModelAuxVoidFragment, createTextContentFragment, DVoidModelAuxPart, isContentFragment, isModelAuxPart, isTextContentFragment, isVoidAnnotationsFragment, isVoidFragment } from '~/common/stores/chat/chat.fragments';
import { ellipsizeMiddle } from '~/common/util/textUtils';
import { imageBlobTransform } from '~/common/util/imageUtils';
import { metricsFinishChatGenerateLg, metricsPendChatGenerateLg } from '~/common/stores/metrics/metrics.chatgenerate';
import { presentErrorToHumans } from '~/common/util/errorUtils';

import type { AixWire_Particles } from '../server/api/aix.wiretypes';

import type { AixClientDebugger, AixFrameId } from './debugger/memstore-aix-client-debugger';
import { aixClientDebugger_completeFrame, aixClientDebugger_init, aixClientDebugger_recordParticleReceived, aixClientDebugger_setProfilerMeasurements, aixClientDebugger_setRequest } from './debugger/reassembler-debug';

import { AixChatGenerateContent_LL, DEBUG_PARTICLES } from './aix.client';


// configuration
const GENERATED_IMAGES_CONVERT_TO_COMPRESSED = true; // converts PNG to WebP or JPEG to save IndexedDB space
const GENERATED_IMAGES_COMPRESSION_QUALITY = 0.98;
const ELLIPSIZE_DEV_ISSUE_MESSAGES = 4096;
const MERGE_ISSUES_INTO_TEXT_PART_IF_OPEN = true;
const DEBUG_LOG_PROFILER_ON_CLIENT = false; // print Profiling particles when they come in, otherwise ignore them


/**
 * Reassembles the content fragments and more information from the Aix ChatGenerate Particles.
 */
export class ContentReassembler {

  // constructor
  private readonly debuggerFrameId: AixFrameId | null;

  // processing mechanics
  private readonly wireParticlesBacklog: AixWire_Particles.ChatGenerateOp[] = [];
  private isProcessing = false;
  private processingPromise = Promise.resolve();
  private hadErrorInWireReassembly = false;

  // reassembly state (plus the ext. accumulator)
  private currentTextFragmentIndex: number | null = null;


  constructor(
    private readonly accumulator: AixChatGenerateContent_LL,
    private readonly onAccumulatorUpdated?: () => MaybePromise<void>,
    enableDebugContext?: AixClientDebugger.Context,
    private readonly wireAbortSignal?: AbortSignal,
  ) {

    // [SUDO] Debugging the request, last-write-wins for the global (displayed in the UI)
    this.debuggerFrameId = !enableDebugContext ? null : aixClientDebugger_init(enableDebugContext);

  }


  // PUBLIC: wire queueing and processing

  enqueueWireParticle(op: AixWire_Particles.ChatGenerateOp): void {
    if (this.#wireIsAborted) {
      // console.log('Dropped particle due to abort:', op);
      return;
    }

    this.wireParticlesBacklog.push(op);

    // -> debugger, if active (ans skip the header particle)
    if (this.debuggerFrameId && !('cg' in op && op.cg === '_debugDispatchRequest'))
      aixClientDebugger_recordParticleReceived(this.debuggerFrameId, op, this.#wireIsAborted);

    this.#continueWireBacklogProcessing();
  }

  async waitForWireComplete(): Promise<void> {
    return this.processingPromise;
  }


  finalizeAccumulator(): void {

    // Perform all the latest operations
    const hasAborted = !!this.accumulator.genTokenStopReason;
    metricsFinishChatGenerateLg(this.accumulator.genMetricsLg, hasAborted);

    // [SUDO] Debugging, finalize the frame
    if (this.debuggerFrameId)
      aixClientDebugger_completeFrame(this.debuggerFrameId);

  }


  async setClientAborted(): Promise<void> {
    if (DEBUG_PARTICLES)
      console.log('-> aix.p: abort-client');

    // NOTE: this doens't go to the debugger anymore - as we only publish external particles to the debugger
    await this.#reassembleParticle({ cg: 'end', reason: 'abort-client', tokenStopReason: 'client-abort-signal' });
  }

  async setClientExcepted(errorAsText: string): Promise<void> {
    if (DEBUG_PARTICLES)
      console.log('-> aix.p: issue:', errorAsText);

    this.onCGIssue({ cg: 'issue', issueId: 'client-read', issueText: errorAsText });

    // NOTE: this doens't go to the debugger anymore - as we only publish external particles to the debugger
    await this.#reassembleParticle({ cg: 'end', reason: 'issue-rpc', tokenStopReason: 'cg-issue' });
  }


  // processing - internal

  #continueWireBacklogProcessing(): void {
    // require work
    if (this.isProcessing || !this.#hasBacklog) return;
    // require not external abort
    if (this.#wireIsAborted) return;
    // require not former processing errors
    if (this.hadErrorInWireReassembly) return;

    this.isProcessing = true;

    // schedule processing as a promise chain
    // Key insight: the .then modifies the processingPromise in place, so we can chain it
    this.processingPromise = this.processingPromise.then(() => this.#processWireBacklog());

    // NOTE: we let errors propagate to the caller, as here we're too down deep to handle them
    // .catch((error) => console.error('ContentReassembler: processing error', error));
  }

  async #processWireBacklog(): Promise<void> {
    // try...finally does not stop the error propagation (grat because we handle errors in the caller)
    // but allows this to continue processing the backlog
    try {

      while (this.#hasBacklog && !this.#wireIsAborted) {

        // worker function, may be sync or async
        const particle = this.wireParticlesBacklog.shift()!;
        await this.#reassembleParticle(particle);

        // signal all updates
        await this.onAccumulatorUpdated?.();

      }

    } catch (error) {

      // ERROR CATCHING - LIKE the _aixChatGenerateContent_LL which doesn't intercept this somehow
      // NEW METHOD: shows Error Fragments on both Reassembly and Callbacks errors
      //
      // - we don't stop processing anymore, as the source may still be pumping particles
      // - we insert an error fragment showing what happened - akin to how _aixChatGenerateContent_LL would do it
      //
      const showAsBold = !!this.accumulator.fragments.length;
      const errorText = (presentErrorToHumans(error, showAsBold, true) || 'Unknown error');
      this._appendReassemblyDevError(`An unexpected issue occurred: ${errorText} Please retry.`, true);
      await this.onAccumulatorUpdated?.()?.catch(console.error);

      // FORMER METHOD - the THROW wasn't caught by the caller

      // mark that we've encountered an error to prevent further scheduling
      // this.hadErrorInWireReassembly = true;
      // this.wireParticlesBacklog.length = 0; // empty the backlog

      // te-throw to propagate to outer catch blocks
      // throw error;

    } finally {

      // continue processing in case there's more to do
      this.isProcessing = false;
      this.#continueWireBacklogProcessing();

    }
  }

  get #hasBacklog(): boolean {
    return this.wireParticlesBacklog.length > 0;
  }

  get #wireIsAborted(): boolean {
    return !!this.wireAbortSignal?.aborted;
  }


  /// Particle Reassembly ///

  async #reassembleParticle(op: AixWire_Particles.ChatGenerateOp): Promise<void> {
    switch (true) {

      // TextParticleOp
      case 't' in op:
        this.onAppendText(op);
        break;

      // PartParticleOp
      case 'p' in op:
        switch (op.p) {
          case '❤':
            // ignore the heartbeats
            break;
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
          case 'ia':
            await this.onAppendInlineAudio(op);
            break;
          case 'ii':
            await this.onAppendInlineImage(op);
            break;
          case 'urlc':
            this.onAddUrlCitation(op);
            break;
          default:
            // noinspection JSUnusedLocalSymbols
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
          case '_debugProfiler':
            if (this.debuggerFrameId)
              aixClientDebugger_setProfilerMeasurements(this.debuggerFrameId, op.measurements);
            // Profiling particles will come in if the app is in "Debug Mode" + it's a Development build!
            // Additionally to show them on the console (rather than just in the debugger) set the
            // constant to `true`.
            if (DEBUG_LOG_PROFILER_ON_CLIENT) {
              console.warn('[AIX] chatGenerate profiler measurements:');
              console.table(op.measurements);
            }
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
            // noinspection JSUnusedLocalSymbols
            const _exhaustiveCheck: never = op;
            this._appendReassemblyDevError(`unexpected ChatGenerateOp: ${JSON.stringify(op)}`);
        }
        break;

      default:
        // noinspection JSUnusedLocalSymbols
        const _exhaustiveCheck: never = op;
        this._appendReassemblyDevError(`unexpected particle: ${JSON.stringify(op)}`);
    }
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

  private async onAppendInlineAudio(particle: Extract<AixWire_Particles.PartParticleOp, { p: 'ia' }>): Promise<void> {

    // Break text accumulation, as we have a full audio part in the middle
    this.currentTextFragmentIndex = null;

    const { mimeType, a_b64: base64Data, label, generator, durationMs } = particle;
    const safeLabel = label || 'Generated Audio';

    try {

      // create blob and play audio - this will throw on malformed data
      const audioBlob = await convert_Base64WithMimeType_To_Blob(base64Data, mimeType, 'ContentReassembler.onAppendInlineAudio');
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play the audio
      const audio = new Audio(audioUrl);

      // Clean up when audio ends or errors
      const cleanup = () => {
        URL.revokeObjectURL(audioUrl);
        audio.removeEventListener('ended', cleanup);
        audio.removeEventListener('error', cleanup);
        audio.src = ''; // Release audio element reference
      };
      audio.addEventListener('ended', cleanup);
      audio.addEventListener('error', cleanup);

      // Play and handle immediate errors
      audio.play().catch(error => {
        console.warn('[Audio] Failed to play generated audio:', error);
        cleanup();
      });

      // TEMP: show a label instead of adding the model part
      this.accumulator.fragments.push(createTextContentFragment(`Playing ${safeLabel}${durationMs ? ` (${Math.round(durationMs / 10) / 100}s)` : ''}`));

      // Add the audio to the DBlobs DB
      // const dblobAssetId = await addDBAudioAsset('global', 'app-chat', {
      //   label: safeLabel,
      //   data: {
      //     mimeType: mimeType as any,
      //     base64: base64Data,
      //   },
      //   origin: {
      //     ot: 'generated',
      //     source: 'ai-text-to-speech',
      //     generatorName: generator ?? '',
      //     prompt: '', // Audio doesn't have a prompt in this context
      //     parameters: {},
      //     generatedAt: new Date().toISOString(),
      //   },
      //   metadata: {
      //     durationMs: durationMs || 0,
      //     // Other audio metadata could be added here
      //   },
      // });

      // Create DMessage data reference for the audio
      // const bytesSizeApprox = Math.ceil((base64Data.length * 3) / 4);
      // const audioAssetDataRef = createDMessageDataRefDBlob(
      //   dblobAssetId,
      //   particle.mimeType,
      //   bytesSizeApprox,
      // );

      // Create the DMessageContentFragment for audio
      // const audioContentFragment = createAudioContentFragment(
      //   audioAssetDataRef,
      //   safeLabel,
      //   durationMs,
      // );

      // this.accumulator.fragments.push(audioContentFragment);

    } catch (error: any) {
      console.warn('[DEV] Failed to add inline audio to DBlobs:', { label: safeLabel, error, mimeType, size: base64Data.length });
      // Add an error fragment instead
      this.accumulator.fragments.push(createErrorContentFragment(`Failed to process audio: ${error?.message || 'Unknown error'}`));
    }
  }

  private async onAppendInlineImage(particle: Extract<AixWire_Particles.PartParticleOp, { p: 'ii' }>): Promise<void> {

    // Break text accumulation, as we have a full image part in the middle
    this.currentTextFragmentIndex = null;

    let { i_b64: inputBase64, mimeType: inputType, label, generator, prompt } = particle;
    const safeLabel = label || 'Generated Image';

    try {

      // base64 -> blob conversion
      let inputImage = await convert_Base64WithMimeType_To_Blob(inputBase64, inputType, 'ContentReassembler.onAppendInlineImage');

      // perform resize/type conversion if desired, and find the image dimensions
      const shallConvert = GENERATED_IMAGES_CONVERT_TO_COMPRESSED && inputType === 'image/png';
      const { blob: imageBlob, height: imageHeight, width: imageWidth } = await imageBlobTransform(inputImage, {
        convertToMimeType: shallConvert ? DEFAULT_ADRAFT_IMAGE_MIMETYPE : undefined,
        convertToLossyQuality: GENERATED_IMAGES_COMPRESSION_QUALITY,
        throwOnTypeConversionError: true,
        debugConversionLabel: `ContentReassembler(ii)`,
      });

      // add the image to the DBlobs DB
      const dblobAssetId = await addDBImageAsset('app-chat', imageBlob, {
        label: safeLabel,
        metadata: {
          width: imageWidth,
          height: imageHeight,
          // description: '',
        },
        origin: { // Generation originated
          ot: 'generated',
          source: 'ai-text-to-image',
          generatorName: generator ?? '',
          prompt: prompt ?? '',
          parameters: {}, // ?
          generatedAt: new Date().toISOString(),
        },
      });

      // create the DMessage _Content_ Fragment (not attachment), as this comes from the assistant
      // so this is akin to the t2i-generated images
      const imageContentFragment = createImageContentFragment(
        createDMessageDataRefDBlob( // Data Reference {} for the image
          dblobAssetId,
          imageBlob.type,
          imageBlob.size,
        ),
        safeLabel,
        imageWidth || undefined,
        imageHeight || undefined,
      );

      this.accumulator.fragments.push(imageContentFragment);
    } catch (error: any) {
      console.warn('[DEV] Failed to add inline image to DBlobs:', { label, error, inputType, base64Length: inputBase64.length });
    }
  }

  private onAddUrlCitation(urlc: Extract<AixWire_Particles.PartParticleOp, { p: 'urlc' }>): void {

    const { title, url, num: refNumber, from: startIndex, to: endIndex, text: textSnippet, pubTs } = urlc;

    // reuse existing annotations - single fragment per message
    const existingFragment = this.accumulator.fragments.find(isVoidAnnotationsFragment);
    if (existingFragment) {

      // coalesce ranges if there are citations at the same URL
      const sameUrlCitation = existingFragment.part.annotations.find(({ type, url: existingUrl }) => type === 'citation' && url === existingUrl);
      if (!sameUrlCitation) {
        existingFragment.part.annotations = [
          ...existingFragment.part.annotations,
          createDVoidWebCitation(url, title, refNumber, startIndex, endIndex, textSnippet, pubTs),
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
      const newCitation = createDVoidWebCitation(url, title, refNumber, startIndex, endIndex, textSnippet, pubTs);
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
        // noinspection JSUnusedLocalSymbols
        const _exhaustiveCheck: never = tokenStopReason;
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

  private _appendReassemblyDevError(errorText: string, omitPrefix?: boolean): void {
    if (ELLIPSIZE_DEV_ISSUE_MESSAGES) {
      const excess = errorText.length - ELLIPSIZE_DEV_ISSUE_MESSAGES;
      const truncationMessage = `\n\n ... (truncated ${excess?.toLocaleString()} characters) ... \n\n`;
      if (excess > 0)
        errorText = ellipsizeMiddle(errorText, ELLIPSIZE_DEV_ISSUE_MESSAGES - truncationMessage.length, truncationMessage);
    }
    this.accumulator.fragments.push(createErrorContentFragment((omitPrefix ? '' : 'AIX Content Reassembler: ') + errorText));
    this.currentTextFragmentIndex = null;
  }

}