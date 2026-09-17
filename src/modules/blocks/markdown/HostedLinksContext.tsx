import * as React from 'react';


/**
 * Message-scoped registry that lets a markdown link resolve to an action owned by a sibling block of the same message.
 *
 * The link side (CustomARenderer) knows only an href. The block side (a hosted-file chip) owns the credentials of the
 * service the file is pinned to, the download and its busy, error and gone state - so it registers an action under a
 * handle, and the link merely triggers it. Handles are opaque strings; each link scheme derives its own in
 * hostedLinkHandleFromHref. With no provider (surfaces without a message frame), no registration, or two blocks
 * claiming one handle, the link stays inert.
 *
 * Two contexts so that registering (stable function) never re-renders the links, while resolving (state) does.
 */

type HostedLinkAction = () => void;
type HostedLinkRegister = (handle: string, action: HostedLinkAction) => () => void; // returns the unregister

const HostedLinksRegisterContext = React.createContext<HostedLinkRegister | null>(null);
const HostedLinksActionsContext = React.createContext<ReadonlyMap<string, HostedLinkAction[]> | null>(null);


/** The handle a hosted block may have registered for this href, or null for schemes we do not resolve */
export function hostedLinkHandleFromHref(href: string): string | null {
  // OpenAI code interpreter: 'sandbox:/mnt/data/<file>' - the basename is the container file's name
  if (/^sandbox:/i.test(href)) {
    const path = href.slice('sandbox:'.length).split(/[?#]/)[0];
    try {
      return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1)) || null;
    } catch {
      return null;
    }
  }
  return null;
}


/** Mount around one message's blocks, and only when it has blocks that may register - it costs nothing otherwise */
export function HostedLinksProvider({ children }: { children: React.ReactNode }) {

  const [actions, setActions] = React.useState<ReadonlyMap<string, HostedLinkAction[]>>(() => new Map());

  const register = React.useCallback<HostedLinkRegister>((handle, action) => {
    setActions(prev => new Map(prev).set(handle, [...(prev.get(handle) || []), action]));
    return () => setActions(prev => {
      const rest = (prev.get(handle) || []).filter(a => a !== action);
      const next = new Map(prev);
      if (rest.length) next.set(handle, rest); else next.delete(handle);
      return next;
    });
  }, []);

  return (
    <HostedLinksRegisterContext.Provider value={register}>
      <HostedLinksActionsContext.Provider value={actions}>
        {children}
      </HostedLinksActionsContext.Provider>
    </HostedLinksRegisterContext.Provider>
  );
}

/** For blocks: the register function, or null when no message frame provides one */
export function useHostedLinkRegister(): HostedLinkRegister | null {
  return React.useContext(HostedLinksRegisterContext);
}

/** For links: the single action registered for this href's handle, undefined when none or ambiguous */
export function useHostedLinkAction(href: string | undefined): HostedLinkAction | undefined {
  const actions = React.useContext(HostedLinksActionsContext);
  if (!actions || !href) return undefined;
  const handle = hostedLinkHandleFromHref(href);
  const list = handle ? actions.get(handle) : undefined;
  return list?.length === 1 ? list[0] : undefined;
}
