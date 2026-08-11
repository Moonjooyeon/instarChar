from __future__ import annotations

import argparse
import sys
from hashlib import sha256
from pathlib import Path
from typing import Literal

from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, NonNegativeInt, PositiveInt, ValidationError

from app.core.config import Settings
from app.core.credit_products import CREDIT_PRODUCTS, CreditProduct, credit_product_skus


SHA256_PATTERN = r"^[0-9a-f]{64}$"
PLACEHOLDER_MARKERS = ("<", ">", "REPLACE", "TODO", "입력")
APPROVED_PRODUCT_PRESENTATION = {
    "credit-5000": ("크레딧 500C", "얼라이브 AI 기능에 사용하는 500C", "4b5738d0794a1c4594504ca3d32fd4894cd668e005fb45107a0d0bc21c324967"),
    "credit-10000": ("크레딧 1,000C", "얼라이브 AI 기능에 사용하는 1,000C", "2a76f3283d05a0c90004344b3980421b87436736a8585bafb74d29c60d425a91"),
    "credit-30000": ("크레딧 3,150C", "기본 3,000C와 추가 150C를 지급해요", "43dd4f763359e61017ed1a428cec91a36d57206f77f7f7a20ded3dcf7cb5a2b1"),
    "credit-50000": ("크레딧 5,500C", "기본 5,000C와 추가 500C를 지급해요", "edab8057e9af98016ca1bb33de39b2fe5f9b40c6c5d7d6d398c824bad5c3000c"),
    "credit-100000": ("크레딧 11,500C", "기본 10,000C와 추가 1,500C를 지급해요", "83d2e3c4df0fe08d935722a06a9a6c74f3231d9e0887206337190c810e24d83c"),
}


