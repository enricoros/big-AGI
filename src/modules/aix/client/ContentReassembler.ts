import { addDBImageAsset } from '~/common/stores/blob/dblobs-portability';

import type { DMessageGenerator } from '~/common/stores/chat/chat.message';
import type { MaybePromise } from '~/common/types/useful.types';
import { convert_Base64WithMimeType_To_Blob } from '~/common/util/blobUtils';
import { create_CodeExecutionInvocation_ContentFragment, create_CodeExecutionResponse_ContentFragment, create_FunctionCallInvocation_ContentFragment, createAnnotationsVoidFragment, createDMessageDataRefDBlob, createDVoidWebCitation, createErrorContentFragment, createHostedResourceContentFragment, createModelAuxVoidFragment, createPlaceholderVoidFragment, createTextContentFragment, createZyncAssetReferenceContentFragment, DMessageErrorPart, DVoidModelAuxPart, DVoidPlaceholderMOp, isContentFragment, isModelAuxPart, isTextContentFragment, isVoidAnnotationsFragment, isVoidFragment, isVoidPlaceholderFragment } from '~/common/stores/chat/chat.fragments';
import { ellipsizeMiddle } from '~/common/util/textUtils';
import { imageBlobTransform, PLATFORM_IMAGE_MIMETYPE } from '~/common/util/imageUtils';
import { metricsFinishChatGenerateLg, metricsPendChatGenerateLg } from '~/common/stores/metrics/metrics.chatgenerate';
import { nanoidToUuidV4 } from '~/common/util/idUtils';

import type { AixWire_Particles } from '../server/api/aix.wiretypes';

import type { AixClientDebugger, AixFrameId } from './debugger/memstore-aix-client-debugger';
import { aixClientDebugger_completeFrame, aixClientDebugger_init, aixClientDebugger_recordParticleReceived, aixClientDebugger_setProfilerMeasurements, aixClientDebugger_setRequest } from './debugger/reassembler-debug';

import { AixChatGenerateContent_LL, AixChatGenerateContent_LL_Result, AixChatGenerateTerminal_LL, DEBUG_PARTICLES } from './aix.client';
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


/**
 * Internal reassembly state - extends the streaming type with reassembly-internal fields.
 * Checkpointing/restore is atomic over this entire object.
 * External code sees only AixChatGenerateContent_LL (structural subtype).
 */
