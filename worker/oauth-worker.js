const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/auth") {
        return beginAuthorization(request, env);
      }

      if (url.pathname === "/callback") {
        return finishAuthorization(request, env);
      }

      return new Response(
        "Vistara Build GitHub OAuth Worker aktif.",
        {
          status: 200,
          headers: securityHeaders("text/plain; charset=utf-8")
        }
      );
    } catch (error) {
      return errorPage(
        error instanceof Error ? error.message : "Terjadi kesalahan.",
        env.ADMIN_ORIGIN || "*"
      );
    }
  }
};

async function beginAuthorization(request, env) {
  requireVariables(env);

  const requestUrl = new URL(request.url);
  const callbackUrl = requestUrl.origin + "/callback";

  const state = await createSignedState(env.STATE_SECRET, {
    origin: env.ADMIN_ORIGIN,
    expires: Date.now() + 10 * 60 * 1000,
    nonce: crypto.randomUUID()
  });

  const githubUrl = new URL(
    "https://github.com/login/oauth/authorize"
  );

  githubUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set("redirect_uri", callbackUrl);
  githubUrl.searchParams.set(
    "scope",
    env.GITHUB_SCOPE || "public_repo"
  );
  githubUrl.searchParams.set("state", state);

  return Response.redirect(githubUrl.toString(), 302);
}

async function finishAuthorization(request, env) {
  requireVariables(env);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const githubError = url.searchParams.get("error");

  if (githubError) {
    throw new Error(
      url.searchParams.get("error_description") ||
      "Login GitHub dibatalkan."
    );
  }

  if (!code || !state) {
    throw new Error("Kode atau state OAuth tidak ditemukan.");
  }

  const stateData = await verifySignedState(
    env.STATE_SECRET,
    state
  );

  if (stateData.origin !== env.ADMIN_ORIGIN) {
    throw new Error("Origin admin tidak sesuai.");
  }

  if (Date.now() > stateData.expires) {
    throw new Error("Sesi login kedaluwarsa. Silakan login ulang.");
  }

  const callbackUrl = url.origin + "/callback";

  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Vistara-Build-OAuth"
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl,
        state
      })
    }
  );

  if (!tokenResponse.ok) {
    throw new Error("GitHub menolak pertukaran token.");
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    throw new Error(
      tokenData.error_description ||
      "Token GitHub tidak diterima."
    );
  }

  const userResponse = await fetch(
    "https://api.github.com/user",
    {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + tokenData.access_token,
        "User-Agent": "Vistara-Build-OAuth",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  if (!userResponse.ok) {
    throw new Error("Gagal memeriksa akun GitHub.");
  }

  const user = await userResponse.json();

  if (
    String(user.login).toLowerCase() !==
    String(env.ALLOWED_GITHUB_USER).toLowerCase()
  ) {
    throw new Error(
      "Akun GitHub ini tidak diizinkan mengelola website."
    );
  }

  return successPage(
    tokenData.access_token,
    env.ADMIN_ORIGIN,
    user.login
  );
}

function requireVariables(env) {
  const required = [
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "STATE_SECRET",
    "ADMIN_ORIGIN",
    "ALLOWED_GITHUB_USER"
  ];

  for (const key of required) {
    if (!env[key]) {
      throw new Error("Variabel Worker belum diisi: " + key);
    }
  }
}

async function createSignedState(secret, data) {
  const payload = base64UrlEncode(
    encoder.encode(JSON.stringify(data))
  );

  const signature = await sign(secret, payload);

  return payload + "." + signature;
}

async function verifySignedState(secret, state) {
  const parts = state.split(".");

  if (parts.length !== 2) {
    throw new Error("Format state OAuth tidak valid.");
  }

  const [payload, signature] = parts;
  const valid = await verifySignature(
    secret,
    payload,
    signature
  );

  if (!valid) {
    throw new Error("Tanda tangan OAuth tidak valid.");
  }

  const decoded = new TextDecoder().decode(
    base64UrlDecode(payload)
  );

  return JSON.parse(decoded);
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value)
  );

  return base64UrlEncode(new Uint8Array(signature));
}

async function verifySignature(secret, value, signature) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signature),
    encoder.encode(value)
  );
}

function base64UrlEncode(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padding =
    normalized.length % 4 === 0
      ? ""
      : "=".repeat(4 - (normalized.length % 4));

  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function successPage(token, origin, username) {
  const message =
    "authorization:github:success:" +
    JSON.stringify({
      token,
      provider: "github"
    });

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Login berhasil</title>
</head>
<body>
  <p>Login berhasil sebagai ${escapeHtml(username)}.</p>
  <p>Jendela ini akan ditutup setelah panel admin terhubung.</p>

  <script>
    (function () {
      const targetOrigin = ${JSON.stringify(origin)};
      const successMessage = ${JSON.stringify(message)};

      function sendSuccess() {
        if (window.opener) {
          window.opener.postMessage(
            successMessage,
            targetOrigin
          );
        }
      }

      window.addEventListener("message", function (event) {
        if (event.origin !== targetOrigin) return;
        sendSuccess();
      });

      if (window.opener) {
        window.opener.postMessage(
          "authorizing:github",
          targetOrigin
        );
      }

      setTimeout(sendSuccess, 500);
      setTimeout(sendSuccess, 1200);
    })();
  <\/script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: securityHeaders("text/html; charset=utf-8")
  });
}

function errorPage(message, origin) {
  const failureMessage =
    "authorization:github:error:" +
    JSON.stringify({
      message
    });

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Login gagal</title>
</head>
<body>
  <h1>Login gagal</h1>
  <p>${escapeHtml(message)}</p>

  <script>
    if (window.opener) {
      window.opener.postMessage(
        ${JSON.stringify(failureMessage)},
        ${JSON.stringify(origin)}
      );
    }
  <\/script>
</body>
</html>`;

  return new Response(html, {
    status: 400,
    headers: securityHeaders("text/html; charset=utf-8")
  });
}

function securityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Opener-Policy": "unsafe-none"
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}