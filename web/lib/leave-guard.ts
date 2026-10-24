// A live run is lost if the visitor leaves the page while it is going, and it
// has already used one of the day's few runs. This tiny module remembers
// whether one is going, so that links can ask before leaving.
//
// It is a plain variable and not React state on purpose: the links that read
// it sit in the page header, far from the flow that sets it, and nothing needs
// to re-draw when it changes.

let liveRunGoing = false;

export function setLiveRunGoing(value: boolean) {
  liveRunGoing = value;
}

export function isLiveRunGoing(): boolean {
  return liveRunGoing;
}
