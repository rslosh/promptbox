// Renders the modal slot empty for every non-intercepted route. Without
// this, parallel-route slots keep their last active match on soft
// navigation — e.g. "Open in Playground" from the lightbox would land on
// /playground with the lightbox still painted on top.
export default function ModalCatchAll() {
  return null;
}
