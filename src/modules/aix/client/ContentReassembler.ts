import { addDBImageAsset } from '~/common/stores/blob/dblobs-portability';

import type { DMessageGenerator } from '~/common/stores/chat/chat.message';
import type { MaybePromise } from '~/common/types/useful.types';
import { convert_Base64WithMimeType_To_Blob } from '~/common/util/blobUtils';
import { create_CodeExecutionInvocation_ContentFragment, create_CodeExecutionResponse_ContentFragment, create_FunctionCallInvocation_ContentFragment, create_FunctionCallResponse_ContentFragment, createAnnotationsVoidFragment, createDMessageDataRefDBlob, createDVoidWebCitation, createErrorContentFragment, createModelAuxVoidFragment, createPlaceholderVoidFragment, createTextContentFragment, createZyncAssetReferenceContentFragment, DMessageErrorPart, DVoidModelAuxPart, DVoidPlaceholderMOp, isContentFragment, isModelAuxPart, isTextContentFragment, isVoidAnnotationsFragment, isVoidFragment, isVoidPlaceholderFragment } from '~/common/stores/chat/chat.fragments';
import { ellipsizeMiddle } from '~/common/util/textUtils';
import { imageBlobTransform, PLATFORM_IMAGE_MIMETYPE } from '~/common/util/imageUtils';
import { metricsFinishChatGenerateLg, metricsPendChatGenerateLg } from '~/common/stores/metrics/metrics.chatgenerate';
import { nanoidToUuidV4 } from '~/common/util/idUtils';

import type { AixWire_Particles } from '../server/api/aix.wiretypes';

import type { AixClientDebugger, AixFrameId } from './debugger/memstore-aix-client-debugger';
import { aixClientDebugger_completeFrame, aixClientDebugger_init, aixClientDebugger_recordParticleReceived, aixClientDebugger_setProfilerMeasurements, aixClientDebugger_setRequest } from './debugger/reassembler-debug';

import { AixChatGenerateContent_LL, DEBUG_PARTICLES } from './aix.client';
import { aixClassifyReassemblyError } from './aix.client.errors';


// configuration
const DEBUG_FLOW = false; // logs client-side checkpoint/retry/continuation flow control
const GENERATED_IMAGES_CONVERT_TO_COMPRESSED = true; // converts PNG to WebP or JPEG to save IndexedDB space
const GENERATED_IMAGES_COMPRESSION_QUALITY = 0.98;
const ELLIPSIZE_DEV_ISSUE_MESSAGES = 4096; // for _appendReassemblyDevError
const MERGE_ISSUES_INTO_TEXT_PART_IF_OPEN = false; // 2025-10-10: put errors in the dedicated part
const VP_PERSISTENCE_DELAY = 500; // persistence of vision for voidPlaceholders


// Future: Reassembly Policies
// type ReassemblyPolicyVoidPlaceholder =
//   | 'ephemeral-log' // (default) when message content arrives (reasoning, text, tool calls, images, etc..), remove the last VP
//   | 'single-log-end' // move the VP to the end to have a single large log of operations
//   | 'interleaved-log' // batch VP OPs, but interleave them with the other content
//   ;


export function normalizeCGIssueForDisplay(
  issueId: AixWire_Particles.CGIssueId,
  issueText: string,
): { issueText: string; issueHint?: DMessageErrorPart['hint'] } {
  if (
    issueId === 'dispatch-read'
    && /\*\*\[Streaming Issue\][\s\S]*?:\s*Error in input stream\s*$/i.test(issueText.trim())
  ) {
    return {
      issueText: 'An unexpected issue occurred: **connection terminated**.',
      issueHint: 'aix-net-disconnected',
    };
  }

  return {
    issueText,
    issueHint: undefined,
  };
}


/**
 * Extended accumulator - adds reassembly-internal state to the output accumulator so that
 * checkpointing/restore is atomic. The `_`-prefixed fields are internal to ContentReassembler;
 * external code should treat this as AixChatGenerateContent_LL (structural subtype).
 */
