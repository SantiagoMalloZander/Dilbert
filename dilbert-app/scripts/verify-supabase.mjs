const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local first."
  );
  process.exit(1);
}

const apiKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const headers = {
  apikey: apiKey,
  Authorization: `Bearer ${apiKey}`,
};

async function verify() {
  const [authResponse, restResponse] = await Promise.all([
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/`, { headers }),
  ]);

  const restReachable = restResponse.ok || restResponse.status === 401;

  if (!authResponse.ok || !restReachable) {
    console.error("Supabase connectivity check failed.", {
      authStatus: authResponse.status,
      restStatus: restResponse.status,
    });
    process.exit(1);
  }

  console.log("Supabase connection verified.");
  console.log(`Auth endpoint status: ${authResponse.status}`);
  console.log(`REST endpoint status: ${restResponse.status}`);
  if (restResponse.status === 401) {
    console.log(
      "REST endpoint is reachable but the current key does not grant query access. Add SUPABASE_SERVICE_ROLE_KEY for full verification."
    );
  }
}

verify().catch((error) => {
  console.error("Unexpected error verifying Supabase:", error);
  process.exit(1);
});
