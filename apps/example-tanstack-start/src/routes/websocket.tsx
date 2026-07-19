import { createFileRoute } from '@tanstack/react-router';

import { WsChat } from '~/components/WsChat';

export const Route = createFileRoute('/websocket')({
  component: WsChat,
});