type ReassemblerAccumulator = AixChatGenerateContent_LL & {
  /** Cursor: index of the open text fragment for appending, or null if none is open */
  _textFragmentIndex: number | null;

  /** Raw termination data from wire or client-side - classified at finalization */
  _terminationReason: 'done-client-aborted' | 'issue-client-rpc' | AixWire_Particles.CGEndReason | undefined;
  /** Raw token stop reason from the wire `end` particle */
  _tokenStopReasonWire: AixWire_Particles.GCTokenStopReason | undefined;
};

/** Single source of truth for the initial/blank accumulator state - all fields explicit. */
function _createEmptyAccumulatorState(): ReassemblerAccumulator {
  return {
    // AixChatGenerateContent_LL fields
    fragments: [],
    genMetricsLg: undefined,
    genModelName: undefined,
    genProviderInfraLabel: undefined,
    genUpstreamHandle: undefined,
    legacyGenTokenStopReason: undefined,
    // reassembly-internal fields
    _textFragmentIndex: null,
    _terminationReason: undefined,
    _tokenStopReasonWire: undefined,
  };
}


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

  // owned accumulation state - coherent and with checkpointing support
  readonly accumulator: ReassemblerAccumulator = _createEmptyAccumulatorState();
  private checkpointSnapshot: undefined | ReassemblerAccumulator;

  // settable per-iteration callback
  private onAccumulatorUpdated?: (accumulator: AixChatGenerateContent_LL, hasContent: boolean) => MaybePromise<void>;
  private updateContentStarted = false; // true (forever) after the first update with content, even if we have resets/continuations in the future


  constructor(
    inspectorTransport?: AixClientDebugger.Transport,
    inspectorContext?: AixClientDebugger.Context,
    private readonly skipImageCompression?: boolean,
    private readonly wireAbortSignal?: AbortSignal,
    private readonly onInlineAudio?: (audio: { blob: Blob; mimeType: string; label: string; durationMs?: number }) => void,
  ) {

    // [AI Inspector] Debugging the request, last-write-wins for the global (displayed in the UI)
    this.debuggerFrameId = !inspectorContext ? null : aixClientDebugger_init(inspectorTransport ?? 'trpc', inspectorContext);

  }

  set updateCallback(callback: typeof this.onAccumulatorUpdated) {
    this.onAccumulatorUpdated = callback;
  }


  // PUBLIC: wire queueing and processing

  enqueueWireParticle(op: AixWire_Particles.ChatGenerateOp): void {
    if (this.#wireIsAborted) {
      // WARN about dropping particles; note that this should not happen besides CSF 'end' particles,
      //      which are ignored anyways becuse we hande end with the '.throwIfAborted()' outside here
      const isEndParticle = 'cg' in op && op.cg === 'end';
      if (!isEndParticle)
        console.log('⚠️ [ContentReassembler] enqueueWireParticle: received particle after wire abortion, ignoring', op);
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

    // Classify termination
    this.accumulator.legacyGenTokenStopReason = this._deriveTokenStopReason();


    // Fragment finalization heuristics:

    // - remove placeholders for clean exists, leave them for issues or client-aborts
    if (this.accumulator._terminationReason === 'done-dialect')
      this._removeAllVoidPlaceholders(); // [PH-LIFECYCLE]

    // - mark as completed or errored
    for (const fragment of this.accumulator.fragments)
      if (isVoidPlaceholderFragment(fragment) && fragment.part.opLog?.length)
        for (const entry of fragment.part.opLog) {
          if (entry.text?.endsWith('...')) entry.text = entry.text.slice(0, -3);
          if (entry.state === 'active') {
            entry.state = 'error';
            entry.oTexts = [...(entry.oTexts || []), `Terminated with reason: ${this.accumulator._terminationReason ?? 'unknown'}`];
          }
        }

    // - fuse adjacent same-type fragments that were kept separate across continuation turns
    // NOTE: not needed because of precise snapshotting and restoration, and upstream guarantees about completeness of fragments


    // Metrics
    const hadIssues = !!this.accumulator.legacyGenTokenStopReason;
    metricsFinishChatGenerateLg(this.accumulator.genMetricsLg, hadIssues);

    // [AI Inspector] Debugging, finalize the frame
    if (this.debuggerFrameId)
      aixClientDebugger_completeFrame(this.debuggerFrameId);

  }


  setClientAborted(): void {
    if (DEBUG_PARTICLES)
      console.log('-> aix.p: abort-client');

    // normal user cancellation does not require error fragments

    if (this.accumulator._terminationReason)
      console.warn(`⚠️ [ContentReassembler] setClientAborted: overriding server termination '${this.accumulator._terminationReason}' (wire stop: ${this.accumulator._tokenStopReasonWire ?? 'none'})`);

    this.accumulator._terminationReason = 'done-client-aborted';
    this.accumulator._tokenStopReasonWire = undefined; // reset, as we assume we can't know (alt: jsut leave it)
  }

  setClientExcepted(errorAsText: string, errorHint?: DMessageErrorPart['hint']): void {
    if (DEBUG_PARTICLES)
      console.log('-> aix.p: issue:', errorAsText);

    // add the error fragment with the given message
    this._appendErrorFragment(errorAsText, errorHint);

    if (this.accumulator._terminationReason)
      console.warn(`⚠️ [ContentReassembler] setClientExcepted: overriding server termination '${this.accumulator._terminationReason}' (wire stop: ${this.accumulator._tokenStopReasonWire ?? 'none'})`);

    this.accumulator._terminationReason = 'issue-client-rpc';
    this.accumulator._tokenStopReasonWire = undefined; // reset, as we can't assume we know (alt: jsut leave it)
  }

  async setClientRetrying(strategy: 'reconnect' | 'resume', errorMessage: string, attempt: number, maxAttempts: number, delayMs: number, causeHttp?: number, causeConn?: string) {
    if (DEBUG_PARTICLES)
      console.log(`-> aix.p: client-retry (${strategy})`, { errorMessage, attempt, maxAttempts, delayMs, causeHttp, causeConn });

    // process as aix-retry-reset with cli-ll scope
    this.onAixRetryReset({
      cg: 'aix-retry-reset', rScope: 'cli-ll',
      rClearStrategy: strategy === 'reconnect' ? 'all' // client starts from scratch, clear everything
        : 'none', // [resume]: TODO: UNVERIFIED - keep everything assuming the next streaming is incremental (akin to the server-side continuation?)
      reason: strategy === 'resume' ? `Resuming - ${errorMessage}` : `Reconnecting - ${errorMessage}`,
      attempt, maxAttempts, delayMs, causeHttp, causeConn,
    });
  }


  // processing - internal

  #continueWireBacklogProcessing(): void {
    // require work
    if (this.isProcessing || !this.#hasBacklog) return;
    // require not external abort
    if (this.#wireIsAborted) return;

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
        await this.onAccumulatorUpdated?.(this.accumulator, this.updateContentStarted ||= this.accumulator.fragments.length > 0);

      }

    } catch (error) {

      //
      // Classify and display processing errors (particle/async work failures)
      //
      // NOTE: we cannot throw here as we are part of a detached promise chain
      // READ the `aixClassifyReassemblyError` that explains this in detail
      //
      const showAsBold = !!this.accumulator.fragments.length;
      const { errorMessage } = aixClassifyReassemblyError(error, showAsBold);

      this._appendReassemblyDevError(errorMessage, true);
      await this.onAccumulatorUpdated?.(this.accumulator, this.updateContentStarted ||= true)?.catch(console.error);

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
        await this._removeLastVoidPlaceholderDelayed();
        this.onAppendText(op);
        break;

      // PartParticleOp
      case 'p' in op:
        // heuristics to remove the placeholder if real user-destined content arrives
        if (op.p !== '❤' && op.p !== 'vp' && op.p !== 'urlc' && op.p !== 'svs')
          await this._removeLastVoidPlaceholderDelayed();
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
          case 'fcr':
            this.onAddFunctionCallResponse(op);
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
          case 'svs':
            this.onSetVendorState(op);
            break;
          case 'urlc':
            this.onAddUrlCitation(op);
            break;
          case 'vp':
            this.onSetOperationState(op);
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
            break;
          case 'end':
            this.onCGEnd(op);
            break;
          case 'issue':
            this.onCGIssue(op);
            break;
          case 'aix-info':
            if (op.ait === 'flow-cont') {
              // break text accumulation - to reflect upstream's clean breaks of content blocks
              this.accumulator._textFragmentIndex = null;
              // Continuation checkpoint: create a snapshot now
              this.checkpointSnapshot = structuredClone(this.accumulator);
              if (DEBUG_FLOW) console.log(`[DEV] [flow] checkpoint created: ${this.accumulator.fragments.length} fragments snapshotted`);
            } else
              await this._removeLastVoidPlaceholderDelayed();
            this.onAixInfo(op); // creates a voidPlaceholder
            break;
          case 'aix-retry-reset':
            await this._removeLastVoidPlaceholderDelayed();
            this.onAixRetryReset(op); // creates a voidPlaceholder
            break;
          case 'set-metrics':
            this.onMetrics(op);
            break;
          case 'set-model':
            this.onModelName(op);
            break;
          case 'set-provider-infra':
            this.onProviderInfra(op);
            break;
          case 'set-upstream-handle':
            this.onResponseHandle(op);
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
    const currentTextFragment = this.accumulator._textFragmentIndex !== null ? this.accumulator.fragments[this.accumulator._textFragmentIndex] : null;
    if (currentTextFragment && isTextContentFragment(currentTextFragment)) {
      currentTextFragment.part.text += particle.t;
      return;
    }

    // new TextContentFragment
    const newTextFragment = createTextContentFragment(particle.t);
    this.accumulator.fragments.push(newTextFragment);
    this.accumulator._textFragmentIndex = this.accumulator.fragments.length - 1;

  }

  private onAppendReasoningText({ _t, restart }: Extract<AixWire_Particles.PartParticleOp, { p: 'tr_' }>): void {
    // Break text accumulation
    this.accumulator._textFragmentIndex = null;

    // append to existing ModelAuxVoidFragment if possible
    const currentFragment = this.accumulator.fragments[this.accumulator.fragments.length - 1];
    if (!restart && currentFragment && isVoidFragment(currentFragment) && isModelAuxPart(currentFragment.part)) {
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
    this.accumulator._textFragmentIndex = null;
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
    this.accumulator._textFragmentIndex = null;
  }

  private onAddFunctionCallResponse(fcr: Extract<AixWire_Particles.PartParticleOp, { p: 'fcr' }>): void {
    this.accumulator.fragments.push(create_FunctionCallResponse_ContentFragment(fcr.id, fcr.error, fcr.name, fcr.result, fcr.environment));
    this.accumulator._textFragmentIndex = null;
  }

  private onAddCodeExecutionResponse(cer: Extract<AixWire_Particles.PartParticleOp, { p: 'cer' }>): void {
    this.accumulator.fragments.push(create_CodeExecutionResponse_ContentFragment(cer.id, cer.error, cer.result, cer.executor, cer.environment));
    this.accumulator._textFragmentIndex = null;
  }

  private async onAppendInlineAudio(particle: Extract<AixWire_Particles.PartParticleOp, { p: 'ia' }>): Promise<void> {

    // Break text accumulation, as we have a full audio part in the middle
    this.accumulator._textFragmentIndex = null;

    const { mimeType, a_b64: base64Data, label, /*generator,*/ durationMs } = particle;
    const safeLabel = label || 'Generated Audio';

    try {

      // create blob from base64 - this will throw on malformed data
      const audioBlob = await convert_Base64WithMimeType_To_Blob(base64Data, mimeType, 'ContentReassembler.onAppendInlineAudio');

      // show a label in the message (audio fragment persistence deferred to future work)
      this.accumulator.fragments.push(createTextContentFragment(`Generated audio ▶ \`${safeLabel}\`${durationMs ? ` (${Math.round(durationMs / 10) / 100}s)` : ''}`));

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

      // notify caller for NorthBridge-coordinated playback
      this.onInlineAudio?.({ blob: audioBlob, mimeType, label: safeLabel, durationMs });

    } catch (error: any) {
      console.warn('[DEV] Failed to add inline audio to DBlobs:', { label: safeLabel, error, mimeType, size: base64Data.length });
      // Add an error fragment instead
      this._appendErrorFragment(`Failed to process audio: ${error?.message || 'Unknown error'}`, 'aix-audio-processing');
    }
  }

  private async onAppendInlineImage(particle: Extract<AixWire_Particles.PartParticleOp, { p: 'ii' }>): Promise<void> {

    // Break text accumulation, as we have a full image part in the middle
    this.accumulator._textFragmentIndex = null;

    let { i_b64: inputBase64, mimeType: inputType, label, generator, prompt, hintSkipResize } = particle;
    const safeLabel = label || 'Generated Image';

    try {

      // base64 -> blob conversion
      let inputImage = await convert_Base64WithMimeType_To_Blob(inputBase64, inputType, 'ContentReassembler.onAppendInlineImage');

      // perform resize/type conversion if desired, and find the image dimensions
      const shallConvert = GENERATED_IMAGES_CONVERT_TO_COMPRESSED && !this.skipImageCompression && !hintSkipResize && inputType === 'image/png';
      const { blob: imageBlob, height: imageHeight, width: imageWidth } = await imageBlobTransform(inputImage, {
        convertToMimeType: shallConvert ? PLATFORM_IMAGE_MIMETYPE : undefined,
        convertToLossyQuality: GENERATED_IMAGES_COMPRESSION_QUALITY,
        throwOnTypeConversionError: true,
        debugConversionLabel: `ContentReassembler(ii)`,
      });

      // add the image to the DBlobs DB
      // FIXME: [ASSET] use the Asset Store
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

      // Create a Zync Image Asset Reference *Content* fragment, as this is image content from the LLM
      const zyncImageAssetFragmentWithLegacy = createZyncAssetReferenceContentFragment(
        nanoidToUuidV4(dblobAssetId, 'convert-dblob-to-dasset'),
        prompt || safeLabel, // use prompt if available, otherwise use the label
        'image',
        {
          pt: 'image_ref' as const,
          dataRef: createDMessageDataRefDBlob(dblobAssetId, imageBlob.type, imageBlob.size),
          ...(safeLabel ? { altText: safeLabel } : {}),
          ...(imageWidth ? { width: imageWidth } : {}),
          ...(imageHeight ? { height: imageHeight } : {}),
        },
      );

      this.accumulator.fragments.push(zyncImageAssetFragmentWithLegacy);
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

    // Important: Don't reset _textFragmentIndex to allow text to continue
    // This ensures we don't interrupt the text flow
  }

  private onSetOperationState(os: Extract<AixWire_Particles.PartParticleOp, { p: 'vp' }>): void {

    // This operation does not require removal of existing VoidPlaceholder fragments, as it recycles the last one if any

    // destructure
    const { text, mot, opId, state, parentOpId, iTexts, oTexts } = os;

    const existingPh = this.accumulator.fragments.findLast(isVoidPlaceholderFragment);
    if (!existingPh) {

      // New placeholder with initial opLog entry (root level = 0)
      this.accumulator.fragments.push(createPlaceholderVoidFragment(text, undefined, undefined, [{
        opId,
        text,
        mot,
        state: state ?? 'active',
        ...iTexts ? { iTexts } : undefined,
        ...oTexts ? { oTexts } : undefined,
        ...parentOpId ? { parentOpId } : undefined,
        level: 0,
        cts: Date.now(),
      }]));

      // Placeholders don't affect text fragment indexing (push to end doesn't shift existing indices)
      // NOTE: we could have placeholders breaking text accumulation into new fragments with `this.accumulator._textFragmentIndex = null;`, however
      // since placeholders are used a lot with hosted tool calls, this could lead to way too many fragments being created
      return;
    }

    // Accumulate into existing placeholder
    const part = existingPh.part;

    // Takeover: operations supersede other placeholder types
    delete part.pType;
    delete part.aixControl;

    // mutable cast: accumulator fragments are not from an immutable store
    const opLog = (part.opLog ?? (part.opLog = [])) as DVoidPlaceholderMOp[];

    // existing opId in opLog
    const entry = opLog.find(e => e.opId === opId);
    if (entry) {
      // update existing operation in place
      if (text) entry.text = text;
      if (state) entry.state = state;
      if (iTexts) entry.iTexts = iTexts;
      if (oTexts) entry.oTexts = oTexts;
    } else {
      // append new operation - infer level from parent's level (or 0)
      const level = !parentOpId ? 0 : 1 + (opLog.find(e => e.opId === parentOpId)?.level ?? 0);
      opLog.push({
        opId,
        mot,
        text,
        state: state ?? 'active',
        ...iTexts ? { iTexts } : undefined,
        ...oTexts ? { oTexts } : undefined,
        ...parentOpId ? { parentOpId } : undefined,
        level,
        cts: Date.now(),
      });
    }

    // Top-level pText reflects latest active (or last if all done)
    const latest = opLog.findLast(e => e.state === 'active') ?? opLog[opLog.length - 1];
    part.pText = latest.text;

  }

  private onSetVendorState(vs: Extract<AixWire_Particles.PartParticleOp, { p: 'svs' }>): void {
    // apply vendor state to the last created fragment
    const lastFragment = this.accumulator.fragments[this.accumulator.fragments.length - 1];
    if (!lastFragment) {
      console.warn('[ContentReassembler] Vendor state particle without preceding content fragment');
      return;
    }

    // attach vendor state
    const { vendor, state } = vs;
    lastFragment.vendorState = {
      ...lastFragment.vendorState,
      [vendor]: state,
    };
  }

  private _removeAllVoidPlaceholders(): void {
    const fragments = this.accumulator.fragments;
    for (let i = fragments.length - 1; i >= 0; i--)
      if (isVoidPlaceholderFragment(fragments[i])) {
        fragments.splice(i, 1);
        if (this.accumulator._textFragmentIndex !== null && this.accumulator._textFragmentIndex > i)
          this.accumulator._textFragmentIndex--;
      }
  }

  private async _removeLastVoidPlaceholderDelayed(): Promise<boolean> {
    const fragments = this.accumulator.fragments;
    const idx = fragments.findLastIndex(isVoidPlaceholderFragment);
    if (idx < 0) return false;
    // delay before removal
    await new Promise(resolve => setTimeout(resolve, VP_PERSISTENCE_DELAY));
    fragments.splice(idx, 1);
    if (this.accumulator._textFragmentIndex !== null && this.accumulator._textFragmentIndex > idx)
      this.accumulator._textFragmentIndex--;
    return true;
  }

  // private removeLastVoidPlaceholder(): boolean {
  //   const fragments = this.accumulator.fragments;
  //   const idx = fragments.findLastIndex(isVoidPlaceholderFragment);
  //   if (idx < 0) return false;
  //   fragments.splice(idx, 1);
  //   if (this.accumulator._textFragmentIndex !== null && this.accumulator._textFragmentIndex > idx)
  //     this.accumulator._textFragmentIndex--;
  //   return true;
  // }


  /// Rest of the data ///

  /**
   * Stores raw termination data from the wire - classification deferred to finalizeAccumulator()
   */
  private onCGEnd({ terminationReason, tokenStopReason }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'end' }>): void {
    this.accumulator._terminationReason = terminationReason;
    this.accumulator._tokenStopReasonWire = tokenStopReason;
  }

  /**
   * Cross-references both raw termination inputs to derive the DMessage-level tokenStopReason.
   * Called once at finalization - the single place where wire-level → UI-level classification happens.
   */
  private _deriveTokenStopReason(): DMessageGenerator['tokenStopReason'] | undefined {
    const wire = this.accumulator._tokenStopReasonWire;

    // First handle client terminations
    if (this.accumulator._terminationReason === 'done-client-aborted')
      return 'client-abort'; // client-side abort is a 'successful' termination with an incomplete message
    if (this.accumulator._terminationReason === 'issue-client-rpc') {
      // error fragment already appended
      // issue on the client-side, such as interrupted server connection
      return 'issue';
    }

    // if the dialect parser explicitly set a stop reason, map it to the DMessageGenerator tokenStopReason enum
    if (wire) {
      const mapAixStopToDmessageGeneratorStop: Record<AixWire_Particles.GCTokenStopReason, DMessageGenerator['tokenStopReason'] | undefined> = {
        // normal completions
        'ok': undefined,
        'ok-tool_invocations': undefined,
        'ok-pause_continue': undefined,
        // issues: dialect, dispatch, or client
        'cg-issue': 'issue',
        // interruptions
        'out-of-tokens': 'out-of-tokens',
        'filter-content': 'filter',
        'filter-recitation': 'filter',
        'filter-refusal': 'filter',
      } as const;
      if (wire in mapAixStopToDmessageGeneratorStop)
        return mapAixStopToDmessageGeneratorStop[wire];
      console.warn(`[ContentReassembler] Unmapped tokenStopReason from wire: ${wire}. Fallling back to terminationReason.`);
    }

    // fall back to terminationReason
    switch (this.accumulator._terminationReason) {
      case undefined:
        // SEVERE - AIX BUG: don't even know why we terminated
        console.warn(`⚠️ [ContentReassembler] finished without 'terminationReason' - possible missing 'end' particle. No tokenStopReason can be derived.`);
        this._appendErrorFragment('Message may be incomplete: missing completion signal.');
        return undefined;

      case 'done-dialect':
        // Normal completions: we DO expect a tokenStopReason
        console.warn(`⚠️ [ContentReassembler] termination by dialect without 'tokenStopReason' - possible dialect parser issue. assuming ok`);
        this._appendErrorFragment('Message may be incomplete: missing finish reason.');
        return undefined;

      case 'done-dispatch-closed':
        // Stream EOF before completion - provider closed the connection without sending a termination signal
        console.warn(`⚠️ [ContentReassembler] done-dispatch-closed without tokenStopReason - possible truncation`);
        this._appendErrorFragment('Message may be truncated: stream ended before completion.');
        return 'issue';

      case 'done-dispatch-aborted':
        // Dispatch connection may have been severed
        console.warn(`⚠️ [ContentReassembler] done-dispatch-aborted - stream was aborted, likely due to connection issues. assuming client abort.`);
        this._appendErrorFragment('Message may be incomplete: AI provider stream was aborted, likely due to connection issues.');
        return 'client-abort';

      case 'issue-dialect':
      case 'issue-dispatch-rpc':
        // error messages already added
        return 'issue';

      default:
        const _exhaustiveCheck: never = this.accumulator._terminationReason;
        console.warn(`⚠️ [ContentReassembler] unmapped termination reason: ${this.accumulator._terminationReason} - no tokenStopReason can be derived.`);
        return undefined;
    }
  }

  private onCGIssue({ issueId, issueText, issueHint }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'issue' }> & { issueHint?: DMessageErrorPart['hint'] }): void {
    const normalizedIssue = normalizeCGIssueForDisplay(issueId, issueText);
    // NOTE: not sure I like the flow at all here
    // there seem to be some bad conditions when issues are raised while the active part is not text
    if (MERGE_ISSUES_INTO_TEXT_PART_IF_OPEN) {
      const currentTextFragment = this.accumulator._textFragmentIndex === null ? null
        : this.accumulator.fragments[this.accumulator._textFragmentIndex];
      if (currentTextFragment && isTextContentFragment(currentTextFragment)) {
        currentTextFragment.part.text += (currentTextFragment.part.text ? '\n' : ' ') + normalizedIssue.issueText;
        return;
      }
    }
    this._appendErrorFragment(normalizedIssue.issueText, normalizedIssue.issueHint ?? issueHint);
  }

  private onAixInfo({ ait, text }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'aix-info' }>): void {
    // -> ph: show info
    this.accumulator.fragments.push(createPlaceholderVoidFragment(text, undefined, {
      ctl: 'ac-info',
      ait: ait,
    }));
  }

  private onAixRetryReset({ rScope, rClearStrategy, attempt, maxAttempts, delayMs, reason, causeHttp, causeConn }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'aix-retry-reset' }>): void {
    const _prevFragments = DEBUG_FLOW ? this.accumulator.fragments.length : 0;
    switch (rClearStrategy) {
      case 'none':
        // keep everything (e.g. L1 connection retries - no content streamed yet)
        if (DEBUG_FLOW) console.log(`[DEV] [flow] retry-reset ${rScope}: none (keeping ${_prevFragments} fragments) - ${reason}`);
        break;

      case 'since-checkpoint':
        // atomic restore to checkpoint
        if (!this.checkpointSnapshot)
          console.warn('[ContentReassembler] since-checkpoint restore with no checkpoint - falling back to full clear');
        Object.assign(this.accumulator, structuredClone(this.checkpointSnapshot) ?? _createEmptyAccumulatorState());
        this.wireParticlesBacklog.length = 0; // should have been drained/completed already
        if (DEBUG_FLOW) console.log(`[DEV] [flow] retry-reset ${rScope}: since-checkpoint (${_prevFragments} -> ${this.accumulator.fragments.length} fragments) - ${reason}`);
        break;

      case 'all':
        // full wipe for reconnect scenarios (L4 client reconnect)
        Object.assign(this.accumulator, _createEmptyAccumulatorState());
        this.checkpointSnapshot = undefined;
        this.wireParticlesBacklog.length = 0; // should have been drained/completed already
        if (DEBUG_FLOW) console.log(`[DEV] [flow] retry-reset ${rScope}: all (${_prevFragments} -> 0 fragments, checkpoint discarded) - ${reason}`);
        break;

      default: {
        const _exhaustiveCheck: never = rClearStrategy;
        console.warn(`[ContentReassembler] Unknown rClearStrategy: ${rClearStrategy}`);
      }
    }

    // -> ph: show retry status
    const retryMessage = `Retrying [${attempt}/${maxAttempts}] in ${Math.round(delayMs / 100) / 10}s - ${reason}`;
    this.accumulator.fragments.push(createPlaceholderVoidFragment(retryMessage, undefined, {
      ctl: 'ec-retry',
      rScope: rScope,
      rAttempt: attempt,
      ...(causeHttp ? { rCauseHttp: causeHttp } : undefined),
      ...(causeConn ? { rCauseConn: causeConn } : undefined),
    }));
  }

  private onMetrics({ metrics }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'set-metrics' }>): void {
    // type check point for AixWire_Particles.CGSelectMetrics -> DMetricsChatGenerate_Lg
    this.accumulator.genMetricsLg = metrics;
    metricsPendChatGenerateLg(this.accumulator.genMetricsLg);
  }

  private onModelName({ name }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'set-model' }>): void {
    this.accumulator.genModelName = name;
  }

  private onProviderInfra({ label }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'set-provider-infra' }>): void {
    this.accumulator.genProviderInfraLabel = label;
  }

  private onResponseHandle({ handle }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'set-upstream-handle' }>): void {
    // validate the handle
    if (handle?.uht !== 'vnd.oai.responses' || !handle?.responseId || handle?.expiresAt === undefined) {
      this._appendReassemblyDevError(`Invalid response handle received: ${JSON.stringify(handle)}`);
      return;
    }
    // type check point for AixWire_Particles.ChatControlOp('set-upstream-handle') -> DUpstreamResponseHandle
    this.accumulator.genUpstreamHandle = handle;
  }


  // utility

  private _appendReassemblyDevError(errorText: string, omitPrefix?: boolean): void {
    if (ELLIPSIZE_DEV_ISSUE_MESSAGES) {
      const excess = errorText.length - ELLIPSIZE_DEV_ISSUE_MESSAGES;
      const truncationMessage = `\n\n ... (truncated ${excess?.toLocaleString()} characters) ... \n\n`;
      if (excess > 0)
        errorText = ellipsizeMiddle(errorText, ELLIPSIZE_DEV_ISSUE_MESSAGES - truncationMessage.length, truncationMessage);
    }
    this._appendErrorFragment((omitPrefix ? '' : 'AIX Content Reassembler: ') + errorText);
  }

  private _appendErrorFragment(errorText: string, errorHint?: DMessageErrorPart['hint']): void {
    this.accumulator.fragments.push(createErrorContentFragment(errorText, errorHint));
    this.accumulator._textFragmentIndex = null;
  }

}