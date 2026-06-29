import { NextResponse, type NextRequest } from "next/server";
import { TOOLS, TOOLS_BY_NAME } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // on-demand article generation can take a while

const SERVER_INFO = { name: "telugulo", title: "telugulo.in control", version: "1.0.0" };
const PROTOCOL = "2025-06-18";

type RpcId = string | number | null;
type RpcMsg = {
  jsonrpc?: string;
  id?: RpcId;
  method?: string;
  params?: Record<string, unknown>;
};

/** Token-in-URL auth (Claude connector form has no token field) — also accepts a Bearer header. */
function authorized(req: NextRequest): boolean {
  const expected = process.env.MCP_AUTH_TOKEN;
  if (!expected) return false; // not configured → deny everything
  const fromQuery = req.nextUrl.searchParams.get("token");
  const fromHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return fromQuery === expected || fromHeader === expected;
}

export async function GET() {
  // Stateless server: no server→client SSE stream.
  return new NextResponse("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized: missing or invalid token" } },
      { status: 401 },
    );
  }

  let body: RpcMsg | RpcMsg[];
  try {
    body = (await req.json()) as RpcMsg | RpcMsg[];
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }

  const handleOne = async (msg: RpcMsg): Promise<object | null> => {
    const id = msg?.id ?? null;
    const method = msg?.method;
    const params = msg?.params ?? {};

    // Notifications carry no id and expect no response.
    if (typeof method === "string" && method.startsWith("notifications/")) return null;

    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: (params.protocolVersion as string) || PROTOCOL,
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
          },
        };
      case "ping":
        return { jsonrpc: "2.0", id, result: {} };
      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: TOOLS.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
              annotations: {
                readOnlyHint: Boolean(t.readOnly),
                destructiveHint: !t.readOnly,
              },
            })),
          },
        };
      case "tools/call": {
        const name = String(params.name ?? "");
        const tool = TOOLS_BY_NAME[name];
        if (!tool) {
          return {
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true },
          };
        }
        try {
          const args = (params.arguments as Record<string, unknown>) ?? {};
          const out = await tool.handler(args);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: out.text }],
              ...(out.data !== undefined ? { structuredContent: out.data } : {}),
            },
          };
        } catch (e) {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : "failed"}` }],
              isError: true,
            },
          };
        }
      }
      default:
        return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
  };

  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(handleOne))).filter(Boolean);
    if (responses.length === 0) return new NextResponse(null, { status: 202 });
    return NextResponse.json(responses);
  }

  const res = await handleOne(body);
  if (res === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(res);
}
