'use client';
import { useEffect, useState } from 'react';

/**
 * Header/footer call-to-action buttons. The server always renders the signed-out
 * state, so the static page stays fast and cacheable. After hydration a plain
 * cookie hint (no secrets, set on sign-in) swaps in "Open workspace" instantly,
 * with no network request. Access control is still enforced on the server.
 */
export function AuthButtons({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(/(?:^|;\s*)sb_hint=1(?:;|$)/.test(document.cookie));
  }, []);
  const lg = size === 'lg' ? ' btn-lg' : '';
  if (signedIn) {
    return <a className={`btn btn-primary${lg}`} href="/app">Open workspace</a>;
  }
  return (
    <>
      <a className={`btn btn-ghost${lg}`} href="/login">Log in</a>
      <a className={`btn btn-primary${lg}`} href="/register">Register</a>
    </>
  );
}
