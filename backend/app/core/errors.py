class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__("UNAUTHORIZED", message, 401)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__("FORBIDDEN", message, 403)


class NotFoundError(AppError):
    def __init__(self, message: str = "Not found") -> None:
        super().__init__("NOT_FOUND", message, 404)


class BadRequestError(AppError):
    def __init__(self, message: str = "Bad request") -> None:
        super().__init__("BAD_REQUEST", message, 400)


class ConflictError(AppError):
    def __init__(self, message: str = "Conflict") -> None:
        super().__init__("CONFLICT", message, 409)


class CharacterHandleTakenError(AppError):
    def __init__(self, message: str = "이미 사용 중인 아이디야.") -> None:
        super().__init__("CHARACTER_HANDLE_TAKEN", message, 409)


class ServiceUnavailableError(AppError):
    def __init__(self, message: str = "Service temporarily unavailable") -> None:
        super().__init__("SERVICE_UNAVAILABLE", message, 503)
