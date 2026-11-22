function unavailable(message, status) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  })
}

export async function onRequest({ request, env }) {
  const incoming = new URL(request.url)
  let upstream
  try {
    upstream = new URL(env.RECLAIM_API_ORIGIN)
  } catch {
    return unavailable("The ReClaim API origin is not configured.", 503)
  }
  if (upstream.protocol !== "https:" || upstream.username || upstream.password ||
      upstream.pathname !== "/" || upstream.search || upstream.hash || upstream.origin === incoming.origin) {
    return unavailable("The ReClaim API origin must be a separate HTTPS origin.", 503)
  }
  upstream.pathname = incoming.pathname
  upstream.search = incoming.search

  const headers = new Headers()
  for (const name of ["Authorization", "Content-Type"]) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  try {
    const result = await fetch(upstream, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    })
    if (result.status >= 300 && result.status < 400) {
      return unavailable("The ReClaim API returned an unexpected redirect.", 502)
    }
    return new Response(result.body, {
      status: result.status,
      headers: {
        "Content-Type": result.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return unavailable("The ReClaim API is unavailable.", 502)
  }
}
