from __future__ import annotations

import argparse
import asyncio
from pathlib import Path
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine

if __package__ is None:
    sys.path.insert(0, str(Path(__file__).parents[1]))

from app.core.config import get_settings
from app.models import User, UserProvider
from app.services.credit_purchases import toss_iap_subject_hash


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Print the sandbox HMAC hash for one Apps in Toss test account.")
    parser.add_argument("--email", required=True)
    return parser


async def find_subject(email: str) -> str:
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    try:
        async with engine.connect() as connection:
            statement = select(User.provider_subject).where(User.provider == UserProvider.toss, User.email == email).order_by(User.updated_at.desc()).limit(1)
            subject = (await connection.execute(statement)).scalar_one_or_none()
            if not subject:
                raise ValueError("Apps in Toss user was not found for the supplied email")
            return subject
    finally:
        await engine.dispose()


async def run(email: str) -> str:
    subject = await find_subject(email)
    return toss_iap_subject_hash(get_settings(), subject, "sandbox")


def main() -> None:
    args = build_parser().parse_args()
    print(asyncio.run(run(args.email)))


if __name__ == "__main__":
    main()
