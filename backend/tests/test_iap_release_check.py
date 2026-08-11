from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from shutil import copyfile

from app.core.config import Settings
from app.core.credit_products import CREDIT_PRODUCTS
from app.iap_release_check import IapReleaseManifest, load_manifest, validate_manifest


SKU_ENV_BY_OFFER = {
    "credit-5000": "TOSS_IAP_CREDIT_5000_SKU",
    "credit-10000": "TOSS_IAP_CREDIT_10000_SKU",
    "credit-30000": "TOSS_IAP_CREDIT_30000_SKU",
    "credit-50000": "TOSS_IAP_CREDIT_50000_SKU",
    "credit-100000": "TOSS_IAP_CREDIT_100000_SKU",
}


def test_release_manifest_matches_bundle_assets_and_server_policy(tmp_path: Path) -> None:
    manifest = IapReleaseManifest.model_validate(_manifest_data(tmp_path))
    assert validate_manifest(manifest, _settings(), tmp_path) == ()


def test_release_manifest_rejects_sku_price_exposure_and_image_drift(tmp_path: Path) -> None:
    data = _manifest_data(tmp_path)
    first = data["products"][0]
    assert isinstance(first, dict)
    first.update({"sku": "wrong", "supply_price_krw": 4600, "sale_price_krw": 6000, "exposed": True, "display_name": "wrong", "image_sha256": "0" * 64})
    errors = validate_manifest(IapReleaseManifest.model_validate(data), _settings(), tmp_path)
    assert any("console SKU" in error for error in errors)
    assert any("sale price" in error for error in errors)
    assert any("supply price" in error for error in errors)
    assert any("exposure" in error for error in errors)
    assert any("image SHA-256" in error for error in errors)
    assert any("approved copy" in error for error in errors)
    assert any("approved product asset" in error for error in errors)


def test_release_manifest_rejects_duplicate_console_skus(tmp_path: Path) -> None:
    data = _manifest_data(tmp_path)
    products = data["products"]
    assert isinstance(products, list)
    assert isinstance(products[1], dict)
    products[1]["sku"] = "sku-0"
    errors = validate_manifest(IapReleaseManifest.model_validate(data), _settings(), tmp_path)
    assert "console SKU values must be unique" in errors


def test_release_manifest_rejects_placeholder_bundle_version(tmp_path: Path) -> None:
    data = _manifest_data(tmp_path)
    bundle = data["bundle"]
    assert isinstance(bundle, dict)
    bundle.update({"console_version": "<입력>", "minimum_support_version": "different"})
    errors = validate_manifest(IapReleaseManifest.model_validate(data), _settings(), tmp_path)
    assert any("recorded after upload" in error for error in errors)
    assert any("must equal" in error for error in errors)


def test_committed_manifest_has_products_but_blocks_unrecorded_bundle_versions() -> None:
    root = Path(__file__).parents[2]
    manifest = load_manifest(root / "documents/qa/guides/apps-in-toss-iap-console-manifest.example.json")
    environment_example = (root / ".env.example").read_text(encoding="utf-8")
    for product in manifest.products:
        assert f"{SKU_ENV_BY_OFFER[product.offer_id]}={product.sku}" in environment_example
    settings = _manifest_settings(manifest)
    errors = validate_manifest(manifest, settings, root)
    assert errors == (
        "console and minimum support versions must be recorded after upload",
        "minimum support version must equal the uploaded console bundle version",
    )


def _manifest_data(root: Path) -> dict[str, object]:
    artifact = root / "release.ait"
    artifact.write_bytes(b"ait deployment-id ashwoodfriends-alive")
    products = [_product_data(root, index) for index in range(len(CREDIT_PRODUCTS))]
    bundle = {"artifact_path": "release.ait", "artifact_sha256": _hash(artifact), "deployment_id": "deployment-id", "console_version": "bundle-v1", "minimum_support_version": "bundle-v1"}
    return {"app_name": "ashwoodfriends-alive", "bundle": bundle, "products": products}


def _product_data(root: Path, index: int) -> dict[str, object]:
    policy = CREDIT_PRODUCTS[index]
    image = root / f"product-{index}.png"
    source = _product_asset(policy.offer_id)
    copyfile(source, image)
    names = {"credit-5000": ("크레딧 500C", "얼라이브 AI 기능에 사용하는 500C"), "credit-10000": ("크레딧 1,000C", "얼라이브 AI 기능에 사용하는 1,000C"), "credit-30000": ("크레딧 3,150C", "기본 3,000C와 추가 150C를 지급해요"), "credit-50000": ("크레딧 5,500C", "기본 5,000C와 추가 500C를 지급해요"), "credit-100000": ("크레딧 11,500C", "기본 10,000C와 추가 1,500C를 지급해요")}
    return {"offer_id": policy.offer_id, "sku": f"sku-{index}", "product_type": "CONSUMABLE", "display_name": names[policy.offer_id][0], "description": names[policy.offer_id][1], "image_path": image.name, "image_sha256": _hash(image), "supply_price_krw": policy.supply_price_krw, "sale_price_krw": policy.price_krw, "display_amount": f"{policy.price_krw:,}원", "base_credits": policy.base_credits, "product_bonus_credits": policy.product_bonus_credits, "exposed": False}


def _product_asset(offer_id: str) -> Path:
    filenames = {"credit-5000": "credit-500.png", "credit-10000": "credit-1000.png", "credit-30000": "credit-3150.png", "credit-50000": "credit-5500.png", "credit-100000": "credit-11500.png"}
    return Path(__file__).parents[2] / "documents/qa/evidence/apps-in-toss-iap-products" / filenames[offer_id]


def _settings() -> Settings:
    values = {"toss_iap_credit_5000_sku": "sku-0", "toss_iap_credit_10000_sku": "sku-1", "toss_iap_credit_30000_sku": "sku-2", "toss_iap_credit_50000_sku": "sku-3", "toss_iap_credit_100000_sku": "sku-4"}
    return Settings(_env_file=None, **values)


def _manifest_settings(manifest: IapReleaseManifest) -> Settings:
    skus = {product.offer_id: product.sku for product in manifest.products}
    values = {
        "toss_iap_credit_5000_sku": skus["credit-5000"],
        "toss_iap_credit_10000_sku": skus["credit-10000"],
        "toss_iap_credit_30000_sku": skus["credit-30000"],
        "toss_iap_credit_50000_sku": skus["credit-50000"],
        "toss_iap_credit_100000_sku": skus["credit-100000"],
    }
    return Settings(_env_file=None, **values)


def _hash(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()
