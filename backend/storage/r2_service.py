import mimetypes
from urllib.parse import quote

import boto3
from botocore.config import Config as BotoConfig

from config.config import Config


class R2StorageError(Exception):
    pass


def _get_required_config():
    account_id = str(
        Config.R2_ACCOUNT_ID or ""
    ).strip()

    access_key_id = str(
        Config.R2_ACCESS_KEY_ID or ""
    ).strip()

    secret_access_key = str(
        Config.R2_SECRET_ACCESS_KEY or ""
    ).strip()

    bucket_name = str(
        Config.R2_BUCKET_NAME or ""
    ).strip()

    endpoint_url = str(
        Config.R2_ENDPOINT_URL or ""
    ).strip()

    missing = []

    if not account_id:
        missing.append(
            "R2_ACCOUNT_ID"
        )

    if not access_key_id:
        missing.append(
            "R2_ACCESS_KEY_ID"
        )

    if not secret_access_key:
        missing.append(
            "R2_SECRET_ACCESS_KEY"
        )

    if not bucket_name:
        missing.append(
            "R2_BUCKET_NAME"
        )

    if not endpoint_url:
        missing.append(
            "R2_ENDPOINT_URL"
        )

    if missing:
        raise R2StorageError(
            "Thiếu cấu hình R2: "
            + ", ".join(missing)
        )

    return {
        "account_id":
            account_id,

        "access_key_id":
            access_key_id,

        "secret_access_key":
            secret_access_key,

        "bucket_name":
            bucket_name,

        "endpoint_url":
            endpoint_url.rstrip("/"),
    }


def get_r2_client():
    config = _get_required_config()

    return boto3.client(
        "s3",

        endpoint_url=
            config[
                "endpoint_url"
            ],

        aws_access_key_id=
            config[
                "access_key_id"
            ],

        aws_secret_access_key=
            config[
                "secret_access_key"
            ],

        region_name="auto",

        config=BotoConfig(
            signature_version="s3v4",
        ),
    )


def normalize_object_key(
    object_key,
):
    return str(
        object_key or ""
    ).strip().lstrip("/")


def guess_content_type(
    filename,
    fallback=
        "application/octet-stream",
):
    content_type, _ = (
        mimetypes.guess_type(
            str(filename or "")
        )
    )

    return (
        content_type
        or fallback
    )


def upload_bytes(
    object_key,
    data,
    content_type=None,
    metadata=None,
):
    object_key = (
        normalize_object_key(
            object_key
        )
    )

    if not object_key:
        raise R2StorageError(
            "Object key không hợp lệ."
        )

    if data is None:
        raise R2StorageError(
            "Không có dữ liệu để upload."
        )

    config = (
        _get_required_config()
    )

    client = get_r2_client()

    extra = {}

    if content_type:
        extra[
            "ContentType"
        ] = content_type

    if metadata:
        extra[
            "Metadata"
        ] = {
            str(key):
                str(value)

            for key, value
            in metadata.items()

            if value is not None
        }

    try:
        client.put_object(
            Bucket=
                config[
                    "bucket_name"
                ],

            Key=
                object_key,

            Body=
                data,

            **extra,
        )
    except Exception as error:
        raise R2StorageError(
            "Không thể upload file lên R2."
        ) from error

    return {
        "key":
            object_key,

        "bucket":
            config[
                "bucket_name"
            ],

        "contentType":
            content_type
            or "",
    }


def upload_file_object(
    file_storage,
    object_key,
    content_type=None,
    metadata=None,
):
    if not file_storage:
        raise R2StorageError(
            "Không có file upload."
        )

    object_key = (
        normalize_object_key(
            object_key
        )
    )

    if not object_key:
        raise R2StorageError(
            "Object key không hợp lệ."
        )

    config = (
        _get_required_config()
    )

    client = get_r2_client()

    resolved_content_type = (
        content_type
        or getattr(
            file_storage,
            "mimetype",
            None,
        )
        or guess_content_type(
            getattr(
                file_storage,
                "filename",
                "",
            )
        )
    )

    extra_args = {
        "ContentType":
            resolved_content_type,
    }

    if metadata:
        extra_args[
            "Metadata"
        ] = {
            str(key):
                str(value)

            for key, value
            in metadata.items()

            if value is not None
        }

    try:
        file_storage.stream.seek(
            0
        )

        client.upload_fileobj(
            file_storage.stream,

            config[
                "bucket_name"
            ],

            object_key,

            ExtraArgs=
                extra_args,
        )
    except Exception as error:
        raise R2StorageError(
            "Không thể upload file lên R2."
        ) from error

    return {
        "key":
            object_key,

        "bucket":
            config[
                "bucket_name"
            ],

        "contentType":
            resolved_content_type,
    }


def delete_file(
    object_key,
):
    object_key = (
        normalize_object_key(
            object_key
        )
    )

    if not object_key:
        return False

    config = (
        _get_required_config()
    )

    client = get_r2_client()

    try:
        client.delete_object(
            Bucket=
                config[
                    "bucket_name"
                ],

            Key=
                object_key,
        )

        return True

    except Exception as error:
        raise R2StorageError(
            "Không thể xóa file trên R2."
        ) from error


def generate_presigned_get_url(
    object_key,
    expires_in=3600,
):
    object_key = (
        normalize_object_key(
            object_key
        )
    )

    if not object_key:
        raise R2StorageError(
            "Object key không hợp lệ."
        )

    config = (
        _get_required_config()
    )

    client = get_r2_client()

    try:
        return client.generate_presigned_url(
            "get_object",

            Params={
                "Bucket":
                    config[
                        "bucket_name"
                    ],

                "Key":
                    object_key,
            },

            ExpiresIn=
                int(
                    expires_in
                ),
        )

    except Exception as error:
        raise R2StorageError(
            "Không thể tạo URL R2."
        ) from error


def build_public_url(
    object_key,
):
    object_key = (
        normalize_object_key(
            object_key
        )
    )

    if not object_key:
        return ""

    public_base_url = str(
        getattr(
            Config,
            "R2_PUBLIC_BASE_URL",
            "",
        )
        or ""
    ).strip().rstrip("/")

    if not public_base_url:
        return ""

    safe_key = quote(
        object_key,
        safe="/",
    )

    return (
        f"{public_base_url}/"
        f"{safe_key}"
    )
