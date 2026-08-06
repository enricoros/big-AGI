import * as React from 'react';

import type { DLLM } from '~/common/stores/llms/llms.types';
import { estimateTextTokens } from '~/common/stores/chat/chat.tokens';


/**
 * Efficient hook that calculates token count for text with debouncing and deadline,
 * and only updates when the token count changes.
 *
 * @param text The text to count tokens for.
 * @param llm The LLM (includes the config) we perform the token count FOR.
 * @param debounceMs The minimum time between updates (keeps rolling at every change)
 * @param deadlineMs The maximum time between updates (fires even if the text is still changing)
 */
export function useTextTokenCount(
  text: string,
  llm: DLLM | null,
  debounceMs: number = 300,
  deadlineMs: number = 1200,
): number | undefined {

  // state: text ref to just read point value
  const lastTextRef = React.useRef<string>(undefined);

  // state
  const [tokenCount, setTokenCount] = React.useState<number | undefined>(undefined);
  const lastTokenCountRef = React.useRef<number | undefined>(undefined);

  const resetTokenCount = React.useCallback((value: number | undefined = 0) => {
    if (lastTokenCountRef.current === value) return;
    lastTokenCountRef.current = value;
    setTokenCount(value);
  }, []);


  // Timers: Debounced/Deadlined

  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const deadlineTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  const clearTimers = React.useCallback((clearDebounce: boolean = true, clearDeadline: boolean = true) => {
    if (clearDebounce && debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
    if (clearDeadline && deadlineTimerRef.current) {
      clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = undefined;
    }
  }, []);


  // tokens calculation, given the input text and LLM (which includes the LLM configuration)
  // NOTE: we shall extend this for fragments? (images, etc.)

  const calculateAndUpdateTextTokens = React.useCallback(() => {

    // no llm: can't count
    const currentText = lastTextRef.current;
    if (!llm || currentText === undefined) {
      resetTokenCount(undefined);
      return;
    }

    // [HEAVY] compute tokens
    const newTextTokens = !currentText ? 0
      : estimateTextTokens(currentText, llm, 'useTextTokenCount');

    // only update state if changed
    if (newTextTokens !== lastTokenCountRef.current) {
      lastTokenCountRef.current = newTextTokens;
      setTokenCount(newTextTokens);
    }

    // clear both timers since we're current now
    clearTimers(true, true);

  }, [clearTimers, llm, resetTokenCount]);


  // debounce mechanics

  React.useEffect(() => {

    // if there's no LLM, we can't do anything
    if (!llm || text === undefined) {
      resetTokenCount(undefined);
      return;
    }

    // update text reference for the calculation function
    lastTextRef.current = text;

    // restart the debounce timer
    clearTimers(true, false);
    debounceTimerRef.current = setTimeout(calculateAndUpdateTextTokens, debounceMs);

    // set a deadline timer if one isn't already running
    if (!deadlineTimerRef.current && deadlineMs > debounceMs)
      deadlineTimerRef.current = setTimeout(calculateAndUpdateTextTokens, deadlineMs);

  }, [calculateAndUpdateTextTokens, clearTimers, deadlineMs, debounceMs, llm, resetTokenCount, text]);

  // cleanup at unmount
  React.useEffect(() => () => clearTimers(true, true), [clearTimers]);

  return tokenCount;
}