class ReleaseBundle(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    artifact_path: str = Field(min_length=1)
    artifact_sha256: str = Field(pattern=SHA256_PATTERN)
    deployment_id: str = Field(min_length=1)
    console_version: str = Field(min_length=1)
    minimum_support_version: str = Field(min_length=1)


class ConsoleProduct(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    offer_id: str = Field(min_length=1)
    sku: str = Field(min_length=1)
    product_type: Literal["CONSUMABLE"]
    display_name: str = Field(min_length=1, max_length=30)
    description: str = Field(min_length=1, max_length=45)
    image_path: str = Field(min_length=1)
    image_sha256: str = Field(pattern=SHA256_PATTERN)
    supply_price_krw: PositiveInt
    sale_price_krw: PositiveInt
    display_amount: str = Field(min_length=1)
    base_credits: NonNegativeInt
    product_bonus_credits: NonNegativeInt
    exposed: bool


class IapReleaseManifest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    app_name: str = Field(min_length=1)
    bundle: ReleaseBundle
    products: list[ConsoleProduct] = Field(min_length=1)


def load_manifest(path: Path) -> IapReleaseManifest:
    return IapReleaseManifest.model_validate_json(path.read_text(encoding="utf-8"))


def validate_manifest(manifest: IapReleaseManifest, settings: Settings, root: Path) -> tuple[str, ...]:
    errors = _bundle_errors(manifest.bundle, manifest.app_name, root)
    if manifest.app_name != settings.toss_app_name:
        errors.append(f"app_name must equal TOSS_APP_NAME ({settings.toss_app_name})")
    configured = credit_product_skus(settings)
    products = {item.offer_id: item for item in manifest.products}
    skus = [item.sku for item in manifest.products]
    if len(products) != len(manifest.products):
        errors.append("offer_id values must be unique")
    if len(set(skus)) != len(skus):
        errors.append("console SKU values must be unique")
    if set(products) != set(configured):
        errors.append("products must contain every server offer_id exactly once")
    for policy in CREDIT_PRODUCTS:
        item = products.get(policy.offer_id)
        if item:
            errors.extend(_product_errors(item, policy, configured[policy.offer_id], root))
    return tuple(errors)


def _bundle_errors(bundle: ReleaseBundle, app_name: str, root: Path) -> list[str]:
    errors: list[str] = []
    artifact = _repo_file(root, bundle.artifact_path, errors)
    if artifact and artifact.suffix != ".ait":
        errors.append("bundle artifact must be an .ait file")
    if artifact and _file_sha256(artifact) != bundle.artifact_sha256:
        errors.append("bundle artifact SHA-256 does not match")
    if artifact and not _file_contains_text(artifact, bundle.deployment_id):
        errors.append("bundle artifact does not contain the recorded deployment_id")
    if artifact and not _file_contains_text(artifact, app_name):
        errors.append("bundle artifact does not contain app_name")
    if _has_placeholder(bundle.deployment_id):
        errors.append("deployment_id must be recorded from the built artifact")
    if _has_placeholder(bundle.console_version) or _has_placeholder(bundle.minimum_support_version):
        errors.append("console and minimum support versions must be recorded after upload")
    if bundle.console_version != bundle.minimum_support_version:
        errors.append("minimum support version must equal the uploaded console bundle version")
    return errors


def _product_errors(item: ConsoleProduct, policy: CreditProduct, configured_sku: str, root: Path) -> list[str]:
    errors = _product_policy_errors(item, policy, configured_sku)
    image = _repo_file(root, item.image_path, errors)
    if image and _file_sha256(image) != item.image_sha256:
        errors.append(f"{item.offer_id}: image SHA-256 does not match")
    if image and _image_size(image) != (1024, 1024):
        errors.append(f"{item.offer_id}: image must be 1024x1024")
    if image and image.suffix.lower() != ".png":
        errors.append(f"{item.offer_id}: image must be PNG")
    return errors


def _product_policy_errors(item: ConsoleProduct, policy: CreditProduct, configured_sku: str) -> list[str]:
    errors: list[str] = []
    expected_name, expected_description, expected_image_hash = APPROVED_PRODUCT_PRESENTATION[item.offer_id]
    if not configured_sku or _has_placeholder(item.sku) or item.sku != configured_sku:
        errors.append(f"{item.offer_id}: console SKU must match the configured server SKU")
    if item.sale_price_krw != policy.price_krw or _display_amount_value(item.display_amount) != item.sale_price_krw:
        errors.append(f"{item.offer_id}: console sale price, display amount, and server price must match")
    if item.supply_price_krw != policy.supply_price_krw:
        errors.append(f"{item.offer_id}: console supply price must match the server policy")
    if (item.base_credits, item.product_bonus_credits) != (policy.base_credits, policy.product_bonus_credits):
        errors.append(f"{item.offer_id}: granted credits must match the server policy")
    if (item.display_name, item.description) != (expected_name, expected_description):
        errors.append(f"{item.offer_id}: product name and description must match the approved copy")
    if item.image_sha256 != expected_image_hash:
        errors.append(f"{item.offer_id}: image must match the approved product asset")
    if item.exposed:
        errors.append(f"{item.offer_id}: product exposure must remain OFF before release approval")
    return errors


def _repo_file(root: Path, value: str, errors: list[str]) -> Path | None:
    path = (root / value).resolve()
    if not path.is_relative_to(root.resolve()):
        errors.append(f"path must stay inside the repository: {value}")
        return None
    if not path.is_file():
        errors.append(f"file does not exist: {value}")
        return None
    return path


def _file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _file_contains_text(path: Path, value: str) -> bool:
    needle = value.encode()
    with path.open("rb") as source:
        previous = b""
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            if needle in previous + chunk:
                return True
            previous = chunk[-len(needle):]
    return False


def _image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


def _display_amount_value(value: str) -> int:
    digits = "".join(character for character in value if character.isdigit())
    return int(digits) if digits else -1


def _has_placeholder(value: str) -> bool:
    upper = value.upper()
    return any(marker.upper() in upper for marker in PLACEHOLDER_MARKERS)


def main(arguments: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate Apps in Toss IAP console data against the server policy")
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args(arguments)
    try:
        manifest = load_manifest(args.manifest)
        errors = validate_manifest(manifest, Settings(), args.root.resolve())
    except (OSError, ValidationError) as exc:
        print(f"IAP release preflight failed: {exc}", file=sys.stderr)
        return 1
    if errors:
        print("IAP release preflight failed:\n- " + "\n- ".join(errors), file=sys.stderr)
        return 1
    print(f"IAP release preflight passed for {len(manifest.products)} products")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
