async function handleWebSocket(req: Request): Promise<Response> {
  const { socket: clientWs, response } = Deno.upgradeWebSocket(req);

  const url = new URL(req.url);
  const targetUrl = `wss://generativelanguage.googleapis.com${url.pathname}${url.search}`;

  console.log('Target URL:', targetUrl);

  const pendingMessages: string[] = [];
  const targetWs = new WebSocket(targetUrl);

  console.log('Client connected, proxying to:', targetUrl);

  targetWs.onopen = () => {
    console.log('Target WebSocket connected to Gemini');
    pendingMessages.forEach(msg => targetWs.send(msg));
    console.log(`Flushed ${pendingMessages.length} pending messages`);
    pendingMessages.length = 0;
  };

  clientWs.onmessage = (event) => {
    console.log('Client message received, forwarding to target');
    if (targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(event.data);
    } else {
      console.log('Target not ready, queuing message');
      pendingMessages.push(event.data);
    }
  };

  targetWs.onmessage = (event) => {
    console.log('Target message received, forwarding to client');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(event.data);
    }
  };

  clientWs.onclose = (event) => {
    console.log(`Client connection closed (code: ${event.code})`);
    if (targetWs.readyState === WebSocket.OPEN) {
      targetWs.close(1000, event.reason);
    }
  };

  targetWs.onclose = (event) => {
    console.log(`Target connection closed (code: ${event.code}, reason: ${event.reason})`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(event.code, event.reason);
    }
  };

  targetWs.onerror = (error) => {
    console.error('Target WebSocket error:', {
      targetUrl,
      readyState: targetWs.readyState,
      message: error.message || 'Unknown error',
    });
  };

  return response;
}

async function handleAPIRequest(req: Request): Promise<Response> {
  try {
    const worker = await import('./api_proxy/worker.mjs');
    return await worker.default.fetch(req);
  } catch (error) {
    console.error('API request error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStatus = (error as { status?: number }).status || 500;
    return new Response(errorMessage, {
      status: errorStatus,
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
      }
    });
  }
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  console.log('Request URL:', req.url);

  // WebSocket 处理
  if (req.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    return handleWebSocket(req);
  }

  if (url.pathname.endsWith("/chat/completions") ||
    url.pathname.endsWith("/embeddings") ||
    url.pathname.endsWith("/models")) {
    return handleAPIRequest(req);
  }

  return new Response('ok');
}

Deno.serve(handleRequest); 