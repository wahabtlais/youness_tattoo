/**
 * The state of anything the UI reads from a data source. Components switch
 * on `status` (see components/ui/StateMessage) and never care whether the
 * data came from a static file or an API.
 */
export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error; retry?: () => void }
  | { status: 'success'; data: T };
