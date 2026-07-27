from __future__ import annotations

import argparse
import asyncio
import json
import os

import httpx


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Review and resolve ALIVE content reports.")
    parser.add_argument("--api", required=True, help="API origin, for example https://alive.example.com/api")
    parser.add_argument("--key", default=os.environ.get("MODERATION_API_KEY", ""), help="Defaults to MODERATION_API_KEY")
    subparsers = parser.add_subparsers(dest="command", required=True)
    list_parser = subparsers.add_parser("list")
    list_parser.add_argument("--status", default="pending", choices=["pending", "reviewing", "resolved", "dismissed"])
    resolve_parser = subparsers.add_parser("resolve")
    resolve_parser.add_argument("report_id")
    resolve_parser.add_argument("--status", required=True, choices=["reviewing", "resolved", "dismissed"])
    resolve_parser.add_argument("--action", default="none", choices=["none", "content_removed", "user_warned", "user_suspended", "user_banned"])
    resolve_parser.add_argument("--user-status", choices=["active", "suspended", "banned"])
    resolve_parser.add_argument("--note", default="")
    return parser


async def run(args: argparse.Namespace) -> None:
    if not args.key:
        raise RuntimeError("MODERATION_API_KEY is required")
    headers = {"X-Moderation-Key": args.key}
    async with httpx.AsyncClient(base_url=f"{args.api.rstrip('/')}/", headers=headers, timeout=30) as client:
        response = await request(client, args)
    response.raise_for_status()
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))


async def request(client: httpx.AsyncClient, args: argparse.Namespace) -> httpx.Response:
    if args.command == "list":
        return await client.get("moderation/reports", params={"status": args.status})
    payload = {"status": args.status, "resolution_action": args.action, "moderator_note": args.note, "target_user_status": args.user_status}
    return await client.patch(f"moderation/reports/{args.report_id}", json=payload)


def main() -> None:
    asyncio.run(run(build_parser().parse_args()))


if __name__ == "__main__":
    main()