type ReassemblyState = AixChatGenerateContent_LL & {
  // reassembly-internal fields
  /** Cursor: index of the open text fragment for appending, or null if none is open */
  _textFragmentIndex: number | null;
  /** set/overwritten during streaming, consumed by finalizeReassembly() */
  cgMetricsLg: undefined | AixChatGenerateContent_LL_Result['cgMetricsLg'];
  /** Raw termination cause: undetermined yet, client-set, or received from the wire on {cg:'end'} */
  terminationReason: undefined | 'done-client-aborted' | 'issue-client-rpc' | AixWire_Particles.CGEndReason;
  /** Raw token stop reason: undetermined yet or received from the wire on {cg:'end'} */
  dialectStopReason: undefined | AixWire_Particles.GCTokenStopReason;
};


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

  // owned reassembly state - coherent and with checkpointing support
  readonly S: ReassemblyState;
  private checkpointState?: ReassemblyState; // for continuation reset
  private readonly initialState: ReassemblyState; // for full reset

  // settable per-iteration callback
  private onStreamingUpdate?: (accumulator: AixChatGenerateContent_LL, hasContent: boolean) => MaybePromise<void>;
  private updateContentStarted = false; // true (forever) after the first update with content, even if we have resets/continuations in the future


  constructor(
    initialGenerator: DMessageGenerator,
    aiInspectorTransport: undefined | AixClientDebugger.Transport,
    aiInspectorContext: undefined | AixClientDebugger.Context,
    private readonly skipImageCompression?: boolean,
    private readonly wireAbortSignal?: AbortSignal,
    private readonly onInlineAudio?: (audio: { blob: Blob; mimeType: string; label: string; durationMs?: number }) => void,
  ) {
    this.initialState = {
      // AixChatGenerateContent_LL fields:
      fragments: [],
      generator: initialGenerator,
      // reassembly-internal fields:
      _textFragmentIndex: null,
      cgMetricsLg: undefined,
      terminationReason: undefined,
      dialectStopReason: undefined,
    };
    this.S = { ...this.initialState }; // we trust the rest of the code to never mutate, always replace

    // [AI Inspector] Debugging the request, last-write-wins for the global (displayed in the UI)
    this.debuggerFrameId = aiInspectorTransport && aiInspectorContext ? aixClientDebugger_init(aiInspectorTransport, aiInspectorContext) : null;

  }

  set updateCallback(callback: typeof this.onStreamingUpdate) {
    this.onStreamingUpdate = callback;
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


  finalizeReassembly(): AixChatGenerateContent_LL_Result {

    // Classify termination -> outcome + tokenStopReason + optional error message
    const { outcome, tsr, errorMessage } = this._classifyTermination();
    // termination -> legacy UI data pt
    if (tsr) this.S.generator = { ...this.S.generator, tokenStopReason: tsr };
    // termination -> User/AI issue message
    if (errorMessage) this._appendErrorFragment(errorMessage);


    // Fragment finalization heuristics:

    // - remove placeholders for clean exits, leave them for issues or client-aborts
    if (this.S.terminationReason === 'done-dialect')
      this._removeAllVoidPlaceholders(); // [PH-LIFECYCLE]

    // - mark active operations as errored on non-clean terminations
    if (outcome !== 'completed') {
      this.S.fragments = this.S.fragments.map(fragment => {
        if (!isVoidPlaceholderFragment(fragment) || !fragment.part.opLog?.length) return fragment;
        const updatedOpLog = fragment.part.opLog.map(entry => {
          const trimmedText = entry.text?.endsWith('...') ? entry.text.slice(0, -3) : entry.text;
          if (entry.state !== 'active') return trimmedText !== entry.text ? { ...entry, text: trimmedText } : entry;
          return { ...entry, text: trimmedText, state: 'error' as const, oTexts: [...(entry.oTexts || []), `Terminated with reason: ${this.S.terminationReason ?? 'unknown'}`] };
        });
        return { ...fragment, part: { ...fragment.part, opLog: updatedOpLog } };
      });
    }

    // - fuse adjacent same-type fragments that were kept separate across continuation turns
    // NOTE: not needed because of precise snapshotting and restoration, and upstream guarantees about completeness of fragments


    // Metrics
    metricsFinishChatGenerateLg(this.S.cgMetricsLg, outcome !== 'completed');

    // [AI Inspector] Debugging, finalize the frame
    if (this.debuggerFrameId)
      aixClientDebugger_completeFrame(this.debuggerFrameId);

    // Return the finalized result: final fragments + generator + outcome + metrics
    return {
      fragments: this.S.fragments,
      generator: this.S.generator,
      outcome,
      cgMetricsLg: this.S.cgMetricsLg,
    };
  }


  setClientAborted(): void {
    if (DEBUG_PARTICLES)
      console.log('-> aix.p: abort-client');

    // normal user cancellation does not require error fragments

    if (this.S.terminationReason)
      console.warn(`⚠️ [ContentReassembler] setClientAborted: overriding server termination '${this.S.terminationReason}' (wire stop: ${this.S.dialectStopReason ?? 'none'})`);

    this.S.terminationReason = 'done-client-aborted';
    this.S.dialectStopReason = undefined; // reset, as we assume we can't know (alt: jsut leave it)
  }

  setClientExcepted(errorAsText: string, errorHint?: DMessageErrorPart['hint']): void {
    if (DEBUG_PARTICLES)
      console.log('-> aix.p: issue:', errorAsText);

    // add the error fragment with the given message
    this._appendErrorFragment(errorAsText, errorHint);

    if (this.S.terminationReason)
      console.warn(`⚠️ [ContentReassembler] setClientExcepted: overriding server termination '${this.S.terminationReason}' (wire stop: ${this.S.dialectStopReason ?? 'none'})`);

    this.S.terminationReason = 'issue-client-rpc';
    this.S.dialectStopReason = undefined; // reset, as we can't assume we know (alt: jsut leave it)
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
        await this.onStreamingUpdate?.(this.S, this.updateContentStarted ||= this.S.fragments.length > 0);

      }

    } catch (error) {

      //
      // Classify and display processing errors (particle/async work failures)
      //
      // NOTE: we cannot throw here as we are part of a detached promise chain
      // READ the `aixClassifyReassemblyError` that explains this in detail
      //
      const showAsBold = !!this.S.fragments.length;
      const { errorMessage } = aixClassifyReassemblyError(error, showAsBold);

      this._appendReassemblyDevError(errorMessage, true);
      await this.onStreamingUpdate?.(this.S, this.updateContentStarted ||= true)?.catch(console.error);

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
          case 'vp':
            this.onSetOperationState(op);
            break;
          case 'urlc':
            this.onAddUrlCitation(op);
            break;
          case 'hres':
            this.onAppendHostedResource(op);
            break;
          case 'svs':
            this.onSetVendorState(op);
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
              this.S._textFragmentIndex = null;
              // Continuation checkpoint: create a snapshot now
              this.checkpointState = structuredClone(this.S);
              if (DEBUG_FLOW) console.log(`[DEV] [flow] checkpoint created: ${this.S.fragments.length} fragments snapshotted`);
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

    // append to existing TextContentFragment
    const idx = this.S._textFragmentIndex;
    const currentTextFragment = idx !== null ? this.S.fragments[idx] : null;
    if (idx !== null && currentTextFragment && isTextContentFragment(currentTextFragment)) {
      this._replaceFragmentAt(idx, {
        ...currentTextFragment,
        part: {
          ...currentTextFragment.part,
          text: currentTextFragment.part.text + particle.t,
        },
      });
      return;
    }

    // new TextContentFragment
    this._pushFragment(createTextContentFragment(particle.t));
    this.S._textFragmentIndex = this.S.fragments.length - 1;

  }

  private onAppendReasoningText({ _t, restart }: Extract<AixWire_Particles.PartParticleOp, { p: 'tr_' }>): void {
    // Break text accumulation
    this.S._textFragmentIndex = null;

    // append to existing ModelAuxVoidFragment if possible
    const currentFragment = this.S.fragments[this.S.fragments.length - 1];
    if (!restart && currentFragment && isVoidFragment(currentFragment) && isModelAuxPart(currentFragment.part)) {
      const appendedPart = { ...currentFragment.part, aText: (currentFragment.part.aText || '') + _t } satisfies DVoidModelAuxPart;
      this._replaceFragmentAt(this.S.fragments.length - 1, { ...currentFragment, part: appendedPart });
      return;
    }

    // new ModelAuxVoidFragment
    const fragment = createModelAuxVoidFragment('reasoning', _t);
    this._pushFragment(fragment);
  }

  private onSetReasoningSignature({ signature }: Extract<AixWire_Particles.PartParticleOp, { p: 'trs' }>): void {

    // set to existing ModelAuxVoidFragment if possible
    const currentFragment = this.S.fragments[this.S.fragments.length - 1];
    if (currentFragment && isVoidFragment(currentFragment) && isModelAuxPart(currentFragment.part)) {
      const setPart = { ...currentFragment.part, textSignature: signature } satisfies DVoidModelAuxPart;
      this._replaceFragmentAt(this.S.fragments.length - 1, { ...currentFragment, part: setPart });
      return;
    }

    // if for some reason there's no ModelAuxVoidFragment, create one
    const fragment = createModelAuxVoidFragment('reasoning', '', signature);
    this._pushFragment(fragment);
  }

  private onAddRedactedDataParcel({ _data }: Extract<AixWire_Particles.PartParticleOp, { p: 'trr_' }>): void {

    // add to existing ModelAuxVoidFragment if possible
    const currentFragment = this.S.fragments[this.S.fragments.length - 1];
    if (currentFragment && isVoidFragment(currentFragment) && isModelAuxPart(currentFragment.part)) {
      const appendedPart = { ...currentFragment.part, redactedData: [...(currentFragment.part.redactedData || []), _data] } satisfies DVoidModelAuxPart;
      this._replaceFragmentAt(this.S.fragments.length - 1, { ...currentFragment, part: appendedPart });
      return;
    }

    // create a new ModelAuxVoidFragment for redacted thinking
    const fragment = createModelAuxVoidFragment('reasoning', '', undefined, [_data]);
    this._pushFragment(fragment);
  }


  private onStartFunctionCallInvocation(fci: Extract<AixWire_Particles.PartParticleOp, { p: 'fci' }>): void {
    // Break text accumulation
    this.S._textFragmentIndex = null;
    // Start FC accumulation
    const fragment = create_FunctionCallInvocation_ContentFragment(
      fci.id,
      fci.name,
      fci.i_args || '', // if i_args is undefined, use an empty string, which means 'no args' in DParticle/AixTools (for now at least)
    );
    // TODO: add _description from the Spec
    // TODO: add _args_schema from the Spec
    this._pushFragment(fragment);
  }

  private onAppendFunctionCallInvocationArgs(_fci: Extract<AixWire_Particles.PartParticleOp, { p: '_fci' }>): void {
    const fragment = this.S.fragments[this.S.fragments.length - 1];
    if (fragment && isContentFragment(fragment) && fragment.part.pt === 'tool_invocation' && fragment.part.invocation.type === 'function_call') {
      const updatedPart = {
        ...fragment.part,
        invocation: {
          ...fragment.part.invocation,
          args: (fragment.part.invocation.args || '') + _fci._args,
        },
      };
      this._replaceFragmentAt(this.S.fragments.length - 1, { ...fragment, part: updatedPart });
    } else
      this._appendReassemblyDevError('unexpected _fc particle without a preceding function-call');
  }

  private onAddCodeExecutionInvocation(cei: Extract<AixWire_Particles.PartParticleOp, { p: 'cei' }>): void {
    this._pushFragment(create_CodeExecutionInvocation_ContentFragment(cei.id, cei.language, cei.code, cei.author));
    this.S._textFragmentIndex = null;
  }

  private onAddCodeExecutionResponse(cer: Extract<AixWire_Particles.PartParticleOp, { p: 'cer' }>): void {
    this._pushFragment(create_CodeExecutionResponse_ContentFragment(cer.id, cer.error, cer.result, cer.executor, cer.environment));
    this.S._textFragmentIndex = null;
  }

  private async onAppendInlineAudio(particle: Extract<AixWire_Particles.PartParticleOp, { p: 'ia' }>): Promise<void> {

    // Break text accumulation, as we have a full audio part in the middle
    this.S._textFragmentIndex = null;

    const { mimeType, a_b64: base64Data, label, /*generator,*/ durationMs } = particle;
    const safeLabel = label || 'Generated Audio';

    try {

      // create blob from base64 - this will throw on malformed data
      const audioBlob = await convert_Base64WithMimeType_To_Blob(base64Data, mimeType, 'ContentReassembler.onAppendInlineAudio');

      // show a label in the message (audio fragment persistence deferred to future work)
      this._pushFragment(createTextContentFragment(`Generated audio ▶ \`${safeLabel}\`${durationMs ? ` (${Math.round(durationMs / 10) / 100}s)` : ''}`));

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

      // this._pushFragment(audioContentFragment);

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
    this.S._textFragmentIndex = null;

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

      this._pushFragment(zyncImageAssetFragmentWithLegacy);
    } catch (error: any) {
      console.warn('[DEV] Failed to add inline image to DBlobs:', { label, error, inputType, base64Length: inputBase64.length });
    }
  }

  private onAppendHostedResource(op: Extract<AixWire_Particles.PartParticleOp, { p: 'hres' }>): void {

    // Break text accumulation, as we will display this as it happens (parting text, if needed)
    this.S._textFragmentIndex = null;

    switch (op.kind) {

      case 'vnd.ant.file':
        this._pushFragment(createHostedResourceContentFragment({
          via: 'anthropic',
          fileId: op.fileId,
          ...(op.containerId ? { containerId: op.containerId } : {}),
        }));
        break;

      default:
        const _exhaustiveCheck: never = op.kind;
        console.warn('[ContentReassembler] onAppendHostedResource: unrecognized hosted resource kind', { op });
        break;
    }
  }

  private onAddUrlCitation(urlc: Extract<AixWire_Particles.PartParticleOp, { p: 'urlc' }>): void {

    const { title, url, num: refNumber, from: startIndex, to: endIndex, text: textSnippet, pubTs } = urlc;

    // reuse existing annotations - single fragment per message
    const existingIdx = this.S.fragments.findIndex(isVoidAnnotationsFragment);
    if (existingIdx >= 0) {
      const existing = this.S.fragments[existingIdx];
      if (!isVoidAnnotationsFragment(existing)) return; // type guard (unreachable)

      // coalesce ranges if there are citations at the same URL
      const sameUrlIdx = existing.part.annotations.findIndex(({ type, url: existingUrl }) => type === 'citation' && url === existingUrl);
      if (sameUrlIdx < 0) {

        // new citation URL
        const updatedAnnotations = [...existing.part.annotations, createDVoidWebCitation(url, title, refNumber, startIndex, endIndex, textSnippet, pubTs)];
        this._replaceFragmentAt(existingIdx, {
          ...existing,
          part: {
            ...existing.part,
            annotations: updatedAnnotations,
          },
        });

      } else if (startIndex !== undefined && endIndex !== undefined) {

        // add range to existing citation
        const citation = existing.part.annotations[sameUrlIdx];
        const updatedCitation = { ...citation, ranges: [...citation.ranges, { startIndex, endIndex, ...(textSnippet ? { textSnippet } : {}) }] };
        const updatedAnnotations = existing.part.annotations.map((a, i) => i === sameUrlIdx ? updatedCitation : a);
        this._replaceFragmentAt(existingIdx, {
          ...existing,
          part: {
            ...existing.part,
            annotations: updatedAnnotations,
          },
        });

      }

    } else {

      // create the *only* annotations fragment in the message
      this._pushFragment(createAnnotationsVoidFragment([
        createDVoidWebCitation(url, title, refNumber, startIndex, endIndex, textSnippet, pubTs),
      ]));

    }

    // Important: Don't reset _textFragmentIndex to allow text to continue
    // This ensures we don't interrupt the text flow
  }

  private onSetOperationState(os: Extract<AixWire_Particles.PartParticleOp, { p: 'vp' }>): void {

    // This operation does not require removal of existing VoidPlaceholder fragments, as it recycles the last one if any

    // destructure
    const { text, mot, opId, state, parentOpId, iTexts, oTexts } = os;

    const newEntry: DVoidPlaceholderMOp = {
      opId,
      text,
      mot,
      state: state ?? 'active',
      ...iTexts ? { iTexts } : undefined,
      ...oTexts ? { oTexts } : undefined,
      ...parentOpId ? { parentOpId } : undefined,
      level: 0,
      cts: Date.now(),
    };

    const phIdx = this.S.fragments.findLastIndex(isVoidPlaceholderFragment);
    if (phIdx < 0) {

      // New placeholder with initial opLog entry (root level = 0)
      this._pushFragment(createPlaceholderVoidFragment(text, undefined, undefined, [newEntry]));

      // Placeholders don't affect text fragment indexing (push to end doesn't shift existing indices)
      // NOTE: we could have placeholders breaking text accumulation into new fragments with `this.S._textFragmentIndex = null;`, however
      // since placeholders are used a lot with hosted tool calls, this could lead to way too many fragments being created
      return;
    }

    // Accumulate into existing placeholder
    const existingPh = this.S.fragments[phIdx];
    if (!isVoidPlaceholderFragment(existingPh)) return; // type guard (unreachable)
    const prevOpLog = existingPh.part.opLog ?? [];

    // update existing entry or append new one
    const existingEntryIdx = prevOpLog.findIndex(e => e.opId === opId);
    let updatedOpLog: readonly DVoidPlaceholderMOp[];
    if (existingEntryIdx >= 0) {
      const prev = prevOpLog[existingEntryIdx];
      updatedOpLog = prevOpLog.map((e, i) => i !== existingEntryIdx ? e : {
        ...prev,
        ...text ? { text } : undefined,
        ...state ? { state } : undefined,
        ...iTexts ? { iTexts } : undefined,
        ...oTexts ? { oTexts } : undefined,
      });
    } else {
      // infer level from parent
      const level = !parentOpId ? 0 : 1 + (prevOpLog.find(e => e.opId === parentOpId)?.level ?? 0);
      updatedOpLog = [...prevOpLog, { ...newEntry, level }];
    }

    // top-level pText reflects latest active (or last if all done)
    const latest = updatedOpLog.findLast(e => e.state === 'active') ?? updatedOpLog[updatedOpLog.length - 1];
    const updatedPart = {
      ...existingPh.part,
      pText: latest.text,
      opLog: updatedOpLog,
    };
    delete updatedPart.pType; // operations supersede other placeholder types
    delete updatedPart.aixControl; // operations supersede info/checkpoint markers
    this._replaceFragmentAt(phIdx, { ...existingPh, part: updatedPart });

  }

  private onSetVendorState(vs: Extract<AixWire_Particles.PartParticleOp, { p: 'svs' }>): void {

    // Promote Anthropic container state -> Generator (message-scoped, for cross-turn reuse)
    if (vs.vendor === 'anthropic' && 'container' in vs.state) {
      const { id, expiresAt } = vs.state.container;
      if (id && expiresAt)
        this.S.generator = {
          ...this.S.generator,
          upstreamContainer: { uct: 'vnd.ant.container', containerId: id, expiresAt },
        };
      return; // container is message-scoped, not fragment-scoped
    }

    // Fragment-scoped vendor states - attach to the last fragment (e.g. Gemini thoughtSignature)
    const lastIdx = this.S.fragments.length - 1;
    const lastFragment = this.S.fragments[lastIdx];
    if (!lastFragment) {
      console.warn('[ContentReassembler] Vendor state particle without preceding content fragment');
      return;
    }

    // attach fragment-level vendor state
    this._replaceFragmentAt(lastIdx, {
      ...lastFragment,
      vendorState: {
        ...lastFragment.vendorState,
        [vs.vendor]: vs.state,
      },
    });
  }

  private _removeAllVoidPlaceholders(): void {
    this.S.fragments = this.S.fragments.filter(f => !isVoidPlaceholderFragment(f));
    // _textFragmentIndex may now be invalid - null it since this runs at finalization only
    this.S._textFragmentIndex = null;
  }

  private async _removeLastVoidPlaceholderDelayed(): Promise<boolean> {
    // skip if none
    if (this.S.fragments.findLastIndex(isVoidPlaceholderFragment) < 0) return false;

    // delay before removal
    await new Promise(resolve => setTimeout(resolve, VP_PERSISTENCE_DELAY));

    // for stability, search the fragment Index again - this must not have changed, as any mutation would be queued to
    // this awaited function, but better safe than sorry
    const idx = this.S.fragments.findLastIndex(isVoidPlaceholderFragment);
    if (idx < 0) return true; // already removed during the delay
    this._spliceFragment(idx);
    return true;
  }


  /// Rest of the data ///

  /**
   * Stores raw termination data from the wire - classification deferred to finalizeReassembly()
   */
  private onCGEnd({ terminationReason, tokenStopReason }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'end' }>): void {
    this.S.terminationReason = terminationReason;
    this.S.dialectStopReason = tokenStopReason;
  }

  /**
   * Pure classification of termination state - no side effects.
   * Cross-references terminationReason + dialectStopReason to derive:
   * - outcome: definitive result of this LL call
   * - tsr: tokenStopReason for the generator (UI detail, undefined = normal completion)
   * - errorMessage: optional user/AI-facing message explaining what happened (appended by caller)
   */
  private _classifyTermination(): { outcome: AixChatGenerateTerminal_LL; tsr: DMessageGenerator['tokenStopReason']; errorMessage?: string; } {
    const { terminationReason: endReason, dialectStopReason: dialectTokenStopReason } = this.S;

    // -- Client-set terminations --

    if (endReason === 'done-client-aborted')
      return { outcome: 'aborted', tsr: 'client-abort' };
    if (endReason === 'issue-client-rpc')
      return { outcome: 'failed', tsr: 'issue' /* error fragment already appended by setClientExcepted() */ };

    // -- Dialect-set dispatch terminations (model responded with an explicit stop reason at the end) --

    if (dialectTokenStopReason) {
      const classification: Record<AixWire_Particles.GCTokenStopReason, ReturnType<typeof this._classifyTermination>> = {
        // normal completions - the model responded and stopped cleanly
        'ok': { outcome: 'completed', tsr: undefined },
        'ok-tool_invocations': { outcome: 'completed', tsr: undefined },
        // issues from the dialect/dispatch layer
        'cg-issue': { outcome: 'failed', tsr: 'issue' },
        // model completed but with a specific stop condition
        'out-of-tokens': { outcome: 'completed', tsr: 'out-of-tokens' },
        'filter-content': { outcome: 'completed', tsr: 'filter' },
        'filter-recitation': { outcome: 'completed', tsr: 'filter' },
        'filter-refusal': { outcome: 'completed', tsr: 'filter' },
      } as const;
      if (dialectTokenStopReason in classification)
        return classification[dialectTokenStopReason];
      console.warn(`[ContentReassembler] Unmapped dialectStopReason: ${dialectTokenStopReason}. Falling back to terminationReason.`);
    }

    // -- Unexpected: no termination reason nor token stop reason --

    if (endReason === undefined) {
      // SEVERE - AIX BUG: either client terminations or an 'end' particle must be received
      console.warn(`⚠️ [ContentReassembler] finished without 'terminationReason' - possible missing 'end' particle.`);
      return { outcome: 'failed', tsr: 'issue', errorMessage: 'Response may be incomplete - missing completion signal.' };
    }

    // -- Dispatch-set terminations: AixWire_Particles.CGEndReason --

    switch (endReason) {
      case 'done-dialect':
        // Acceptable - dialect said done but didn't provide a stop reason - likely a parser gap
        console.warn(`⚠️ [ContentReassembler] termination by dialect without 'dialectStopReason' - possible dialect parser issue.`);
        return { outcome: 'completed', tsr: undefined, errorMessage: 'Note: response may be incomplete - the finish reason was not provided by the model.' };

      case 'done-dispatch-closed': // (!) VERY COMMON
        // BROKEN - Stream EOF before the dialect sent a termination signal - provider closed the connection early
        console.warn(`⚠️ [ContentReassembler] done-dispatch-closed without dialectStopReason - possible truncation`);
        return { outcome: 'failed', tsr: 'issue', errorMessage: 'Response may be truncated - stream ended before completion.' };

      case 'done-dispatch-aborted':
        // BROKEN - Infrastructure abort (not user-initiated) - dispatch connection severed
        console.warn(`⚠️ [ContentReassembler] done-dispatch-aborted - connection lost, not user-initiated.`);
        return { outcome: 'failed', tsr: 'issue', errorMessage: 'Response interrupted - the AI provider connection was lost.' };

      case 'issue-dialect':
      case 'issue-dispatch-rpc':
        return { outcome: 'failed', tsr: 'issue' /* error fragments already added by upstream issue particles */};

      default:
        const _exhaustiveCheck: never = endReason;
        console.warn(`⚠️ [ContentReassembler] unmapped termination reason: ${endReason}`);
        return { outcome: 'failed', tsr: undefined };
    }
  }

  private onCGIssue({ issueId: _issueId /* Redundant as we add an Error Fragment already */, issueText, issueHint }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'issue' }> & { issueHint?: DMessageErrorPart['hint'] }): void {
    // NOTE: not sure I like the flow at all here
    // there seem to be some bad conditions when issues are raised while the active part is not text
    if (MERGE_ISSUES_INTO_TEXT_PART_IF_OPEN) {
      const currentTextFragment = this.S._textFragmentIndex === null ? null
        : this.S.fragments[this.S._textFragmentIndex];
      if (currentTextFragment && isTextContentFragment(currentTextFragment)) {
        const idx = this.S._textFragmentIndex!;
        this._replaceFragmentAt(idx, {
          ...currentTextFragment,
          part: { ...currentTextFragment.part, text: currentTextFragment.part.text + (currentTextFragment.part.text ? '\n' : ' ') + issueText },
        });
        return;
      }
    }
    this._appendErrorFragment(issueText, issueHint);
  }

  private onAixInfo({ ait, text }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'aix-info' }>): void {
    // -> ph: show info
    this._pushFragment(createPlaceholderVoidFragment(text, undefined, {
      ctl: 'ac-info',
      ait: ait,
    }));
  }

  private onAixRetryReset({ rScope, rClearStrategy, attempt, maxAttempts, delayMs, reason, causeHttp, causeConn }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'aix-retry-reset' }>): void {
    const _prevFragments = DEBUG_FLOW ? this.S.fragments.length : 0;
    switch (rClearStrategy) {
      case 'none':
        // keep everything (e.g. L1 connection retries - no content streamed yet)
        if (DEBUG_FLOW) console.log(`[DEV] [flow] retry-reset ${rScope}: none (keeping ${_prevFragments} fragments) - ${reason}`);
        break;

      case 'since-checkpoint':
        // atomic restore to checkpoint (fall back to initial state if no checkpoint)
        if (!this.checkpointState)
          console.warn('[ContentReassembler] since-checkpoint restore with no checkpoint - falling back to full clear');
        Object.assign(this.S, structuredClone(this.checkpointState ?? this.initialState));
        this.wireParticlesBacklog.length = 0; // should have been drained/completed already
        if (DEBUG_FLOW) console.log(`[DEV] [flow] retry-reset ${rScope}: since-checkpoint (${_prevFragments} -> ${this.S.fragments.length} fragments) - ${reason}`);
        break;

      case 'all':
        // full wipe for reconnect scenarios (L4 client reconnect)
        Object.assign(this.S, structuredClone(this.initialState));
        this.checkpointState = undefined;
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
    this._pushFragment(createPlaceholderVoidFragment(retryMessage, undefined, {
      ctl: 'ec-retry',
      rScope: rScope,
      rAttempt: attempt,
      ...(causeHttp ? { rCauseHttp: causeHttp } : undefined),
      ...(causeConn ? { rCauseConn: causeConn } : undefined),
    }));
  }

  private onMetrics({ metrics }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'set-metrics' }>): void {
    // type check point for AixWire_Particles.CGSelectMetrics -> DMetricsChatGenerate_Lg
    this.S.cgMetricsLg = metrics;
    metricsPendChatGenerateLg(this.S.cgMetricsLg);
  }

  private onModelName({ name }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'set-model' }>): void {
    this.S.generator = { ...this.S.generator, name };
  }

  private onProviderInfra({ label }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'set-provider-infra' }>): void {
    this.S.generator = { ...this.S.generator, providerInfraLabel: label };
  }

  private onResponseHandle({ handle }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'set-upstream-handle' }>): void {
    // validate the handle
    if (handle?.uht !== 'vnd.oai.responses' || !handle?.responseId || handle?.expiresAt === undefined) {
      this._appendReassemblyDevError(`Invalid response handle received: ${JSON.stringify(handle)}`);
      return;
    }
    // type check point for AixWire_Particles.ChatControlOp('set-upstream-handle') -> DUpstreamResponseHandle
    this.S.generator = { ...this.S.generator, upstreamHandle: handle };
  }


  // Fragment helpers - structural sharing: every mutation creates a new array reference

  private _pushFragment(fragment: AixChatGenerateContent_LL['fragments'][number]): void {
    this.S.fragments = [...this.S.fragments, fragment];
  }

  private _replaceFragmentAt(index: number, fragment: AixChatGenerateContent_LL['fragments'][number]): void {
    this.S.fragments = this.S.fragments.map((f, i) => i === index ? fragment : f);
  }

  private _spliceFragment(index: number): void {
    this.S.fragments = [...this.S.fragments.slice(0, index), ...this.S.fragments.slice(index + 1)];
    if (this.S._textFragmentIndex !== null && this.S._textFragmentIndex > index)
      this.S._textFragmentIndex--;
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
    this._pushFragment(createErrorContentFragment(errorText, errorHint));
    this.S._textFragmentIndex = null;
  }

}