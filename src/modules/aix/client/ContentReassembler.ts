import { addDBImageAsset } from '~/common/stores/blob/dblobs-portability';

import type { DMessageGenerator } from '~/common/stores/chat/chat.message';
import type { MaybePromise } from '~/common/types/useful.types';
import { convert_Base64WithMimeType_To_Blob } from '~/common/util/blobUtils';
import { create_CodeExecutionInvocation_ContentFragment, create_CodeExecutionResponse_ContentFragment, create_FunctionCallInvocation_ContentFragment, createAnnotationsVoidFragment, createDMessageDataRefDBlob, createDVoidWebCitation, createErrorContentFragment, createModelAuxVoidFragment, createPlaceholderVoidFragment, createTextContentFragment, createZyncAssetReferenceContentFragment, DMessageErrorPart, DVoidModelAuxPart, DVoidPlaceholderModelOp, isContentFragment, isModelAuxPart, isTextContentFragment, isVoidAnnotationsFragment, isVoidFragment } from '~/common/stores/chat/chat.fragments';
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
const GENERATED_IMAGES_CONVERT_TO_COMPRESSED = true; // converts PNG to WebP or JPEG to save IndexedDB space
const GENERATED_IMAGES_COMPRESSION_QUALITY = 0.98;
const ELLIPSIZE_DEV_ISSUE_MESSAGES = 4096;
const MERGE_ISSUES_INTO_TEXT_PART_IF_OPEN = false; // 2025-10-10: put errors in the dedicated part


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

  // raw termination data (set during stream or by client, classified at finalization)
  private _terminationReason?: 'done-client-aborted' | 'issue-client-rpc' | AixWire_Particles.CGEndReason;
  private _tokenStopReasonWire?: AixWire_Particles.GCTokenStopReason;


  constructor(
    private readonly accumulator: AixChatGenerateContent_LL,
    private readonly onAccumulatorUpdated?: () => MaybePromise<void>,
    inspectorTransport?: AixClientDebugger.Transport,
    inspectorContext?: AixClientDebugger.Context,
    private readonly wireAbortSignal?: AbortSignal,
  ) {

    // [SUDO] Debugging the request, last-write-wins for the global (displayed in the UI)
    this.debuggerFrameId = !inspectorContext ? null : aixClientDebugger_init(inspectorTransport ?? 'trpc', inspectorContext);

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

    // Metrics
    const hadIssues = !!this.accumulator.legacyGenTokenStopReason;
    metricsFinishChatGenerateLg(this.accumulator.genMetricsLg, hadIssues);

    // [SUDO] Debugging, finalize the frame
    if (this.debuggerFrameId)
      aixClientDebugger_completeFrame(this.debuggerFrameId);

  }


  setClientAborted(): void {
    if (DEBUG_PARTICLES)
      console.log('-> aix.p: abort-client');

    // normal user cancellation does not require error fragments

    if (this._terminationReason)
      console.warn(`⚠️ [ContentReassembler] setClientAborted: overriding server termination '${this._terminationReason}' (wire stop: ${this._tokenStopReasonWire ?? 'none'})`);

    this._terminationReason = 'done-client-aborted';
    this._tokenStopReasonWire = undefined; // reset, as we assume we can't know (alt: jsut leave it)
  }

  setClientExcepted(errorAsText: string, errorHint?: DMessageErrorPart['hint']): void {
    if (DEBUG_PARTICLES)
      console.log('-> aix.p: issue:', errorAsText);

    // add the error fragment with the given message
    this._appendErrorFragment(errorAsText, errorHint);

    if (this._terminationReason)
      console.warn(`⚠️ [ContentReassembler] setClientExcepted: overriding server termination '${this._terminationReason}' (wire stop: ${this._tokenStopReasonWire ?? 'none'})`);

    this._terminationReason = 'issue-client-rpc';
    this._tokenStopReasonWire = undefined; // reset, as we can't assume we know (alt: jsut leave it)
  }

  async setClientRetrying(strategy: 'reconnect' | 'resume', errorMessage: string, attempt: number, maxAttempts: number, delayMs: number, causeHttp?: number, causeConn?: string) {
    if (DEBUG_PARTICLES)
      console.log(`-> aix.p: client-retry (${strategy})`, { errorMessage, attempt, maxAttempts, delayMs, causeHttp, causeConn });

    // process as retry-reset with cli-ll scope
    this.onRetryReset({
      cg: 'retry-reset', rScope: 'cli-ll',
      rShallClear: false, // TODO: check if this is correct; we shall clear, but at the same time we haven't tried to see
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

      //
      // Classify and display processing errors (particle/async work failures)
      //
      // NOTE: we cannot throw here as we are part of a detached promise chain
      // READ the `aixClassifyReassemblyError` that explains this in detail
      //
      const showAsBold = !!this.accumulator.fragments.length;
      const { errorMessage } = aixClassifyReassemblyError(error, showAsBold);

      this._appendReassemblyDevError(errorMessage, true);
      await this.onAccumulatorUpdated?.()?.catch(console.error);

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

    // remove placeholder if any other content except heartbeat or void-placeholder
    if (!('p' in op) || !(op.p === '❤' || op.p === 'vp'))
      this.removePlaceholderIfAtIndex0();

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
          case 'svs':
            this.onSetVendorState(op);
            break;
          case 'urlc':
            this.onAddUrlCitation(op);
            break;
          case 'vp':
            this.onAppendVoidPlaceholder(op);
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
          case 'retry-reset':
            this.onRetryReset(op);
            break;
          case 'set-metrics':
            this.onMetrics(op);
            break;
          case 'set-model':
            this.onModelName(op);
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

  private onAppendReasoningText({ _t, restart }: Extract<AixWire_Particles.PartParticleOp, { p: 'tr_' }>): void {
    // Break text accumulation
    this.currentTextFragmentIndex = null;

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

    const { mimeType, a_b64: base64Data, label, /*generator,*/ durationMs } = particle;
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

    } catch (error: any) {
      console.warn('[DEV] Failed to add inline audio to DBlobs:', { label: safeLabel, error, mimeType, size: base64Data.length });
      // Add an error fragment instead
      this._appendErrorFragment(`Failed to process audio: ${error?.message || 'Unknown error'}`, 'aix-audio-processing');
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

    // Important: Don't reset currentTextFragmentIndex to allow text to continue
    // This ensures we don't interrupt the text flow
  }

  private onAppendVoidPlaceholder(vp: Extract<AixWire_Particles.PartParticleOp, { p: 'vp' }>): void {
    const { text, mot } = vp;

    // update the model op
    const modelOp: DVoidPlaceholderModelOp = { mot, cts: Date.now() };

    // Only reuse placeholder if it's at index 0
    if (this.accumulator.fragments.length > 0) {
      const firstFragment = this.accumulator.fragments[0];
      if (firstFragment.ft === 'void' && firstFragment.part.pt === 'ph') {
        // Update existing placeholder at index 0
        firstFragment.part.pText = text;
        firstFragment.part.modelOp = modelOp;
        return;
      }
    }

    // Create new placeholder at the beginning (will be index 0)
    const placeholderFragment = createPlaceholderVoidFragment(text, undefined, modelOp);
    this.accumulator.fragments.unshift(placeholderFragment); // Add to beginning

    // Placeholders don't affect text fragment indexing
    // NOTE: we could have placeholders breaking text accumulation into new fragments with `this.currentTextFragmentIndex = null;`, however
    // since placeholders are used a lot with hosted tool calls, this could lead to way too many fragments being created
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

  // Helper to remove placeholder when real content arrives
  private removePlaceholderIfAtIndex0(): void {
    if (this.accumulator.fragments.length > 0) {
      const firstFragment = this.accumulator.fragments[0];
      if (firstFragment.ft === 'void' && firstFragment.part.pt === 'ph') {
        this.accumulator.fragments.shift(); // Remove placeholder at index 0
      }
    }
  }


  /// Rest of the data ///

  /**
   * Stores raw termination data from the wire - classification deferred to finalizeAccumulator()
   */
  private onCGEnd({ terminationReason, tokenStopReason }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'end' }>): void {
    this._terminationReason = terminationReason;
    this._tokenStopReasonWire = tokenStopReason;
  }

  /**
   * Cross-references both raw termination inputs to derive the DMessage-level tokenStopReason.
   * Called once at finalization - the single place where wire-level → UI-level classification happens.
   */
  private _deriveTokenStopReason(): DMessageGenerator['tokenStopReason'] | undefined {
    const wire = this._tokenStopReasonWire;

    // First handle client terminations
    if (this._terminationReason === 'done-client-aborted')
      return 'client-abort'; // client-side abort is a 'successful' termination with an incomplete message
    if (this._terminationReason === 'issue-client-rpc') {
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
    switch (this._terminationReason) {
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
        // Stream EOF before completion
        console.warn(`⚠️ [ContentReassembler] done-dispatch-closed without tokenStopReason - possible truncation`);
        this._appendErrorFragment('Message may be truncated: stream ended before completion.');
        return undefined;

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
        const _exhaustiveCheck: never = this._terminationReason;
        console.warn(`⚠️ [ContentReassembler] unmapped termination reason: ${this._terminationReason} - no tokenStopReason can be derived.`);
        return undefined;
    }
  }

  private onCGIssue({ issueId: _issueId /* Redundant as we add an Error Fragment already */, issueText, issueHint }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'issue' }> & { issueHint?: DMessageErrorPart['hint'] }): void {
    // NOTE: not sure I like the flow at all here
    // there seem to be some bad conditions when issues are raised while the active part is not text
    if (MERGE_ISSUES_INTO_TEXT_PART_IF_OPEN) {
      const currentTextFragment = this.currentTextFragmentIndex === null ? null
        : this.accumulator.fragments[this.currentTextFragmentIndex];
      if (currentTextFragment && isTextContentFragment(currentTextFragment)) {
        currentTextFragment.part.text += (currentTextFragment.part.text ? '\n' : ' ') + issueText;
        return;
      }
    }
    this._appendErrorFragment(issueText, issueHint);
  }

  private onRetryReset({ rScope, rShallClear, attempt, maxAttempts, delayMs, reason, causeHttp, causeConn }: Extract<AixWire_Particles.ChatGenerateOp, { cg: 'retry-reset' }>): void {
    // operation-level retry likely requires a wipe
    if (rShallClear) {
      this.currentTextFragmentIndex = null;
      this.accumulator.fragments = [];
      delete this.accumulator.legacyGenTokenStopReason;
      // reset private termination state
      this._terminationReason = undefined;
      this._tokenStopReasonWire = undefined;
      // keep metrics/model/handle intact - may be useful for debugging retries

      // discard any pending particles from the failed attempt
      this.wireParticlesBacklog.length = 0;
    }

    // -> ph: show retry status
    const retryMessage = `Retrying [${attempt}/${maxAttempts}] in ${Math.round(delayMs / 1000)}s - ${reason}`;
    this.accumulator.fragments.push(createPlaceholderVoidFragment(retryMessage, undefined, undefined, {
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
    this.currentTextFragmentIndex = null;
  }

}