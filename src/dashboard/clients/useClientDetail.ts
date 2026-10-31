import { useResource } from '../useResource';
import type { ClientDetailData } from './ClientPanels';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** the client's own record - nothing to fetch for someone known only by name */
export const useClientDetail = (id: string) => useResource<ClientDetailData>(UUID.test(id) ? `/api/studio/clients/${id}` : null);
